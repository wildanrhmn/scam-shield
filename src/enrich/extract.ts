import type { Entity } from "./types.js";

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"')\]]+)/gi;
const ETH_RE = /\b(0x[a-fA-F0-9]{40})\b/g;
const SOL_RE = /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/g;
const EMAIL_RE = /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
const PHONE_RE = /(?:(?<!\w)\+?\d[\d\s().-]{6,}\d)(?!\w)/g;

const dedupe = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))];

export function hostOf(url: string): string | null {
  try {
    return new URL(url.startsWith("http") ? url : `http://${url}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function extractEntities(text: string): Entity[] {
  if (!text) return [];
  const out: Entity[] = [];

  const urls = dedupe(text.match(URL_RE) ?? []);
  for (const value of urls) out.push({ type: "url", value });

  const domains = dedupe(urls.map(hostOf).filter((d): d is string => !!d));
  for (const value of domains) out.push({ type: "domain", value });

  for (const value of dedupe(text.match(ETH_RE) ?? [])) out.push({ type: "eth_address", value });

  const ethSet = new Set(out.filter((e) => e.type === "eth_address").map((e) => e.value));
  for (const value of dedupe(text.match(SOL_RE) ?? [])) {
    if (!value.startsWith("0x") && !ethSet.has(value) && value.length >= 32) {
      out.push({ type: "sol_address", value });
    }
  }

  for (const value of dedupe(text.match(EMAIL_RE) ?? [])) out.push({ type: "email", value });

  for (const value of dedupe(text.match(PHONE_RE) ?? [])) {
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) out.push({ type: "phone", value: value.trim() });
  }

  return out;
}
