import type { Evidence } from "./types.js";

const NET_TIMEOUT = Number(process.env.ENRICH_TIMEOUT_MS ?? 6000);

async function getJson(url: string): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), NET_TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// GoPlus address_security flags → evidence. Keyless, cross-chain malicious-address DB.
const ADDRESS_FLAGS: Record<string, { label: string; severity: Evidence["severity"] }> = {
  sanctioned: { label: "on a sanctions list", severity: "high" },
  phishing_activities: { label: "linked to phishing activity", severity: "high" },
  stealing_attack: { label: "linked to wallet-draining / theft attacks", severity: "high" },
  honeypot_related_address: { label: "associated with honeypot scam tokens", severity: "high" },
  blackmail_activities: { label: "linked to blackmail/extortion", severity: "high" },
  cybercrime: { label: "linked to cybercrime", severity: "high" },
  money_laundering: { label: "linked to money laundering", severity: "high" },
  financial_crime: { label: "linked to financial crime", severity: "high" },
  darkweb_transactions: { label: "linked to darkweb transactions", severity: "medium" },
  fake_kyc: { label: "linked to fake KYC", severity: "medium" },
  malicious_mining_activities: { label: "linked to malicious mining", severity: "medium" },
  mixer: { label: "a mixer address", severity: "low" },
  blacklist_doubt: { label: "suspected blacklisted", severity: "medium" },
};

/** GoPlus address security — sanctions, phishing, theft, and other malicious flags. */
export async function goPlusAddress(address: string): Promise<Evidence[]> {
  const data = await getJson(`https://api.gopluslabs.io/api/v1/address_security/${address}`);
  const result = data?.result;
  if (!result) return [];
  const out: Evidence[] = [];
  for (const [key, meta] of Object.entries(ADDRESS_FLAGS)) {
    if (String(result[key]) === "1") {
      out.push({
        claim: `Address is ${meta.label} (GoPlus security data)`,
        source: "GoPlus",
        kind: "verified",
        severity: meta.severity,
        subject: address,
      });
    }
  }
  if (out.length === 0) {
    out.push({ claim: `No malicious flags found for ${address.slice(0, 10)}… in GoPlus`, source: "GoPlus", kind: "verified", severity: "info", subject: address });
  }
  return out;
}

/** GoPlus phishing-site check for a URL/host (crypto drainer sites). */
export async function goPlusPhishingSite(host: string): Promise<Evidence[]> {
  const data = await getJson(`https://api.gopluslabs.io/api/v1/phishing_site?url=${encodeURIComponent(host)}`);
  const r = data?.result;
  if (r && String(r.phishing_site) === "1") {
    return [{ claim: `${host} is a known crypto phishing / wallet-drainer site (GoPlus)`, source: "GoPlus", kind: "verified", severity: "high", subject: host }];
  }
  return [];
}
