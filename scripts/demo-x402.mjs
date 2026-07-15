// Cinematic one-shot x402 demo: an agent pays for a Scaminja check on-chain.
//
//   REAL run (buyer wallet, settles once):
//     $env:EVM_PRIVATE_KEY="0x..."      # PowerShell   (or: export EVM_PRIVATE_KEY=0x...  in bash)
//     node scripts/demo-x402.mjs
//
//   DRY runs for recording takes (no payment, no soldCount bump, identical output):
//     node scripts/demo-x402.mjs --dry-run --tx 0xTHE_REAL_TX_FROM_YOUR_REAL_RUN
//
//   Optional custom text:  node scripts/demo-x402.mjs "is 0xabc... a safe token?"
//
// REAL run needs: VPN on (facilitator reachable) and >= 0.02 USDT0 in the buyer wallet.
// If EVM_PRIVATE_KEY is unset it falls back to `payment pay` (your TEE agent wallet).
import { execFileSync } from "node:child_process";

const EXE = "C:\\Users\\wilda\\.local\\bin\\onchainos.exe";
const URL = "https://scaminja.app/x402/analyze";
const TRY = "https://scaminja.app/try";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const txFlag = args.indexOf("--tx");
const DEMO_TX = txFlag !== -1 ? args[txFlag + 1] : "0x…(paste your real tx here)";
const TEXT = args.find((a) => !a.startsWith("--") && a !== DEMO_TX) ||
  "Is this airdrop safe? https://arb-airdrop-claim.net — connect wallet and confirm your seed phrase to claim 1,500 ARB";
const body = JSON.stringify({ text: TEXT });
const JSON_H = { "content-type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const c = { cy: "\x1b[36m", ye: "\x1b[33m", gr: "\x1b[32m", di: "\x1b[90m", bo: "\x1b[1m", rs: "\x1b[0m" };

console.log(`\n${c.bo}${c.cy}▶  An AI agent asks Scaminja to check a message${c.rs}`);
console.log(`${c.di}   POST ${URL}${c.rs}`);
await sleep(900);

// The 402 challenge is public + free to fetch (no payment), so we show the real one either way.
let r = await fetch(URL, { method: "POST", headers: JSON_H, body });
if (r.status !== 402) { console.log(`Expected 402, got ${r.status}. Is PAYMENTS_ENABLED on?`); process.exit(1); }
const challenge = r.headers.get("payment-required");
const dec = JSON.parse(Buffer.from(challenge, "base64").toString());
const a = dec.accepts[0];
console.log(`\n${c.ye}●  HTTP 402 Payment Required${c.rs}`);
console.log(`   amount  : ${c.bo}${Number(a.amount) / 10 ** a.extra.decimals} USDT0${c.rs}`);
console.log(`   network : ${a.network}  ${c.di}(X Layer)${c.rs}`);
console.log(`   pay to  : ${a.payTo}`);
await sleep(1400);

let verdict, tx;

if (DRY) {
  // Re-enact a run you already performed for real: same visuals, no settlement,
  // verdict pulled from the free engine so it's genuine.
  console.log(`\n${c.cy}▶  Signing the x402 payment authorization (TEE)…${c.rs}`);
  await sleep(900);
  console.log(`   ${c.gr}✔ authorization signed${c.rs}`);
  await sleep(700);
  console.log(`\n${c.cy}▶  Replaying the request with payment…${c.rs}`);
  await sleep(700);
  tx = DEMO_TX;
  console.log(`   ${c.gr}✔ settled on X Layer${c.rs}  ${c.di}tx ${tx}${c.rs}`);
  verdict = await (await fetch(TRY, { method: "POST", headers: JSON_H, body })).json();
} else {
  const cmd = process.env.EVM_PRIVATE_KEY ? "pay-local" : "pay";
  console.log(`\n${c.cy}▶  Signing the x402 payment authorization…${c.rs}`);
  const out = execFileSync(EXE, ["payment", cmd, "--payload", challenge], { encoding: "utf8" });
  const p = (JSON.parse(out).data) || JSON.parse(out);
  console.log(`   scheme  : ${p.scheme}`);
  console.log(`   from    : ${p.wallet}`);
  console.log(`   ${c.gr}✔ authorization signed${c.rs}`);
  await sleep(1000);

  console.log(`\n${c.cy}▶  Replaying the request with payment…${c.rs}`);
  r = await fetch(URL, { method: "POST", headers: { ...JSON_H, [p.header_name]: p.authorization_header }, body });
  const settleRaw = r.headers.get("x-payment-response") || r.headers.get("payment-response");
  verdict = await r.json();
  if (settleRaw) {
    try { const s = JSON.parse(Buffer.from(settleRaw, "base64").toString()); tx = s.transaction || s.txHash || s.tx || s.transactionHash; } catch { /* */ }
  }
  console.log(`   ${c.gr}✔ settled on X Layer${c.rs}${tx ? `  ${c.di}tx ${tx}${c.rs}` : `  ${c.di}(HTTP ${r.status})${c.rs}`}`);
  if (tx) console.log(`\n${c.bo}${c.ye}   ↑ save this tx for your recording takes:  --tx ${tx}${c.rs}`);
}
await sleep(900);

const v = verdict;
console.log(`\n${c.bo}${c.gr}●  VERDICT${c.rs}`);
console.log(`   ${c.bo}${String(v.verdict).toUpperCase()}${c.rs}  ·  risk ${v.risk_score}/100  ·  confidence ${v.confidence}%`);
console.log(`   ${v.title}`);
for (const e of (v.evidence || []).slice(0, 2)) console.log(`   ${c.di}– ${e.claim} [${e.source}]${c.rs}`);
console.log();
