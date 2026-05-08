import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { COMMISSION_BPS, TREASURY_WALLET, computeCommission, isCommissionEnabled } from "@/lib/commission";
import { appConfig, requireEnv } from "@/lib/config";
import { fromRawAmount, toRawAmount } from "@/lib/number";
import type { PreparedTrade, TokenRecommendation } from "@/lib/types";
import { prepareRaydiumDevnetSwap, quoteRaydiumDevnetValue } from "./raydium";

interface BuildSwapParams {
  owner: string;
  inputMint: string;
  outputMint: string;
  amountRaw: string;
  applyCommission?: boolean;
}

export async function prepareBuyTrade(owner: string, amountUsdc: number, recommendation: TokenRecommendation): Promise<PreparedTrade> {
  const amountUsdcRaw = toRawAmount(amountUsdc, appConfig.usdcDecimals);
  if (appConfig.dryRun) {
    return prepareDryRunBuyTrade(owner, amountUsdc, amountUsdcRaw, recommendation);
  }

  if (appConfig.tradeEngine === "raydium-devnet") {
    const raydiumSwap = await prepareRaydiumDevnetSwap(
      owner,
      appConfig.raydiumDevnetInputMint || appConfig.usdcMint,
      appConfig.raydiumDevnetOutputMint || recommendation.mintAddress,
      amountUsdcRaw
    );
    const upside = signedPercent(recommendation.estimatedUpside);
    const downside = Math.abs(signedPercent(recommendation.estimatedDownside));
    const raydiumRecommendation = {
      ...recommendation,
      tokenName: recommendation.tokenName,
      tokenSymbol: recommendation.tokenSymbol,
      mintAddress: appConfig.raydiumDevnetOutputMint || recommendation.mintAddress,
      tokenDecimals: raydiumSwap.outputDecimals,
      nansenSource: `Raydium Devnet CPMM (${raydiumSwap.outputSymbol || "pool token"} execution)`
    };

    return {
      id: crypto.randomUUID(),
      owner,
      inputMint: appConfig.raydiumDevnetInputMint || appConfig.usdcMint,
      outputMint: appConfig.raydiumDevnetOutputMint || recommendation.mintAddress,
      amountUsdc,
      amountUsdcRaw,
      commissionUsdc: 0,
      expectedTokenAmountRaw: raydiumSwap.expectedOutputRaw,
      expectedTokenAmountUi: raydiumSwap.expectedOutputUi,
      expectedReturnUsd: amountUsdc * (upside / 100),
      expectedLossUsd: amountUsdc * (downside / 100),
      recommendation: raydiumRecommendation,
      quoteResponse: raydiumSwap.quoteResponse,
      swapTransaction: raydiumSwap.swapTransaction,
      createdAt: new Date().toISOString()
    };
  }

  const swap = await buildJupiterSwap({
    owner,
    inputMint: appConfig.usdcMint,
    outputMint: recommendation.mintAddress,
    amountRaw: amountUsdcRaw,
    applyCommission: true
  });
  const expectedTokenAmountRaw = String((swap.quoteResponse as { outAmount?: string }).outAmount || "0");
  const tokenDecimals = recommendation.tokenDecimals ?? 6;
  const expectedTokenAmountUi = fromRawAmount(expectedTokenAmountRaw, tokenDecimals);
  const upside = signedPercent(recommendation.estimatedUpside);
  const downside = Math.abs(signedPercent(recommendation.estimatedDownside));

  return {
    id: crypto.randomUUID(),
    owner,
    inputMint: appConfig.usdcMint,
    outputMint: recommendation.mintAddress,
    amountUsdc,
    amountUsdcRaw,
    commissionUsdc: isCommissionEnabled() ? computeCommission(amountUsdc) : 0,
    expectedTokenAmountRaw,
    expectedTokenAmountUi,
    expectedReturnUsd: amountUsdc * (upside / 100),
    expectedLossUsd: amountUsdc * (downside / 100),
    recommendation: { ...recommendation, tokenDecimals },
    quoteResponse: swap.quoteResponse,
    swapTransaction: swap.swapTransaction,
    createdAt: new Date().toISOString()
  };
}

export async function prepareCloseTrade(owner: string, outputMint: string, tokenAmountRaw: string) {
  if (appConfig.dryRun) {
    return {
      quoteResponse: { dryRun: true, inputMint: outputMint, outputMint: appConfig.usdcMint, amount: tokenAmountRaw },
      swapTransaction: ""
    };
  }

  if (appConfig.tradeEngine === "raydium-devnet") {
    return prepareRaydiumDevnetSwap(
      owner,
      outputMint,
      appConfig.raydiumDevnetInputMint || appConfig.usdcMint,
      tokenAmountRaw
    );
  }

  return buildJupiterSwap({
    owner,
    inputMint: outputMint,
    outputMint: appConfig.usdcMint,
    amountRaw: tokenAmountRaw
  });
}

