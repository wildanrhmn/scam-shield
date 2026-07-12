import type { Evidence } from "./types.js";

const GSB_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY ?? "";
const NET_TIMEOUT = Number(process.env.ENRICH_TIMEOUT_MS ?? 6000);

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), NET_TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Last two labels — a cheap registrable-domain heuristic (imperfect for .co.uk). */
function registrableDomain(host: string): string {
  const parts = host.replace(/\.$/, "").split(".");
  return parts.length <= 2 ? host : parts.slice(-2).join(".");
}

const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
  "cutt.ly", "rebrand.ly", "t.ly", "shorturl.at", "rb.gy",
]);
const RISKY_TLDS = new Set([
  "zip", "mov", "top", "xyz", "info", "click", "link", "gq", "cf", "tk", "ml", "work", "loan", "country",
]);

/** Google Safe Browsing v4 — authoritative phishing/malware blocklist. */
export async function safeBrowsing(urls: string[]): Promise<Evidence[]> {
  if (!GSB_KEY || urls.length === 0) return [];
  try {
    const res = await fetchWithTimeout(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GSB_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "scam-shield", clientVersion: "1.0" },
          threatInfo: {
            threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: urls.map((u) => ({ url: u })),
          },
        }),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { matches?: Array<{ threatType: string; threat: { url: string } }> };
    return (data.matches ?? []).map((m) => ({
      claim: `Flagged by Google Safe Browsing as ${m.threatType.replace(/_/g, " ").toLowerCase()}`,
      source: "Google Safe Browsing",
      kind: "verified" as const,
      severity: "high" as const,
      subject: m.threat.url,
    }));
  } catch {
    return [];
  }
}

/** Domain registration age via RDAP — a very young domain is a strong red flag. */
export async function domainAge(domain: string): Promise<Evidence[]> {
  const reg = registrableDomain(domain);
  try {
    const res = await fetchWithTimeout(`https://rdap.org/domain/${encodeURIComponent(reg)}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { events?: Array<{ eventAction: string; eventDate: string }> };
    const ev = data.events?.find((e) => e.eventAction === "registration");
    if (!ev?.eventDate) return [];
    const days = Math.floor((Date.now() - new Date(ev.eventDate).getTime()) / 86400000);
    if (!Number.isFinite(days) || days < 0) return [];
    const on = new Date(ev.eventDate).toISOString().slice(0, 10);
    if (days <= 30) return [{ claim: `Domain ${reg} was registered only ${days} day(s) ago (${on})`, source: "RDAP/WHOIS", kind: "verified", severity: "high", subject: reg }];
    if (days <= 180) return [{ claim: `Domain ${reg} is recently registered — ${days} days ago (${on})`, source: "RDAP/WHOIS", kind: "verified", severity: "medium", subject: reg }];
    return [{ claim: `Domain ${reg} registered ${on} (${Math.floor(days / 365)}+ yr old)`, source: "RDAP/WHOIS", kind: "verified", severity: "info", subject: reg }];
  } catch {
    return [];
  }
}

/** Deterministic structural red flags in a URL — pure facts, no lookup. */
export function urlStructure(rawUrl: string): Evidence[] {
  const out: Evidence[] = [];
  let host = "";
  let hadAt = false;
  try {
    const u = new URL(rawUrl.startsWith("http") ? rawUrl : `http://${rawUrl}`);
    host = u.hostname.toLowerCase();
    hadAt = rawUrl.includes("@");
  } catch {
    return out;
  }
  const tld = host.split(".").pop() ?? "";

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host))
    out.push({ claim: `URL uses a raw IP address (${host}) instead of a domain name`, source: "heuristic", kind: "verified", severity: "high", subject: rawUrl });
  if (hadAt)
    out.push({ claim: "URL contains an '@' which can hide the real destination", source: "heuristic", kind: "verified", severity: "high", subject: rawUrl });
  if (host.includes("xn--"))
    out.push({ claim: `Domain uses punycode (${host}) — possible look-alike/homograph`, source: "heuristic", kind: "verified", severity: "medium", subject: rawUrl });
  if (SHORTENERS.has(host))
    out.push({ claim: `Link uses a URL shortener (${host}) that hides the true destination`, source: "heuristic", kind: "verified", severity: "medium", subject: rawUrl });
  if (host.split(".").length >= 5)
    out.push({ claim: `Domain has an unusual number of subdomains (${host})`, source: "heuristic", kind: "verified", severity: "low", subject: rawUrl });
  if ((registrableDomain(host).split(".")[0].match(/-/g)?.length ?? 0) >= 2)
    out.push({ claim: `Domain name is heavily hyphenated (${registrableDomain(host)}) — common in brand-spoofing`, source: "heuristic", kind: "verified", severity: "low", subject: rawUrl });
  if (RISKY_TLDS.has(tld))
    out.push({ claim: `Uses a TLD (.${tld}) frequently abused by scam sites`, source: "heuristic", kind: "verified", severity: "low", subject: rawUrl });

  return out;
}
