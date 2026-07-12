import "dotenv/config";
import { enrich } from "../src/enrich/index.js";
async function main() {
  const email = `From: "PayPal Support" <service@paypal-secure-login.info>
Authentication-Results: mx.google.com; spf=fail smtp.mailfrom=paypal-secure-login.info; dkim=fail; dmarc=fail
Subject: Account limited
Your PayPal account is limited. Verify now at https://paypal-secure-login.info/verify`;
  const r = await enrich(email);
  console.log("entities:", r.entities.map(e => `${e.type}:${e.value}`).join("  "));
  console.log("\nevidence:");
  for (const e of r.evidence) console.log(`  [${e.kind}/${e.severity}] ${e.claim}  <${e.source}>`);
}
main().catch(e => console.error("ERR", e));
