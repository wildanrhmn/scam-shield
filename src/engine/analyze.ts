import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Verdict } from "./schema.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import type { AnalyzeInput } from "../types.js";

const MODEL = process.env.MODEL ?? "claude-sonnet-5";

// Lazily constructed so the server always boots (health checks, manifest) even
// before ANTHROPIC_API_KEY is set — only an actual analysis needs the key.
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Run the fraud analysis and return a validated Verdict.
 * Throws on empty input or if the model fails to produce a parseable verdict.
 */
export async function analyze(input: AnalyzeInput): Promise<Verdict> {
  const hasText = !!input.text?.trim();
  const hasImage = !!input.imageBase64;
  if (!hasText && !hasImage) {
    throw new Error("Provide `text` and/or `imageBase64` to analyze.");
  }

  const content: Anthropic.ContentBlockParam[] = [];

  if (hasImage) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: input.imageMediaType ?? "image/png",
        data: input.imageBase64!,
      },
    });
  }

  const hint = input.typeHint ? `\n\n(Caller hint about the content type: ${input.typeHint})` : "";
  content.push({
    type: "text",
    text: hasText
      ? `Assess whether the following is a scam. Return your verdict.\n\n"""\n${input.text!.trim()}\n"""${hint}`
      : `Assess whether the attached screenshot shows a scam. Return your verdict.${hint}`,
  });

  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 1500,
    // Fast, bounded classification — thinking off keeps the pay-per-call path snappy.
    thinking: { type: "disabled" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(Verdict) },
  });

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
  return verdict;
}
