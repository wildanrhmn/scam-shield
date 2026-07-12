import type { AnalyzeInput } from "../types.js";

// Thrown on bad caller input; the server maps this to a clean 400.
export class ValidationError extends Error {}

const ALLOWED_MEDIA = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_TEXT_CHARS = Number(process.env.MAX_TEXT_CHARS ?? 12000);
const MAX_IMAGE_CHARS = Number(process.env.MAX_IMAGE_CHARS ?? 8_000_000);
const MAX_HINT_CHARS = 200;

export function validateInput(body: unknown): AnalyzeInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError("Request body must be a JSON object.");
  }
  const { text, imageBase64, imageMediaType, typeHint } = body as Record<string, unknown>;

  if (text !== undefined && typeof text !== "string") throw new ValidationError("`text` must be a string.");
  if (imageBase64 !== undefined && typeof imageBase64 !== "string") throw new ValidationError("`imageBase64` must be a base64 string.");
  if (imageMediaType !== undefined && typeof imageMediaType !== "string") throw new ValidationError("`imageMediaType` must be a string.");
  if (typeHint !== undefined && typeof typeHint !== "string") throw new ValidationError("`typeHint` must be a string.");

  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasImage = typeof imageBase64 === "string" && imageBase64.length > 0;
  if (!hasText && !hasImage) throw new ValidationError("Provide `text` and/or `imageBase64` to analyze.");

  if (hasText && (text as string).length > MAX_TEXT_CHARS) {
    throw new ValidationError(`\`text\` is too long (max ${MAX_TEXT_CHARS} characters).`);
  }

  let mediaType: AnalyzeInput["imageMediaType"];
  if (hasImage) {
    if ((imageBase64 as string).length > MAX_IMAGE_CHARS) throw new ValidationError("`imageBase64` is too large.");
    const mt = typeof imageMediaType === "string" ? imageMediaType : "image/png";
    if (!ALLOWED_MEDIA.has(mt)) throw new ValidationError("`imageMediaType` must be one of image/png, image/jpeg, image/gif, image/webp.");
    mediaType = mt as AnalyzeInput["imageMediaType"];
  }

  return {
    text: hasText ? (text as string) : undefined,
    imageBase64: hasImage ? (imageBase64 as string) : undefined,
    imageMediaType: mediaType,
    typeHint: typeof typeHint === "string" ? typeHint.slice(0, MAX_HINT_CHARS) : undefined,
  };
}
