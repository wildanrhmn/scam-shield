# Scam Shield — Build Plan & "Perfect Roadway"

*The ASP we're shipping for the OKX.AI Genesis Hackathon. Deadline: X post + Google form by **2026-07-17, 23:59 UTC**. This doc is the single source of truth for how it's built, every known limitation, and exactly what I need from you.*

---

## 0. What we're building (one paragraph)

**Scam Shield** is an **A2MCP** (Agent-to-MCP) Agent Service Provider on OKX.AI. A user (or their agent) sends *any* content — a pasted message, a screenshot, an email, a URL, a wallet address, a token, a job offer — to our public HTTPS endpoint. The endpoint is gated by the **x402** payment standard: the caller pays a small fee per call (settled in USDT/USDG on X Layer), then receives an instant verdict: **SAFE / CAUTION / SCAM**, with the exact red flags and a recommended next step. The analysis engine is **Claude Opus 4.8 (vision)** producing a structured verdict, optionally enriched with **OKX OnchainOS** security checks (token-risk / address / phishing) for crypto inputs.

---

## 1. Architecture

```
 caller's agent
      │  HTTP POST /analyze   { input, type?, image? }
      ▼
┌─────────────────────────────────────────────┐
│  Scam Shield endpoint  (Node + Express, TS)  │
│                                              │
│  1. x402 middleware ──► 402 PAYMENT-REQUIRED │  ← unpaid request
│     (WWW-Authenticate: Payment)              │
│     caller pays ► re-sends with X-PAYMENT    │
│     facilitator verifies+settles on X Layer  │  ← OKX facilitator
│                                              │
│  2. engine.analyze(input)                    │
│     ├─ Claude Opus 4.8 (vision) ► verdict    │  ← Anthropic API
│     └─ enrich (crypto inputs):               │
│        OKX onchainos token/address/phishing  │  ← OKX OnchainOS (optional v1.1)
│        + URL reputation                      │
│                                              │
│  3. return JSON verdict  (HTTP 200)          │
└─────────────────────────────────────────────┘
```

**Language/stack decision:** Node.js + TypeScript.
- x402 has first-class JS middleware (Coinbase `x402-express` reference; OKX facilitator plugs into the same shape).
- OKX OnchainOS Skills are `npx`/JS-native.
- Anthropic TypeScript SDK is first-class (vision + structured outputs).
- Deploys to any public HTTPS host in minutes.

**Registration = A2MCP** (per `okx.ai/tutorial/asp`): the endpoint must be public HTTPS and implement x402; billing is per-call, settled instantly via the OKX Payment SDK. We register with `agent create --role asp` giving name, description, service list, default price, and the endpoint URL.

---

## 2. Milestones

| # | Milestone | Status | Blocked by |
|---|---|---|---|
| M0 | Master the platform + payment spec | ✅ done | — |
| M1 | Project scaffold (config, deps) | ✅ done | — |
| M2 | Analysis engine (Claude → verdict) + fixtures | 🟡 in progress | — |
| M3 | x402 payment layer + endpoint | ✅ built | verify SDK export names on `npm install` |
| M4 | Local end-to-end smoke test | ⬜ | M2, M3 |
| M5 | Deploy to public HTTPS host | ⬜ | **you** (host/domain) |
| M6 | Register + list ASP on OKX.AI | ⬜ | **you** (Agentic Wallet email login) |
| M7 | Pass OKX review → go live | ⬜ | M6 + OKX (~24h) |
| M8 | Record ≤90s demo, post on X (#okxai), submit Google form | ⬜ | **you** + M7 |

Buffer: OKX review takes ~24h and the form is due 07-17 23:59 UTC. **We must be listed and live by ~07-16** to leave margin. Working backward, target **M5 (deploy) by 07-14**.

---

## 3. KNOWN LIMITATIONS & RISKS (read this — no surprises)

These are the things that could bite us. Each has a mitigation.

### R1 — Per-call economics — ✅ DECIDED: Sonnet 5 @ 0.02 USDT/call
A scam analysis on **Opus 4.8** ($5/$25 per 1M tokens) costs roughly **$0.01–0.03 per call** (input + image + output). If we charge the "viral" price of **0.01 USDT**, we may run at a **loss per call** — the opposite of "Revenue Rocket."
- **Mitigation / your call:** choose the model↔price pairing:
  - **Opus 4.8** (best quality) → price at **0.05–0.10 USDT/call** to stay profitable.
  - **Haiku 4.5** ($1/$5, ~5× cheaper) or **Sonnet 5** → enables the **0.01 USDT** ultra-cheap point with margin.
  - The model is a single env var (`MODEL`); we can A/B. Default in code is `claude-opus-4-8`; I'll flag this for your decision before we set the listed price.

### R2 — OKX dev-docs are ISP-blocked on your network
`web3.okx.com/onchainos/dev-docs/...` and the whitepaper PDF redirect to an Indonesian ISP block page (`internet-positif.info`). I've sourced the x402 seller spec + registration flow from the GitHub skill repo instead, but **you may need a VPN** to (a) read the official howtomcp doc, (b) reach the OKX Developer Portal to create API keys, and (c) log into the Agentic Wallet. → see A2 in "What I need from you."

### R3 — x402 facilitator config — ✅ RESOLVED
OKX ships an official Payment SDK (`github.com/okx/payments`; npm `@okxweb3/x402-core` / `-evm` / `-express`). Verified config, now wired in `src/payment/`: network **X Layer `eip155:196`**, token **USDT0** (`0x779Ded…713736`, 6 decimals, gasless EIP-3009), facilitator = `OKXFacilitatorClient` authed with the OKX API triple (base `https://web3.okx.com`), scheme **`exact`**, `payTo` = our Agentic Wallet. **Remaining small risk:** exact SDK export names/paths (e.g. `paymentMiddlewareFromHTTPServer`, `@okxweb3/x402-evm/exact/server`) come from research, not a local install. Mitigation: verify against `typescript/SELLER.md` in the repo at `npm install` time — the payment module is the only file to touch, and it's isolated behind dynamic imports so dev mode is unaffected.

### R4 — False "SAFE" verdicts are the worst failure
Telling someone a scam is safe is reputationally fatal and could fail OKX review. **Mitigation:** the engine is tuned to **err toward CAUTION**, never gives legal/financial guarantees, always shows *why*, and treats "unknown/insufficient info" as CAUTION, not SAFE. Framed as risk guidance, not certainty.

### R5 — Review rejection / can't go live = invalid submission
Per the rules, if the ASP isn't approved or can't go live, the hackathon entry is void. **Mitigation:** keep v1 dead-simple and reliable (single stateless endpoint), clear description, working demo before submitting. Keep **SkinDecode** as a fast pivot only if truly needed.

### R6 — Latency & reliability for the demo
Opus with adaptive thinking can be slow. **Mitigation:** for the pay-per-call path we run a fast, bounded call (low/no extended thinking, tight output schema, streaming disabled for a single compact JSON), target < ~5s. Graceful error handling returns a CAUTION-with-reason rather than a 500.

### R7 — Image inputs / PII
Screenshots may contain personal data. **Mitigation:** we don't persist inputs (stateless), state this in the listing, and cap image size.

---

## 4. WHAT I NEED FROM YOU (your-action checklist)

I'll build everything I can headlessly. These require you (I'll prompt you at the exact moment for each):

