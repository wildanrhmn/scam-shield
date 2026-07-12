import type { Evidence } from "./types.js";

const VT_KEY = process.env.VIRUSTOTAL_API_KEY ?? "";
const NET_TIMEOUT = Number(process.env.ENRICH_TIMEOUT_MS ?? 6000);

async function vtGet(path: string): Promise<any | null> {
  if (!VT_KEY) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), NET_TIMEOUT);
  try {
    const res = await fetch(`https://www.virustotal.com/api/v3/${path}`, {
      headers: { "x-apikey": VT_KEY },
      signal: ctrl.signal,
    });
    if (!res.ok) return null; // 404 unseen / 429 rate-limited → best-effort skip
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function statsToEvidence(stats: any, subject: string, kind: string): Evidence[] {
  const mal = Number(stats?.malicious ?? 0);
  const susp = Number(stats?.suspicious ?? 0);
  const total = mal + susp + Number(stats?.harmless ?? 0) + Number(stats?.undetected ?? 0);
  if (mal >= 2) return [{ claim: `${kind} flagged as malicious by ${mal} of ${total} security vendors (VirusTotal)`, source: "VirusTotal", kind: "verified", severity: "high", subject }];
  if (mal === 1 || susp >= 2) return [{ claim: `${kind} flagged as suspicious by ${mal + susp} security vendors (VirusTotal)`, source: "VirusTotal", kind: "verified", severity: "medium", subject }];
  return [];
}

export async function vtUrl(url: string): Promise<Evidence[]> {
  const data = await vtGet(`urls/${Buffer.from(url).toString("base64url")}`);
  const stats = data?.data?.attributes?.last_analysis_stats;
  return stats ? statsToEvidence(stats, url, "URL") : [];
}

export async function vtDomain(domain: string): Promise<Evidence[]> {
  const data = await vtGet(`domains/${encodeURIComponent(domain)}`);
  const stats = data?.data?.attributes?.last_analysis_stats;
  return stats ? statsToEvidence(stats, domain, "Domain") : [];
}
