import type { RecommendationRequest, TokenRecommendation } from "@/lib/types";
import { loadMarketSnapshot, quoteBuyValueUsd, type TokenMetrics } from "./market";
import {
  boundedScore,
  holdingDays,
  holdingMaturityWeight,
  holdingVolumeWeight,
  profileMatchText,
  riskTargets
} from "./scoring";

// Turns live Stellar market data into three recommendations for the user's
// risk profile, investment amount and holding period.

const DATA_SOURCE = "Stellar Expert + Horizon (mainnet)";
const MAX_CORRELATION = 0.95; // don't hand out XLM and yXLM as two "different" picks
const FALLBACK_QUOTE_USDC = 10;

export interface ScoredToken {
  token: TokenMetrics;
  riskScore: number;
  confidenceScore: number;
  rankScore: number;
}

export async function getStellarRecommendations(request: RecommendationRequest): Promise<TokenRecommendation[]> {
  const tokens = await loadMarketSnapshot();
  const amountUsdc = (request.usdcBalance * request.allocationPercentage) / 100;
  const ranked = rankTokens(tokens, request);

  // Walk the ranking and keep picks that are liquid enough for this amount and
  // not just a copy of a pick we already have.
  const maxImpact = riskTargets[request.riskProfile] < 40 ? 0.02 : 0.035;
  const picks: Array<ScoredToken & { priceImpact: number | null }> = [];
  for (const candidate of ranked) {
    if (picks.length === 3) break;
    if (duplicatesAPick(picks, candidate)) continue;

    const priceImpact = await estimatePriceImpact(candidate.token, amountUsdc > 0 ? amountUsdc : FALLBACK_QUOTE_USDC);
    if (priceImpact !== null && priceImpact > maxImpact) continue;
    picks.push({ ...candidate, priceImpact });
  }

  if (picks.length === 0) throw new Error("No Stellar token currently fits this profile with enough liquidity.");
  return picks.map((pick) => toRecommendation(pick, request, amountUsdc));
}

// Pure scoring shared by the live engine and the backtest.
export function rankTokens(tokens: TokenMetrics[], request: RecommendationRequest) {
  return tokens.map((token) => scoreToken(token, request)).sort((a, b) => b.rankScore - a.rankScore);
}

export function duplicatesAPick(picks: ScoredToken[], candidate: ScoredToken) {
  return picks.some(
    (pick) =>
      underlying(pick.token.code) === underlying(candidate.token.code) ||
      correlation(pick.token.dailyCloses, candidate.token.dailyCloses) > MAX_CORRELATION
  );
}

// Stops scale with the volatility expected over the holding period; cautious
// profiles get tighter stops (capped at ~13% for "very low"), aggressive ones
// a wider reward-to-risk. Returned as fractions (0.1 = 10%).
export function exitLevels(token: TokenMetrics, request: RecommendationRequest) {
  const targetRisk = riskTargets[request.riskProfile];
  const horizonVolatility = token.volatility * Math.sqrt(holdingDays[request.holdingPeriod] / 365);
  const maxStopLoss = 0.08 + (targetRisk / 100) * 0.35;
  const stopLoss = clamp(horizonVolatility * (0.7 + targetRisk / 100), 0.03, maxStopLoss);
  const takeProfit = clamp(stopLoss * (1.5 + targetRisk / 100), 0.05, 1.5);
  return { takeProfit, stopLoss };
}

function scoreToken(token: TokenMetrics, request: RecommendationRequest): ScoredToken {
  const targetRisk = riskTargets[request.riskProfile];
  const volumeWeight = holdingVolumeWeight[request.holdingPeriod];
  const maturityWeight = holdingMaturityWeight[request.holdingPeriod];

  // Risk: mostly realized volatility, then market size (weekly volume as a
  // proxy), thin liquidity, drawdown and a small holder base.
  const volatilityRisk = boundedScore(token.volatility * 33);
  const sizeRisk = boundedScore(90 - Math.log10(token.volume7dUsd + 1) * 10);
  const liquidityRisk = 100 - token.rating.liquidity * 10;
  const drawdownRisk = boundedScore(token.maxDrawdown * 150);
  const holderRisk = token.holders < 10_000 ? 60 : token.holders < 50_000 ? 35 : 10;
  const riskScore = boundedScore(
    volatilityRisk * 0.45 + sizeRisk * 0.15 + liquidityRisk * 0.15 + drawdownRisk * 0.15 + holderRisk * 0.1
  );

  // Risk-adjusted momentum (7d) and trend (30d), centered at 50.
  const momentum = boundedScore(50 + 25 * sharpe(token.return7d, token.volatility, 7));
  const trend = boundedScore(50 + 25 * sharpe(token.return30d, token.volatility, 30));
  const activity = boundedScore(Math.log10(token.volume7dUsd + 1) * 14 - 20);
  const maturity = boundedScore(token.rating.average * 7 + Math.log10(token.holders + 1) * 4);

  const horizonFit =
    (activity * volumeWeight + momentum * volumeWeight + maturity * maturityWeight + trend * maturityWeight) /
    (2 * volumeWeight + 2 * maturityWeight);
  const riskFit = boundedScore(100 - Math.abs(riskScore - targetRisk) * 1.5);
  const dataQuality = (token.tradeDays / token.dailyCloses.length) * 100;

  return {
    token,
    riskScore,
    confidenceScore: boundedScore(riskFit * 0.5 + horizonFit * 0.3 + dataQuality * 0.2),
    rankScore: riskFit * 1.6 + horizonFit
  };
}

