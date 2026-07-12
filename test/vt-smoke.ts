import "dotenv/config";
import { vtUrl, vtDomain } from "../src/enrich/virustotal.js";
import { goPlusToken } from "../src/enrich/crypto.js";
async function main() {
  console.log("vtUrl(phishing test):", await vtUrl("http://testsafebrowsing.appspot.com/s/phishing.html"));
  console.log("vtDomain(google.com):", await vtDomain("google.com"));
  // USDC on Ethereum — a known, clean, verified token (sanity check the call + parse)
  console.log("goPlusToken(USDC/eth):", await goPlusToken("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", { id: "1", name: "Ethereum" }));
}
main().catch(e => console.error("ERR", e));
