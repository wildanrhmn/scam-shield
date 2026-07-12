import type { Evidence } from "./types.js";

const NET_TIMEOUT = Number(process.env.ENRICH_TIMEOUT_MS ?? 6000);

async function getJson(url: string): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), NET_TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

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

export async function goPlusAddress(address: string): Promise<Evidence[]> {
  const data = await getJson(`https://api.gopluslabs.io/api/v1/address_security/${address}`);
  const result = data?.result;
  if (!result) return [];
  const out: Evidence[] = [];
  for (const [key, meta] of Object.entries(ADDRESS_FLAGS)) {
    if (String(result[key]) === "1") {
      out.push({ claim: `Address is ${meta.label} (GoPlus security data)`, source: "GoPlus", kind: "verified", severity: meta.severity, subject: address });
    }
  }
  if (out.length === 0) {
    out.push({ claim: `No malicious flags found for ${address.slice(0, 10)}… in GoPlus`, source: "GoPlus", kind: "verified", severity: "info", subject: address });
  }
  return out;
}

export const TOKEN_CHAINS: Array<{ id: string; name: string }> = [
  { id: "1", name: "Ethereum" },
  { id: "56", name: "BSC" },
  { id: "196", name: "X Layer" },
];

const TOKEN_FLAGS: Array<{ key: string; label: string; severity: Evidence["severity"] }> = [
  { key: "is_honeypot", label: "is a honeypot — buyers cannot sell it", severity: "high" },
  { key: "cannot_sell_all", label: "does not allow selling all tokens (honeypot indicator)", severity: "high" },
  { key: "owner_change_balance", label: "lets the owner arbitrarily change your balance", severity: "high" },
  { key: "hidden_owner", label: "has a hidden owner", severity: "medium" },
  { key: "can_take_back_ownership", label: "allows ownership to be re-claimed", severity: "medium" },
  { key: "is_blacklisted", label: "has a blacklist that can freeze holders", severity: "medium" },
  { key: "selfdestruct", label: "can self-destruct", severity: "medium" },
  { key: "transfer_pausable", label: "can pause all transfers", severity: "medium" },
  { key: "is_mintable", label: "can be minted freely by the owner", severity: "low" },
];

// Returns [] when the address isn't a token on this chain.
export async function goPlusToken(address: string, chain: { id: string; name: string }): Promise<Evidence[]> {
  const data = await getJson(`https://api.gopluslabs.io/api/v1/token_security/${chain.id}?contract_addresses=${address}`);
  const info = data?.result?.[address.toLowerCase()];
  if (!info || Object.keys(info).length === 0) return [];
  const out: Evidence[] = [];
  for (const f of TOKEN_FLAGS) {
    if (String(info[f.key]) === "1") out.push({ claim: `Token on ${chain.name} ${f.label} (GoPlus)`, source: "GoPlus", kind: "verified", severity: f.severity, subject: address });
  }
  const sellTax = Number(info.sell_tax);
  if (Number.isFinite(sellTax) && sellTax >= 0.15) out.push({ claim: `Token on ${chain.name} has a ${Math.round(sellTax * 100)}% sell tax (GoPlus)`, source: "GoPlus", kind: "verified", severity: "medium", subject: address });
  if (String(info.is_open_source) === "0") out.push({ claim: `Token contract on ${chain.name} is not open-source/verified (GoPlus)`, source: "GoPlus", kind: "verified", severity: "medium", subject: address });
  return out;
}

export async function goPlusPhishingSite(host: string): Promise<Evidence[]> {
  const data = await getJson(`https://api.gopluslabs.io/api/v1/phishing_site?url=${encodeURIComponent(host)}`);
  if (data?.result && String(data.result.phishing_site) === "1") {
    return [{ claim: `${host} is a known crypto phishing / wallet-drainer site (GoPlus)`, source: "GoPlus", kind: "verified", severity: "high", subject: host }];
  }
  return [];
}
