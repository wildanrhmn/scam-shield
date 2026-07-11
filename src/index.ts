import "dotenv/config";
import express from "express";
import { analyze } from "./engine/analyze.js";
import { createPaymentLayer } from "./payment/x402.js";
import type { AnalyzeInput } from "./types.js";

const PORT = Number(process.env.PORT ?? 8080);
const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === "true";
const ROUTE_KEY = "POST /analyze";

async function main() {
  const app = express();
  app.use(express.json({ limit: "12mb" })); // room for base64 screenshots

  // Human-facing demo card at /demo (machine-readable manifest stays at /).
  app.use("/demo", express.static("public"));

  // Enforce x402 on /analyze when payments are on. In dev mode the route runs
  // open so we can exercise the engine without a wallet.
  let paymentLayer: Awaited<ReturnType<typeof createPaymentLayer>> | null = null;
  if (PAYMENTS_ENABLED) {
    paymentLayer = await createPaymentLayer(ROUTE_KEY);
    app.use(paymentLayer.middleware);
  }

  // Service manifest — mirrors the ASP listing so callers (and OKX review) can
  // see what the endpoint does and how it's priced.
  app.get("/", (_req, res) => {
    res.json({
      name: "Scam Shield",
      tagline:
        "Paste any message, link, email, or wallet address — get an instant Safe / Caution / Scam verdict.",
      endpoint: "POST /analyze",
      input: {
        text: "string (optional)",
        imageBase64: "string (optional)",
        imageMediaType: "string",
        typeHint: "string (optional)",
      },
      price: `${process.env.PRICE ?? "$0.02"} per call`,
      network: "X Layer (eip155:196)",
      payments: PAYMENTS_ENABLED ? "x402 (A2MCP)" : "open (dev mode)",
    });
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.post("/analyze", async (req, res) => {
    const body = (req.body ?? {}) as AnalyzeInput;
    try {
      res.json(await analyze(body));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      // Fail protective: return a CAUTION rather than a bare 500 so a caller is
      // never left with a false sense of safety (BUILD-PLAN R4).
      res.status(400).json({
        verdict: "caution",
        confidence: 0,
        risk_score: 50,
        input_type: "other",
        title: "Could not complete the check",
        summary: `We couldn't analyze this: ${message}. Treat it with caution until verified.`,
        red_flags: [],
        recommended_actions: ["Do not act on the content until you can verify it independently."],
        indicators: { urls: [], addresses: [], emails: [], phone_numbers: [] },
        disclaimer: "Risk guidance, not a guarantee. Verify independently.",
        error: message,
      });
    }
  });

  app.listen(PORT, async () => {
    if (paymentLayer) await paymentLayer.initialize(); // required after listen()
    console.log(`Scam Shield on :${PORT}  (payments: ${PAYMENTS_ENABLED ? "on / x402" : "off / dev"})`);
  });
}

main().catch((err) => {
  console.error("Failed to start Scam Shield:", err);
  process.exit(1);
});