- [ ] **A1 — Anthropic (Claude) API key.** From console.anthropic.com → set `ANTHROPIC_API_KEY`. (Powers the engine.) *Or* confirm you want me to use an existing `ant auth login` profile.
- [ ] **A2 — VPN if needed.** To reach `web3.okx.com`, the OKX Developer Portal, and Agentic Wallet from your (filtered) network.
- [ ] **A3 — OKX Developer Portal API keys.** `OKX_API_KEY` / `OKX_SECRET_KEY` / `OKX_PASSPHRASE` (for OnchainOS enrichment + tooling).
- [ ] **A4 — Agentic Wallet email login.** Only you can complete the email login step during ASP registration (I'll give you the exact prompt to run in your agent).
- [ ] **A5 — Public HTTPS host + domain.** The A2MCP endpoint must be public HTTPS. Options: Railway / Render / Fly.io / Vercel (I'll pick and script the deploy; you approve + connect the account). Give me a preference or let me choose.
- [ ] **A6 — Pricing decision (R1).** Model tier + price-per-call.
- [ ] **A7 — ASP listing submission.** Run the `agent create` / `agent list` prompts (I'll hand you exact commands); respond to the OKX review email.
- [ ] **A8 — The X post + Google form.** Record/approve the ≤90s demo, post with **#okxai**, submit the form before 07-17 23:59 UTC.

---

## 5. Project layout

```
scam-shield/
  BUILD-PLAN.md          ← this file
  README.md
  package.json  tsconfig.json  .env.example  .gitignore
  src/
    index.ts             HTTP server + x402-gated /analyze route
    engine/
      schema.ts          verdict schema (zod) + TS types
      prompt.ts          scam-detection system prompt
      analyze.ts         Claude Opus 4.8 vision → structured verdict
      enrich.ts          URL reputation + OKX onchain token/address risk (v1.1)
    payment/
      x402.ts            x402 middleware (configurable facilitator)
      config.ts          network / token / price / pay-to / facilitator URL
    types.ts
  test/
    fixtures/            real scam samples (sms, email, url, address, job)
    analyze.test.ts
    smoke.ts             local end-to-end demo runner
```

---

## 6. Verdict contract (what a caller gets back)

```jsonc
{
  "verdict": "safe" | "caution" | "scam",
  "confidence": 0-100,
  "risk_score": 0-100,
  "input_type": "message|email|url|wallet_address|token|job_offer|image|other",
  "title": "one-line headline",
  "summary": "1–2 sentence plain-language explanation",
  "red_flags": [{ "label": "...", "detail": "...", "severity": "low|medium|high" }],
  "recommended_actions": ["..."],
  "indicators": { "urls": [], "addresses": [], "emails": [], "phone_numbers": [] },
  "disclaimer": "Risk guidance, not a guarantee. Verify independently."
}
```

This shape doubles as the ASP's advertised output and the demo's on-screen card.
