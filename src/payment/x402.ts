import type { RequestHandler } from "express";
import { loadPaymentConfig, assertPaymentConfig, NETWORK } from "./config.js";

/**
 * Builds the OKX x402 payment layer for a single A2MCP route.
 *
 * Uses the official OKX Payment SDK (github.com/okx/payments):
 *   @okxweb3/x402-core   — OKXFacilitatorClient, x402ResourceServer, x402HTTPResourceServer
 *   @okxweb3/x402-evm    — ExactEvmScheme (pay-per-call)
 *   @okxweb3/x402-express— paymentMiddlewareFromHTTPServer
 *
 * The SDK is loaded via dynamic import so dev mode (PAYMENTS_ENABLED=false)
 * runs with zero OKX dependencies. Specifiers are cast to `string` so the
 * compiler treats them as opaque runtime imports (no build-time type errors
 * before the packages are installed).
 *
 * ⚠️ VERIFY EXPORT NAMES before go-live: open `typescript/SELLER.md` in the
 * okx/payments repo and confirm the three export names + the ExactEvmScheme
 * import path below still match the installed package versions. If they differ,
 * this file is the only thing to change.
 */

export interface PaymentLayer {
  /** Express middleware that enforces x402 on the configured route. */
  middleware: RequestHandler;
  /** MUST be awaited after app.listen(), before the first request. */
  initialize: () => Promise<void>;
}

export async function createPaymentLayer(routeKey: string): Promise<PaymentLayer> {
  const cfg = loadPaymentConfig();
  assertPaymentConfig(cfg);

  const core: any = await import(("@okxweb3/x402-core") as string);
  const evm: any = await import(("@okxweb3/x402-evm/exact/server") as string);
  const expressPkg: any = await import(("@okxweb3/x402-express") as string);

  const facilitatorClient = new core.OKXFacilitatorClient({
    apiKey: cfg.okx.apiKey,
    secretKey: cfg.okx.secretKey,
    passphrase: cfg.okx.passphrase,
    ...(cfg.okx.baseUrl ? { baseUrl: cfg.okx.baseUrl } : {}),
    syncSettle: true, // confirm settlement on-chain before we deliver the verdict
  });

  const resourceServer = new core.x402ResourceServer(facilitatorClient).register(
    NETWORK,
    new evm.ExactEvmScheme(),
  );

  const httpServer = new core.x402HTTPResourceServer(resourceServer, {
    [routeKey]: {
      accepts: {
        scheme: "exact",
        network: NETWORK,
        payTo: cfg.payTo,
        price: cfg.price, // e.g. "$0.05" — SDK converts to USDT0 atomic units
        maxTimeoutSeconds: cfg.maxTimeoutSeconds,
      },
    },
  });

  return {
    middleware: expressPkg.paymentMiddlewareFromHTTPServer(httpServer),
    initialize: () => resourceServer.initialize(),
  };
}
