export const NETWORK = "eip155:196"; // X Layer — the only OKX-supported network
export const CHAIN_ID = 196;
export const USDT0_ADDRESS = "0x779Ded0c9e1022225f8E0630b35a9b54bE713736";
export const USDT0_DECIMALS = 6;

export interface PaymentConfig {
  enabled: boolean;
  payTo: string;
  // Explicit atomic { amount, asset }: a "$0.02" USD string makes the SDK call a
  // scheme-side parser ExactEvmScheme doesn't implement ("parsePrice" error).
  price: { amount: string; asset: string };
  maxTimeoutSeconds: number;
  okx: { apiKey: string; secretKey: string; passphrase: string; baseUrl?: string };
}

function toAtomic(price: string, decimals: number): string {
  const decimal = Number(String(price).replace(/[^0-9.]/g, "")) || 0;
  return BigInt(Math.round(decimal * 10 ** decimals)).toString();
}

export function loadPaymentConfig(): PaymentConfig {
  return {
    enabled: process.env.PAYMENTS_ENABLED === "true",
    payTo: process.env.PAY_TO_ADDRESS ?? "",
    price: { amount: toAtomic(process.env.PRICE ?? "0.02", USDT0_DECIMALS), asset: USDT0_ADDRESS },
    maxTimeoutSeconds: Number(process.env.MAX_TIMEOUT_SECONDS ?? 300),
    okx: {
      apiKey: process.env.OKX_API_KEY ?? "",
      secretKey: process.env.OKX_SECRET_KEY ?? "",
      passphrase: process.env.OKX_PASSPHRASE ?? "",
      baseUrl: process.env.OKX_BASE_URL || undefined,
    },
  };
}

export function assertPaymentConfig(c: PaymentConfig): void {
  const missing: string[] = [];
  if (!c.payTo) missing.push("PAY_TO_ADDRESS");
  if (!c.okx.apiKey) missing.push("OKX_API_KEY");
  if (!c.okx.secretKey) missing.push("OKX_SECRET_KEY");
  if (!c.okx.passphrase) missing.push("OKX_PASSPHRASE");
  if (missing.length) {
    throw new Error(`PAYMENTS_ENABLED=true but missing: ${missing.join(", ")}. Set them in .env, or set PAYMENTS_ENABLED=false for dev.`);
  }
}
