import type { Entity } from "./types.js";

// Deterministic entity extraction. Structured entities (URLs, addresses, emails)
// don't need AI to find — regex is exact and free.

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"')\]]+)/gi;
const ETH_RE = /\b(0x[a-fA-F0-9]{40})\b/g;
// Base58, 32-44 chars — Solana addresses (also matches some other base58; validated downstream)
const SOL_RE = /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/g;
const EMAIL_RE = /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
// Loose international phone: optional +, 7-15 digits with separators
const PHONE_RE = /(?:(?<!\w)\+?\d[\d\s().-]{6,}\d)(?!\w)/g;

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

/** Extract the eTLD+1-ish registrable domain / host from a URL. */
export function hostOf(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `http://${url}`);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function extractEntities(text: string): Entity[] {
  if (!text) return [];
  const out: Entity[] = [];

  const urls = dedupe(text.match(URL_RE) ?? []);
  for (const value of urls) out.push({ type: "url", value });

  // domains behind URLs (for domain-age / reputation on the host)
  const domains = dedupe(urls.map(hostOf).filter((d): d is string => !!d));
  for (const value of domains) out.push({ type: "domain", value });

  for (const value of dedupe(text.match(ETH_RE) ?? [])) out.push({ type: "eth_address", value });

  // Solana: exclude anything already captured as eth (0x…) and obvious non-addresses
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
