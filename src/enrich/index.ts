import type { Entity, Evidence } from "./types.js";
import { extractEntities } from "./extract.js";
import { safeBrowsing, domainAge, urlStructure } from "./url.js";
import { goPlusAddress, goPlusPhishingSite } from "./crypto.js";
import { ofacCheck } from "./ofac.js";

export type { Evidence, Entity } from "./types.js";

export interface EnrichResult {
  entities: Entity[];
  evidence: Evidence[];
}

// Cap per-type to bound cost/latency/abuse (a message with 100 URLs shouldn't fan out to 100 lookups).
const MAX = 8;

/**
 * Extract entities from the input and validate each against authoritative
 * sources, in parallel. Returns verified evidence (and benign confirmations).
 */
export async function enrich(text: string): Promise<EnrichResult> {
  const entities = extractEntities(text);

  const urls = entities.filter((e) => e.type === "url").map((e) => e.value).slice(0, MAX);
  const domains = entities.filter((e) => e.type === "domain").map((e) => e.value).slice(0, MAX);
  const ethAddrs = entities.filter((e) => e.type === "eth_address").map((e) => e.value).slice(0, MAX);
  const solAddrs = entities.filter((e) => e.type === "sol_address").map((e) => e.value).slice(0, MAX);
  const emailDomains = entities
    .filter((e) => e.type === "email")
    .map((e) => e.value.split("@")[1])
    .filter(Boolean)
    .slice(0, MAX);

  const tasks: Promise<Evidence[]>[] = [];
  if (urls.length) tasks.push(safeBrowsing(urls));
  for (const u of urls) tasks.push(Promise.resolve(urlStructure(u)));
  for (const d of domains) {
    tasks.push(domainAge(d));
    tasks.push(goPlusPhishingSite(d));
  }
  for (const d of emailDomains) tasks.push(domainAge(d)); // sender-domain age
  for (const a of [...ethAddrs, ...solAddrs]) tasks.push(goPlusAddress(a));
  for (const a of ethAddrs) tasks.push(ofacCheck(a));

  const settled = await Promise.allSettled(tasks);
  const evidence = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return { entities, evidence };
}
