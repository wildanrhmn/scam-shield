# Deploying Scaminja

The A2MCP endpoint must be reachable at a **public HTTPS URL**. The repo ships a
`Dockerfile` (portable to any host) and a `render.yaml` blueprint. Two easy paths:

## Option A — Railway (fastest)
1. Push this folder to a GitHub repo.
2. railway.app → **New Project → Deploy from GitHub repo** → pick it. Railway
   detects the Dockerfile and builds automatically.
3. **Variables** tab → add the env vars from the checklist below.
4. **Settings → Networking → Generate Domain** → you get `https://<name>.up.railway.app`.
5. Confirm: open `https://<domain>/health` → `{"ok":true}`.

## Option B — Render (blueprint)
1. Push to GitHub.
2. render.com → **New → Blueprint** → select the repo. It reads `render.yaml`.
3. Fill the `sync:false` secrets when prompted.
4. Deploy → you get `https://scam-shield.onrender.com`. Check `/health`.
   *(Free tier sleeps when idle; the first call after a nap is slow — fine for the demo, but Railway or a paid Render instance is steadier for judging.)*

## Env var checklist (set in the host dashboard, never in git)
| Var | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your Claude key |
| `MODEL` | `claude-sonnet-5` |
| `PRICE` | `$0.02` |
| `PAYMENTS_ENABLED` | `true` (once the OKX vars below are set) |
| `PAY_TO_ADDRESS` | your OKX Agentic Wallet address |
| `OKX_API_KEY` / `OKX_SECRET_KEY` / `OKX_PASSPHRASE` | OKX Developer Portal |

> Deploy first with `PAYMENTS_ENABLED=false` to smoke-test the live URL, then
> flip it to `true` once the OKX wallet + keys are in and you've verified the
> SDK export names (see `src/payment/x402.ts`).

## Local Docker sanity check (optional)
```bash
docker build -t scam-shield .
docker run --rm -p 8080:8080 --env-file .env scam-shield
curl localhost:8080/health
```

## The endpoint URL you'll register on OKX.AI
`https://<your-domain>/analyze`  — this is what goes in the A2MCP service's
endpoint field during `agent create` (see BUILD-PLAN §4).
