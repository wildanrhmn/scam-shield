import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Verdict } from "./schema.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { enrich } from "../enrich/index.js";
import type { Evidence } from "../enrich/types.js";
import type { AnalyzeInput } from "../types.js";

const MODEL = process.env.MODEL ?? "claude-sonnet-5";
const TIMEOUT_MS = Number(process.env.ANALYZE_TIMEOUT_MS ?? 45_000);

/** The verdict plus the verified evidence gathered from authoritative sources. */
export interface ScamVerdict extends Verdict {
  evidence: Evidence[];
}

// Lazily constructed so the server always boots (health checks, manifest) even
// before ANTHROPIC_API_KEY is set — only an actual analysis needs the key.
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function factsBlock(evidence: Evidence[]): string {
  if (evidence.length === 0) return "";
  const lines = evidence.map((e) => `- [${e.severity}] ${e.claim} (source: ${e.source})`).join("\n");
  return (
    `\n\nVERIFIED FACTS from authoritative sources (these were checked live against real databases — treat them as authoritative and weigh them heavily). ` +
    `A high-severity verified fact (e.g. a Safe Browsing phishing hit, an OFAC sanction, a known drainer address) must drive the verdict to SCAM. ` +
    `Do not contradict a verified fact; cite it in your reasoning:\n${lines}`
  );
}

/**
 * Two-pass analysis: extract entities and validate them against authoritative
 * sources, then have Claude synthesize an evidence-aware verdict. A deterministic
 * guard ensures verified high/medium-severity facts always override the model.
 */
export async function analyze(input: AnalyzeInput): Promise<ScamVerdict> {
  const hasText = !!input.text?.trim();
  const hasImage = !!input.imageBase64;
  if (!hasText && !hasImage) {
    throw new Error("Provide `text` and/or `imageBase64` to analyze.");
  }

  // Pass 1 — extract + validate against real data sources (text inputs).
  const { evidence } = hasText ? await enrich(input.text!) : { evidence: [] as Evidence[] };

  const content: Anthropic.ContentBlockParam[] = [];
  if (hasImage) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: input.imageMediaType ?? "image/png", data: input.imageBase64! },
    });
  }

  const hint = input.typeHint ? `\n\n(Caller hint about the content type: ${input.typeHint})` : "";
  content.push({
    type: "text",
    text:
      (hasText
        ? `Assess whether the following is a scam. Return your verdict.\n\n"""\n${input.text!.trim()}\n"""${hint}`
        : `Assess whether the attached screenshot shows a scam. Return your verdict.${hint}`) + factsBlock(evidence),
  });

  // Pass 2 — Claude synthesizes the verdict, informed by the verified facts.
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

  // Deterministic guard: verified evidence is authoritative, so a verified
  // high/medium flag can never be reported as "safe".
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
