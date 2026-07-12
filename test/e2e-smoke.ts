import "dotenv/config";
import { analyze } from "../src/engine/analyze.js";
async function run(label: string, text: string) {
  const v = await analyze({ text });
  console.log(`\n=== ${label} ===`);
  console.log(`${v.verdict.toUpperCase()} risk=${v.risk_score} conf=${v.confidence} | ${v.title}`);
  console.log("evidence:");
  for (const e of v.evidence) console.log(`  [${e.kind}/${e.severity}] ${e.claim} (${e.source})`);
}
async function main() {
  await run("Google phishing test URL", "Click here to verify: http://testsafebrowsing.appspot.com/s/phishing.html");
  await run("Benign", "Hey, running 10 mins late for lunch, grab us a table!");
}
main().catch(e => console.error("ERR", e));
