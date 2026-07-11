# Scam Shield 🛡️

**Paste any message, link, email, or wallet address — get an instant Safe / Caution / Scam verdict, with the red flags and what to do next.**

An **A2MCP Agent Service Provider** for [OKX.AI](https://www.okx.ai). Serves everyday people (parcel/bank/tax SMS phishing, romance scams, fake job offers) *and* crypto users (drainer sites, fake airdrops, address poisoning, seed-phrase phishing) from one endpoint. Powered by Claude Opus 4.8 (vision) with structured output; billed per call over **x402** and settled in USDT0 on **X Layer**.

See [`BUILD-PLAN.md`](./BUILD-PLAN.md) for the full architecture, roadmap, and risk log.

## Quick start (local, dev mode — no wallet needed)

```bash
npm install
cp .env.example .env          # then set ANTHROPIC_API_KEY
npm run smoke                 # runs the engine on sample scams + a benign message
npm run dev                   # starts the server on :8080 (payments off)
```

Try it:
```bash
curl -s localhost:8080/analyze -H "content-type: application/json" \
  -d '{"text":"ROYAL MAIL: unpaid £1.99 shipping fee, pay within 24h: https://royalmail-redelivery.info/pay"}' | jq
```

Screenshots work too — send `imageBase64` + `imageMediaType`.

## Response shape

```jsonc
{
  "verdict": "safe" | "caution" | "scam",
  "confidence": 0-100,
  "risk_score": 0-100,
  "input_type": "message|email|url|wallet_address|token|job_offer|image|other",
  "title": "...", "summary": "...",
  "red_flags": [{ "label": "...", "detail": "...", "severity": "low|medium|high" }],
  "recommended_actions": ["..."],
  "indicators": { "urls": [], "addresses": [], "emails": [], "phone_numbers": [] },
  "disclaimer": "Risk guidance, not a guarantee. Verify independently."
}
```

## Going live (A2MCP)

1. Fill the OKX section of `.env`: `PAY_TO_ADDRESS` (your Agentic Wallet), `OKX_API_KEY/SECRET/PASSPHRASE`, `PRICE`, and set `PAYMENTS_ENABLED=true`.
2. `npm run build && npm start`, deployed behind public HTTPS.
3. Register + list the ASP on OKX.AI (see `BUILD-PLAN.md` §4, steps A4/A7).

The x402 layer uses the official OKX Payment SDK (`@okxweb3/x402-*`). Before go-live, verify the SDK export names in `src/payment/x402.ts` against `typescript/SELLER.md` in [github.com/okx/payments](https://github.com/okx/payments).

## Layout

```
src/engine/   analysis engine (schema · prompt · analyze)
src/payment/  x402 payment layer (config · x402)
src/index.ts  HTTP server + /analyze route
test/         smoke demo + fixtures
```
