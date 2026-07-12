import "dotenv/config";
import { extractEntities } from "../src/enrich/extract.js";
import { safeBrowsing, domainAge, urlStructure } from "../src/enrich/url.js";

async function main() {
  const sample =
    "ROYAL MAIL: unpaid £1.99 fee, pay at https://royalmail-redelivery.info/pay or call +44 7911 123456. " +
    "Test: http://testsafebrowsing.appspot.com/s/phishing.html  wallet 0x4eb6ee8db40b9a89f9ebe0622d6d2fab69ea993a";
  const ents = extractEntities(sample);
  console.log("=== entities ===");
  for (const e of ents) console.log(` ${e.type}: ${e.value}`);

  const urls = ents.filter((e) => e.type === "url").map((e) => e.value);
  const domains = ents.filter((e) => e.type === "domain").map((e) => e.value);

  console.log("\n=== Safe Browsing ===");
  console.log(await safeBrowsing(urls));

  console.log("\n=== Domain age ===");
  for (const d of domains) console.log(d, "→", await domainAge(d));

  console.log("\n=== URL structure ===");
  for (const u of urls) console.log(u, "→", urlStructure(u).map((e) => e.claim));
}
main();