function toRecommendation(
  pick: ScoredToken & { priceImpact: number | null },
  request: RecommendationRequest,
  amountUsdc: number
): TokenRecommendation {
  const { token, riskScore, confidenceScore } = pick;
  const { takeProfit, stopLoss } = exitLevels(token, request);
  const sl = Math.round(stopLoss * 100);
  const tp = Math.round(takeProfit * 100);

  const impactText =
    pick.priceImpact === null
      ? ""
      : ` A ${round(amountUsdc > 0 ? amountUsdc : FALLBACK_QUOTE_USDC)} USDC buy costs about ${(pick.priceImpact * 100).toFixed(2)}% in spread and price impact.`;

  return {
    id: `${token.assetId}-${request.riskProfile}-${request.holdingPeriod}`.replaceAll(" ", "-"),
    tokenName: token.name,
    tokenSymbol: token.code,
    mintAddress: token.assetId,
    tokenDecimals: 7,
    confidenceScore: Math.round(confidenceScore),
    riskScore: Math.round(riskScore),
    expectedHoldingPeriod: request.holdingPeriod,
    entryRationale:
      `${token.code}: ${signedPct(token.return30d)} over 30 days (${signedPct(token.return7d)} in 7 days), ` +
      `${Math.round(token.volatility * 100)}% annualized volatility, ${token.holders.toLocaleString("en-US")} holders, ` +
      `$${Math.round(token.volume7dUsd).toLocaleString("en-US")} traded this week, liquidity ${token.rating.liquidity}/10 on the Stellar DEX.` +
      impactText,
    takeProfit: `+${tp}%`,
    stopLoss: `-${sl}%`,
    trailingStop: riskScore >= 65 ? `${Math.max(5, Math.round(sl * 0.8))}% after +${Math.round(tp * 0.5)}% move` : undefined,
    estimatedUpside: `+${tp}%`,
    estimatedDownside: `-${sl}%`,
    profileMatch: profileMatchText(Math.round(riskScore), request.riskProfile, request.holdingPeriod),
    nansenSource: DATA_SOURCE
  };
}

async function estimatePriceImpact(token: TokenMetrics, amountUsdc: number) {
  try {
    const valueUsd = await quoteBuyValueUsd(token, amountUsdc);
    if (valueUsd <= 0) return 1;
    return Math.max(0, 1 - valueUsd / amountUsdc);
  } catch {
    return null;
  }
}

// Yield/lightning wrappers track the same asset: yXLM -> XLM, BTCLN -> BTC, yETH -> ETH.
function underlying(code: string) {
  return code.toUpperCase().replace(/^Y(?=[A-Z]{3})/, "").replace(/LN$/, "");
}

function sharpe(periodReturn: number, annualVolatility: number, days: number) {
  const periodVolatility = annualVolatility * Math.sqrt(days / 365);
  return periodVolatility > 0 ? periodReturn / periodVolatility : 0;
}

function correlation(a: number[], b: number[]) {
  const ra = logReturns(a);
  const rb = logReturns(b);
  const n = Math.min(ra.length, rb.length);
  if (n < 5) return 0;
  const meanA = ra.slice(-n).reduce((s, v) => s + v, 0) / n;
  const meanB = rb.slice(-n).reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = ra[ra.length - n + i] - meanA;
    const db = rb[rb.length - n + i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  return varA > 0 && varB > 0 ? cov / Math.sqrt(varA * varB) : 0;
}

function logReturns(closes: number[]) {
  return closes.slice(1).map((close, index) => Math.log(close / closes[index]));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function signedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
