import Anthropic from "@anthropic-ai/sdk";
import crypto from "node:crypto";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Verdict } from "./schema.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { enrich } from "../enrich/index.js";
import { vtFileHash } from "../enrich/virustotal.js";
import type { Evidence } from "../enrich/types.js";
import type { AnalyzeInput, Attachment } from "../types.js";

const MODEL = process.env.MODEL ?? "claude-sonnet-5";
const OCR_MODEL = process.env.OCR_MODEL ?? "claude-haiku-4-5";
const TIMEOUT_MS = Number(process.env.ANALYZE_TIMEOUT_MS ?? 45_000);
const MAX_TRANSCRIBE = 6; // cap the OCR passes per request

export interface ScamVerdict extends Verdict {
  evidence: Evidence[];
}

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// Legacy single image folds into the files array.
function collectFiles(input: AnalyzeInput): Attachment[] {
  const files = [...(input.files ?? [])];
  if (input.imageBase64) files.push({ kind: "image", base64: input.imageBase64, mediaType: input.imageMediaType ?? "image/png" });
  return files;
}

function fileBlock(att: Attachment): Anthropic.ContentBlockParam {
  if (att.kind === "pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: att.base64 } };
  }
  return { type: "image", source: { type: "base64", media_type: (att.mediaType ?? "image/png") as any, data: att.base64 } };
}

// Pull the visible text + any URLs/addresses/emails out of a screenshot or PDF so
// the same live-source validators that run on pasted text can run on files too.
async function transcribeFile(att: Attachment): Promise<string> {
  try {
    const r = await getClient().messages.create(
      {
        model: OCR_MODEL,
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: [
              fileBlock(att),
              {
                type: "text",
                text: "Transcribe ALL text visible in this file verbatim, and separately list every URL, domain, email address, crypto wallet/token address, and phone number shown. Output only the raw extracted text — no commentary.",
              },
            ],
          },
        ],
      },
      { timeout: 20_000 },
    );
    return r.content.map((b: any) => (b.type === "text" ? b.text : "")).join("\n").trim();
  } catch {
    return "";
  }
}

function factsBlock(evidence: Evidence[]): string {
  if (evidence.length === 0) return "";
  const lines = evidence.map((e) => `- [${e.severity}] ${e.claim} (source: ${e.source})`).join("\n");
  return (
    `\n\nVERIFIED FACTS from authoritative sources (checked live against real databases — treat as authoritative and weigh heavily). ` +
    `A high-severity verified fact (Safe Browsing hit, OFAC sanction, known drainer) must drive the verdict to SCAM. Cite them:\n${lines}`
  );
}

export async function analyze(input: AnalyzeInput): Promise<ScamVerdict> {
  const files = collectFiles(input);
  const hasText = !!input.text?.trim();
  const hasFiles = files.length > 0;
  if (!hasText && !hasFiles) throw new Error("Provide `text` and/or a file to analyze.");

  // Evidence pass 1: transcribe files → run the same entity validators as text.
  let enrichSource = input.text?.trim() ?? "";
  if (hasFiles) {
    const transcripts = await Promise.all(files.slice(0, MAX_TRANSCRIBE).map(transcribeFile));
    const joined = transcripts.filter(Boolean).join("\n");
    if (joined) enrichSource = enrichSource ? `${enrichSource}\n${joined}` : joined;
  }
  const textEvidence: Evidence[] = enrichSource ? (await enrich(enrichSource)).evidence : [];

  // Evidence pass 2: check each file's SHA-256 against VirusTotal (hash only — the
  // file never leaves the server) to catch known-malicious documents/images.
  const hashEvidence: Evidence[] = (
    await Promise.all(
      files.map((f) => {
        const sha = crypto.createHash("sha256").update(Buffer.from(f.base64, "base64")).digest("hex");
        return vtFileHash(sha, f.kind === "pdf" ? "PDF file" : "Image file");
      }),
    )
  ).flat();

  const evidence: Evidence[] = [...hashEvidence, ...textEvidence];

  const content: Anthropic.ContentBlockParam[] = files.map(fileBlock);
  const hint = input.typeHint ? `\n\n(Caller hint about the content type: ${input.typeHint})` : "";
  content.push({
    type: "text",
    text:
      (hasText
        ? `Assess whether the following is a scam. Return your verdict.\n\n"""\n${input.text!.trim()}\n"""${hint}`
        : `Assess whether the attached file${files.length > 1 ? "s" : ""} (screenshot / PDF) show a scam. Return your verdict.${hint}`) + factsBlock(evidence),
  });

  const response = await getClient().messages.parse(
    {
      model: MODEL,
      max_tokens: 1500,
      thinking: { type: "disabled" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      output_config: { format: zodOutputFormat(Verdict) },
    },
    { timeout: TIMEOUT_MS },
  );

  const verdict = response.parsed_output;
  if (!verdict) {
    throw new Error(
      response.stop_reason === "refusal"
        ? "Analysis was declined for safety reasons."
        : "Model did not return a parseable verdict.",
    );
  }

  verdict.confidence = clamp(verdict.confidence);
  verdict.risk_score = clamp(verdict.risk_score);

  // Verified facts are authoritative — never report "safe" when one is flagged.
  const highVerified = evidence.some((e) => e.kind === "verified" && e.severity === "high");
  const medVerified = evidence.some((e) => e.kind === "verified" && e.severity === "medium");
  if (highVerified && verdict.verdict !== "scam") {
    verdict.verdict = "scam";
    verdict.risk_score = Math.max(verdict.risk_score, 85);
  } else if (medVerified && verdict.verdict === "safe") {
    verdict.verdict = "caution";
    verdict.risk_score = Math.max(verdict.risk_score, 50);
  }

  return { ...verdict, evidence };
}
