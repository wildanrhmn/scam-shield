/**
 * x402 / OKX payment configuration for the A2MCP endpoint.
 *
 * Verified against the OKX Payment SDK (github.com/okx/payments):
 *  - Network is X Layer only, CAIP-2 `eip155:196` (chain id 196).
 *  - Default settlement token is USDT0 (6 decimals, EIP-3009 gasless).
 *  - payTo = this ASP's OKX Agentic Wallet address.
 *  - Facilitator = OKXFacilitatorClient, authed with the OKX API triple.
 */

export const NETWORK = "eip155:196"; // X Layer — the only OKX-supported network
export const CHAIN_ID = 196;

/** USDT0 on X Layer (SDK default). 6 decimals, gasless via EIP-3009. */
export const USDT0_ADDRESS = "0x779Ded0c9e1022225f8E0630b35a9b54bE713736";

export interface PaymentConfig {
  enabled: boolean;
  payTo: string;
  /** Price accepted by the SDK: "$0.05" | 0.05 | { asset, amount } */
  price: string;
  maxTimeoutSeconds: number;
  okx: { apiKey: string; secretKey: string; passphrase: string; baseUrl?: string };
}

export function loadPaymentConfig(): PaymentConfig {
  return {
    enabled: process.env.PAYMENTS_ENABLED === "true",
    payTo: process.env.PAY_TO_ADDRESS ?? "",
    price: process.env.PRICE ?? "$0.02",
    maxTimeoutSeconds: Number(process.env.MAX_TIMEOUT_SECONDS ?? 300),
    okx: {
      apiKey: process.env.OKX_API_KEY ?? "",
      secretKey: process.env.OKX_SECRET_KEY ?? "",
      passphrase: process.env.OKX_PASSPHRASE ?? "",
      baseUrl: process.env.OKX_BASE_URL || undefined, // defaults to https://web3.okx.com in the SDK
    },
  };
}

/** Fail fast with a clear message if payments are on but misconfigured. */
export function assertPaymentConfig(c: PaymentConfig): void {
  const missing: string[] = [];
  if (!c.payTo) missing.push("PAY_TO_ADDRESS");
  if (!c.okx.apiKey) missing.push("OKX_API_KEY");
  if (!c.okx.secretKey) missing.push("OKX_SECRET_KEY");
  if (!c.okx.passphrase) missing.push("OKX_PASSPHRASE");
  if (missing.length) {
    throw new Error(
      `PAYMENTS_ENABLED=true but missing: ${missing.join(", ")}. ` +
        `Set them in .env (OKX Developer Portal credentials + your Agentic Wallet address), or set PAYMENTS_ENABLED=false for dev.`,
    );
  }
}
