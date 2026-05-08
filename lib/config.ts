import { COMMISSION_BPS, TREASURY_WALLET } from "@/lib/commission";

export const DEFAULT_SOLANA_RPC_URL = "https://solana-rpc.publicnode.com";

export const appConfig = {
  nansenApiKey: process.env.NANSEN_API_KEY || "",
  nansenAgentUrl: process.env.NANSEN_AGENT_URL || "https://api.nansen.ai/api/v1/agent/fast",
  nansenUseTokenScreener: process.env.NANSEN_USE_TOKEN_SCREENER !== "false",
  nansenTokenScreenerUrl:
    process.env.NANSEN_TOKEN_SCREENER_URL || "https://api.nansen.ai/api/v1/token-screener",
  jupiterApiKey: process.env.JUPITER_API_KEY || "",
  jupiterTriggerApiKey: process.env.JUPITER_TRIGGER_API_KEY || process.env.JUPITER_API_KEY || "",
  jupiterSwapBaseUrl: process.env.JUPITER_SWAP_BASE_URL || "https://api.jup.ag/swap/v1",
  jupiterTriggerBaseUrl: process.env.JUPITER_TRIGGER_BASE_URL || "https://api.jup.ag/trigger/v2",
  tradeEngine: process.env.TRADE_ENGINE || "jupiter",
  solanaRpcUrl:
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    DEFAULT_SOLANA_RPC_URL,
  raydiumDevnetPoolId: process.env.RAYDIUM_DEVNET_POOL_ID || "",
  raydiumDevnetInputMint: process.env.RAYDIUM_DEVNET_INPUT_MINT || "",
  raydiumDevnetOutputMint: process.env.RAYDIUM_DEVNET_OUTPUT_MINT || "",
  dryRun: process.env.NEXT_PUBLIC_DRY_RUN === "true",
  usdcMint:
    process.env.NEXT_PUBLIC_USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  usdcDecimals: Number(process.env.USDC_DECIMALS || 6),
  fixedSlippageBps: Number(process.env.FIXED_SLIPPAGE_BPS || 75),
  priceCacheTtlMs: Number(process.env.PRICE_CACHE_TTL_MS || 55_000),
  triggerOrderExpiryDays: Number(process.env.TRIGGER_ORDER_EXPIRY_DAYS || 30),
  triggerMinOrderUsd: Number(process.env.TRIGGER_MIN_ORDER_USD || 10),
  triggerTpSlippageBps: Number(process.env.TRIGGER_TP_SLIPPAGE_BPS || 100),
  triggerSlSlippageBps: Number(process.env.TRIGGER_SL_SLIPPAGE_BPS || 2000),

  // -- Commission -------------------------------------------------------------
  commissionBps: COMMISSION_BPS,
  treasuryWallet: TREASURY_WALLET
};

export function hasWriteEnabledRpcForLiveTrading() {
  if (appConfig.dryRun) return true;

  const cluster = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "mainnet-beta").toLowerCase();
  if (cluster !== "mainnet-beta") return true;

  const publicRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "";
  const serverRpcUrl = process.env.SOLANA_RPC_URL || "";

  return Boolean(serverRpcUrl) || !isSolanaPublicMainnetRpc(publicRpcUrl);
}

export function shouldUseSandboxTrading() {
  return appConfig.dryRun || !hasWriteEnabledRpcForLiveTrading();
}

export function isSolanaPublicMainnetRpc(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "api.mainnet-beta.solana.com";
  } catch {
    return false;
  }
}

export function requireEnv(value: string, name: string) {
  if (!value) {
    throw new Error(`${name} is required. Add it to .env.local.`);
  }

  return value;
}
