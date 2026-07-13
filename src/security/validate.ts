import type { AnalyzeInput, Attachment } from "../types.js";

// Thrown on bad caller input; the server maps this to a clean 400.
export class ValidationError extends Error {}

const ALLOWED_IMAGE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_TEXT_CHARS = Number(process.env.MAX_TEXT_CHARS ?? 12000);
const MAX_FILE_CHARS = Number(process.env.MAX_FILE_CHARS ?? 8_000_000); // ~6 MB
const MAX_TOTAL_CHARS = Number(process.env.MAX_TOTAL_FILE_CHARS ?? 12_000_000); // ~9 MB across all files
const MAX_FILES = Number(process.env.MAX_FILES ?? 8);
const MAX_HINT_CHARS = 200;

function validateFile(f: unknown, i: number): Attachment {
  if (typeof f !== "object" || f === null) throw new ValidationError(`files[${i}] must be an object.`);
  const { kind, base64, mediaType } = f as Record<string, unknown>;
  if (kind !== "image" && kind !== "pdf") throw new ValidationError(`files[${i}].kind must be "image" or "pdf".`);
  if (typeof base64 !== "string" || base64.length === 0) throw new ValidationError(`files[${i}].base64 must be a base64 string.`);
  if (base64.length > MAX_FILE_CHARS) throw new ValidationError(`files[${i}] is too large.`);
  if (kind === "image") {
    const mt = typeof mediaType === "string" ? mediaType : "image/png";
    if (!ALLOWED_IMAGE.has(mt)) throw new ValidationError(`files[${i}].mediaType must be one of image/png, image/jpeg, image/gif, image/webp.`);
    return { kind: "image", base64, mediaType: mt };
  }
  if (!base64.startsWith("JVBERi")) throw new ValidationError(`files[${i}] does not look like a PDF.`); // %PDF- → base64 "JVBERi"
  return { kind: "pdf", base64, mediaType: "application/pdf" };
}

export function validateInput(body: unknown): AnalyzeInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError("Request body must be a JSON object.");
  }
  const b = body as Record<string, unknown>;
  const { text, imageBase64, imageMediaType, typeHint } = b;

  if (text !== undefined && typeof text !== "string") throw new ValidationError("`text` must be a string.");
  if (typeHint !== undefined && typeof typeHint !== "string") throw new ValidationError("`typeHint` must be a string.");

  const files: Attachment[] = [];
  if (b.files !== undefined) {
    if (!Array.isArray(b.files)) throw new ValidationError("`files` must be an array.");
    b.files.forEach((f, i) => files.push(validateFile(f, i)));
  }
  // Legacy single-image field.
  if (imageBase64 !== undefined) {
    if (typeof imageBase64 !== "string") throw new ValidationError("`imageBase64` must be a base64 string.");
    if (imageBase64.length > 0) files.push(validateFile({ kind: "image", base64: imageBase64, mediaType: imageMediaType }, files.length));
  }

  if (files.length > MAX_FILES) throw new ValidationError(`Too many files (max ${MAX_FILES}).`);
  if (files.reduce((n, f) => n + f.base64.length, 0) > MAX_TOTAL_CHARS) throw new ValidationError("Attachments are too large in total.");

  const hasText = typeof text === "string" && text.trim().length > 0;
  if (!hasText && files.length === 0) throw new ValidationError("Provide `text` and/or at least one file (image or PDF).");
  if (hasText && (text as string).length > MAX_TEXT_CHARS) {
    throw new ValidationError(`\`text\` is too long (max ${MAX_TEXT_CHARS} characters).`);
  }

  return {
    text: hasText ? (text as string) : undefined,
    files,
    typeHint: typeof typeHint === "string" ? typeHint.slice(0, MAX_HINT_CHARS) : undefined,
  };
}
