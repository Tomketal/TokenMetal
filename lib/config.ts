import { COMMISSION_BPS, TREASURY_WALLET } from "@/lib/commission";
import { STELLAR_DECIMALS, defaultHorizonUrl, networkPassphrase, stellarNetwork, usdcAssetId } from "@/lib/stellar/network";

export const appConfig = {
  nansenApiKey: process.env.NANSEN_API_KEY || "",
  nansenAgentUrl: process.env.NANSEN_AGENT_URL || "https://api.nansen.ai/api/v1/agent/fast",
  nansenUseTokenScreener: process.env.NANSEN_USE_TOKEN_SCREENER !== "false",
  nansenTokenScreenerUrl:
    process.env.NANSEN_TOKEN_SCREENER_URL || "https://api.nansen.ai/api/v1/token-screener",

  // -- Stellar ----------------------------------------------------------------
  stellarNetwork,
  networkPassphrase,
  horizonUrl: process.env.STELLAR_HORIZON_URL || defaultHorizonUrl,
  tradeEngine: "sdex",
  usdcAsset: usdcAssetId,
  usdcDecimals: STELLAR_DECIMALS,
  txTimeoutSeconds: Number(process.env.TX_TIMEOUT_SECONDS || 180),

  dryRun: process.env.NEXT_PUBLIC_DRY_RUN === "true",
  fixedSlippageBps: Number(process.env.FIXED_SLIPPAGE_BPS || 75),
  priceCacheTtlMs: Number(process.env.PRICE_CACHE_TTL_MS || 55_000),
  minLiveTradeUsdc: Number(process.env.MIN_LIVE_TRADE_USDC || 1),

  // -- Commission -------------------------------------------------------------
  commissionBps: COMMISSION_BPS,
  treasuryWallet: TREASURY_WALLET
};

export function shouldUseSandboxTrading() {
  return appConfig.dryRun;
}

export function requireEnv(value: string, name: string) {
  if (!value) {
    throw new Error(`${name} is required. Add it to .env.local.`);
  }

  return value;
}
