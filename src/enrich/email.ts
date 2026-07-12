import type { Evidence } from "./types.js";

// When raw email headers are present, a failed SPF/DKIM/DMARC is authoritative
// proof the sender is spoofed. Emits nothing for ordinary pasted text.
export function checkEmailHeaders(text: string): Evidence[] {
  const out: Evidence[] = [];

  const arMatch = text.match(/Authentication-Results:[\s\S]*?(?:\r?\n(?!\s)|$)/i);
  const ar = (arMatch?.[0] ?? "").replace(/\s+/g, " ");
  const receivedSpf = text.match(/Received-SPF:\s*(\w+)/i)?.[1]?.toLowerCase();

  const spf = (ar.match(/\bspf=(\w+)/i)?.[1] ?? receivedSpf ?? "").toLowerCase();
  const dkim = (ar.match(/\bdkim=(\w+)/i)?.[1] ?? "").toLowerCase();
  const dmarc = (ar.match(/\bdmarc=(\w+)/i)?.[1] ?? "").toLowerCase();

  if (spf === "fail" || spf === "softfail")
    out.push({ claim: `Email SPF authentication returned "${spf}" — the sending server is not authorized for this domain (spoofing)`, source: "email auth headers", kind: "verified", severity: "high", detail: "SPF" });
  if (dkim === "fail")
    out.push({ claim: "Email DKIM signature failed — the message was forged or altered in transit", source: "email auth headers", kind: "verified", severity: "high", detail: "DKIM" });
  if (dmarc === "fail")
    out.push({ claim: "Email DMARC check failed — the sender domain does not authorize this mail", source: "email auth headers", kind: "verified", severity: "high", detail: "DMARC" });

  return out;
}
