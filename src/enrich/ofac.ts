import type { Evidence } from "./types.js";

// Authoritative US Treasury OFAC sanctioned crypto addresses (maintained mirror of
// the SDN list). Cached in-memory; GoPlus coverage has gaps, this closes sanctions.
const LIST_URL =
  "https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_ETH.txt";
const TTL_MS = 6 * 3600 * 1000;

let cache: { at: number; set: Set<string> } | null = null;

async function loadList(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.set;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(LIST_URL, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return cache?.set ?? new Set();
    const text = await res.text();
    const set = new Set(text.split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter(Boolean));
    cache = { at: Date.now(), set };
    return set;
  } catch {
    return cache?.set ?? new Set();
  }
}

export async function ofacCheck(address: string): Promise<Evidence[]> {
  const set = await loadList();
  if (set.has(address.toLowerCase())) {
    return [{
      claim: "Address is on the US Treasury OFAC sanctions list (SDN)",
      source: "OFAC SDN",
      kind: "verified",
      severity: "high",
      subject: address,
    }];
  }
  return [];
}
