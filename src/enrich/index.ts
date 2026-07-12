import type { Entity, Evidence } from "./types.js";
import { extractEntities, hostOf } from "./extract.js";
import { safeBrowsing, domainAge, urlStructure, isShortener, expandUrl } from "./url.js";
import { goPlusAddress, goPlusPhishingSite, goPlusToken, TOKEN_CHAINS } from "./crypto.js";
import { ofacCheck } from "./ofac.js";
import { vtUrl, vtDomain } from "./virustotal.js";
import { checkBrand } from "./brand.js";
import { checkEmailHeaders } from "./email.js";

export type { Evidence, Entity } from "./types.js";

export interface EnrichResult {
  entities: Entity[];
  evidence: Evidence[];
}

const MAX = 8; // per-type cap to bound cost/latency/abuse
const uniq = (a: string[]) => [...new Set(a)];

export async function enrich(text: string): Promise<EnrichResult> {
  const entities = extractEntities(text);

  let urls = uniq(entities.filter((e) => e.type === "url").map((e) => e.value)).slice(0, MAX);
  let domains = uniq(entities.filter((e) => e.type === "domain").map((e) => e.value)).slice(0, MAX);
  const ethAddrs = uniq(entities.filter((e) => e.type === "eth_address").map((e) => e.value)).slice(0, MAX);
  const solAddrs = uniq(entities.filter((e) => e.type === "sol_address").map((e) => e.value)).slice(0, MAX);
  const emailDomains = uniq(entities.filter((e) => e.type === "email").map((e) => e.value.split("@")[1]).filter(Boolean)).slice(0, MAX);

  const evidence: Evidence[] = [];

  // Expand shortened links so we validate the true destination.
  const shorteners = urls.filter(isShortener);
  if (shorteners.length) {
    const expanded = await Promise.allSettled(shorteners.map(expandUrl));
    expanded.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value.hops > 0 && r.value.finalUrl !== shorteners[i]) {
        const dest = r.value.finalUrl;
        evidence.push({ claim: `Shortened link "${shorteners[i]}" redirects to ${dest}`, source: "redirect follow", kind: "verified", severity: "low", subject: shorteners[i] });
        urls.push(dest);
        const h = hostOf(dest);
        if (h) domains.push(h);
      }
    });
    urls = uniq(urls).slice(0, MAX);
    domains = uniq(domains).slice(0, MAX);
  }

  const tasks: Promise<Evidence[]>[] = [];
  tasks.push(Promise.resolve(checkEmailHeaders(text)));
  if (urls.length) tasks.push(safeBrowsing(urls));
  for (const u of urls) {
    tasks.push(Promise.resolve(urlStructure(u)));
    tasks.push(vtUrl(u));
  }
  for (const d of domains) {
    tasks.push(Promise.resolve(checkBrand(d)));
    tasks.push(domainAge(d));
    tasks.push(goPlusPhishingSite(d));
    tasks.push(vtDomain(d));
  }
  for (const d of emailDomains) tasks.push(domainAge(d));
  for (const a of [...ethAddrs, ...solAddrs]) tasks.push(goPlusAddress(a));
  for (const a of ethAddrs) {
    tasks.push(ofacCheck(a));
    for (const chain of TOKEN_CHAINS) tasks.push(goPlusToken(a, chain));
  }

  const settled = await Promise.allSettled(tasks);
  for (const r of settled) if (r.status === "fulfilled") evidence.push(...r.value);
  return { entities, evidence };
}
