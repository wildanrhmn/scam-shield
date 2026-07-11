import { z } from "zod";

/**
 * The Scam Shield verdict contract.
 *
 * This is both the structured output we force Claude to return AND the public
 * shape a caller receives. Kept flat and enum-driven so it renders cleanly as a
 * card in the demo and is trivial for another agent to consume.
 *
 * Note: JSON-Schema structured outputs do not support numeric min/max or string
 * length constraints, so ranges (0-100) are enforced via the prompt + a clamp in
 * analyze.ts rather than in the schema.
 */

export const VerdictLevel = z.enum(["safe", "caution", "scam"]);
export type VerdictLevel = z.infer<typeof VerdictLevel>;

export const InputType = z.enum([
  "message",
  "email",
  "url",
  "wallet_address",
  "token",
  "job_offer",
  "image",
  "other",
]);
export type InputType = z.infer<typeof InputType>;

export const Severity = z.enum(["low", "medium", "high"]);

export const RedFlag = z.object({
  label: z.string().describe("Short name for the red flag, e.g. 'Urgency pressure'."),
  detail: z.string().describe("One sentence explaining why this is suspicious, quoting the input where useful."),
  severity: Severity,
});

export const Indicators = z.object({
  urls: z.array(z.string()).describe("Every URL/domain found in the input."),
  addresses: z.array(z.string()).describe("Every crypto wallet/contract address found."),
  emails: z.array(z.string()).describe("Every email address found."),
  phone_numbers: z.array(z.string()).describe("Every phone number found."),
});

export const Verdict = z.object({
  verdict: VerdictLevel.describe(
    "safe = no meaningful risk found; caution = suspicious or insufficient info to clear it; scam = clear fraud/phishing/drainer indicators. When unsure, choose caution — never safe.",
  ),
  confidence: z.number().describe("0-100 confidence in the verdict."),
  risk_score: z.number().describe("0-100 overall risk. 0 = benign, 100 = certain scam."),
  input_type: InputType.describe("Your best classification of what the user submitted."),
  title: z.string().describe("A punchy one-line headline for the verdict card."),
  summary: z.string().describe("1-2 plain-language sentences a non-expert understands."),
  red_flags: z.array(RedFlag).describe("Specific reasons. Empty only when genuinely safe."),
  recommended_actions: z.array(z.string()).describe("Concrete next steps for the user."),
  indicators: Indicators,
  disclaimer: z.string().describe("Always: risk guidance, not a guarantee; verify independently."),
});

export type Verdict = z.infer<typeof Verdict>;