export async function getTokenValueInUsdc(inputMint: string, amountRaw: string) {
  if (appConfig.tradeEngine === "raydium-devnet") {
    return quoteRaydiumDevnetValue(
      inputMint,
      appConfig.raydiumDevnetInputMint || appConfig.usdcMint,
      amountRaw
    );
  }

  const quote = await getQuote(inputMint, appConfig.usdcMint, amountRaw);
  return fromRawAmount(String(quote.outAmount || "0"), appConfig.usdcDecimals);
}

function prepareDryRunBuyTrade(owner: string, amountUsdc: number, amountUsdcRaw: string, recommendation: TokenRecommendation): PreparedTrade {
  const tokenDecimals = recommendation.tokenDecimals ?? 6;
  const assumedTokenPrice = Math.max(0.000001, amountUsdc >= 25 ? 0.25 : 0.05);
  const expectedTokenAmountUi = amountUsdc / assumedTokenPrice;
  const expectedTokenAmountRaw = toRawAmount(expectedTokenAmountUi, tokenDecimals);
  const upside = signedPercent(recommendation.estimatedUpside);
  const downside = Math.abs(signedPercent(recommendation.estimatedDownside));

  return {
    id: crypto.randomUUID(),
    owner,
    inputMint: appConfig.usdcMint,
    outputMint: recommendation.mintAddress,
    amountUsdc,
    amountUsdcRaw,
    commissionUsdc: 0,
    expectedTokenAmountRaw,
    expectedTokenAmountUi,
    expectedReturnUsd: amountUsdc * (upside / 100),
    expectedLossUsd: amountUsdc * (downside / 100),
    recommendation: { ...recommendation, tokenDecimals },
    quoteResponse: { dryRun: true, assumedTokenPrice },
    swapTransaction: "",
    createdAt: new Date().toISOString()
  };
}

async function buildJupiterSwap(params: BuildSwapParams) {
  const quoteResponse = await getQuote(params.inputMint, params.outputMint, params.amountRaw, {
    applyCommission: params.applyCommission
  });
  const swapBody: Record<string, unknown> = {
    quoteResponse,
    userPublicKey: params.owner,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: "auto"
  };

  if (params.applyCommission && isCommissionEnabled()) {
    swapBody.feeAccount = resolveCommissionFeeAccount(params.inputMint);
    swapBody.platformFeeBps = COMMISSION_BPS;
  }

  const response = await fetch(`${appConfig.jupiterSwapBaseUrl}/swap`, {
    method: "POST",
    headers: jupiterHeaders(),
    body: JSON.stringify(swapBody),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jupiter swap build failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as { swapTransaction?: string };
  if (!payload.swapTransaction) {
    throw new Error("Jupiter did not return a swapTransaction.");
  }

  return { quoteResponse, swapTransaction: payload.swapTransaction };
}

async function getQuote(
  inputMint: string,
  outputMint: string,
  amountRaw: string,
  options: { applyCommission?: boolean } = {}
) {
  requireEnv(appConfig.jupiterSwapBaseUrl, "JUPITER_SWAP_BASE_URL");

  const url = new URL(`${appConfig.jupiterSwapBaseUrl}/quote`);
  url.searchParams.set("inputMint", inputMint);
  url.searchParams.set("outputMint", outputMint);
  url.searchParams.set("amount", amountRaw);
  url.searchParams.set("slippageBps", String(appConfig.fixedSlippageBps));
  url.searchParams.set("restrictIntermediateTokens", "true");

  if (options.applyCommission && isCommissionEnabled()) {
    url.searchParams.set("platformFeeBps", String(COMMISSION_BPS));
    // Required for platform fees when a route includes Token2022 tokens.
    url.searchParams.set("instructionVersion", "V2");
  }

  const response = await fetch(url, {
    headers: jupiterHeaders(),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jupiter quote failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

function resolveCommissionFeeAccount(inputMint: string): string {
  try {
    const mint = new PublicKey(inputMint);
    const treasuryWallet = new PublicKey(TREASURY_WALLET);
    return getAssociatedTokenAddressSync(mint, treasuryWallet, false).toBase58();
  } catch {
    throw new Error("Commission is enabled, but TREASURY_WALLET or input mint is invalid.");
  }
}

function jupiterHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (appConfig.jupiterApiKey) {
    headers["x-api-key"] = appConfig.jupiterApiKey;
  }

  return headers;
}

function signedPercent(value: string) {
  const parsed = Number(value.replace("%", "").replace("+", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}
