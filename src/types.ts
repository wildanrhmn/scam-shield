export interface Attachment {
  kind: "image" | "pdf";
  /** base64 (no data: prefix). */
  base64: string;
  /** image/png etc. for images; application/pdf for pdfs. */
  mediaType?: string;
}

export interface AnalyzeInput {
  /** Free-form text: a message, email, URL, address, token, job offer, etc. */
  text?: string;
  /** Screenshots and/or PDF documents to analyze. */
  files?: Attachment[];
  /** Legacy single screenshot (folded into `files`). */
  imageBase64?: string;
  imageMediaType?: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  /** Optional caller hint about what this is; the engine still classifies. */
  typeHint?: string;
}
