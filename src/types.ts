export interface AnalyzeInput {
  /** Free-form text: a message, email, URL, address, token, job offer, etc. */
  text?: string;
  /** Optional screenshot as base64 (no data: prefix). */
  imageBase64?: string;
  /** MIME type of the image, e.g. "image/png" or "image/jpeg". */
  imageMediaType?: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  /** Optional caller hint about what this is; the engine still classifies. */
  typeHint?: string;
}
