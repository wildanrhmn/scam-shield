import { goPlusAddress } from "../src/enrich/crypto.js";
async function main() {
  const clean = "0x4eb6ee8db40b9a89f9ebe0622d6d2fab69ea993a";
  const bad = "0x8589427373D6D84E98730D7795D8f6f8731FDA16"; // Tornado Cash (OFAC)
  console.log("=== clean wallet ==="); console.log(await goPlusAddress(clean));
  console.log("=== sanctioned (Tornado Cash) ==="); console.log(await goPlusAddress(bad));
}
main().catch(e => console.error("ERR", e));
