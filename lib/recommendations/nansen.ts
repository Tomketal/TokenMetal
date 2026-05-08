import { appConfig, requireEnv } from "@/lib/config";
import type { RecommendationRequest, TokenRecommendation } from "@/lib/types";
import { normalizeNansenRows, normalizeRecommendationPayload, scoreNansenRows } from "./scoring";

export async function getNansenRecommendations(request: RecommendationRequest): Promise<TokenRecommendation[]> {
  requireEnv(appConfig.nansenApiKey, "NANSEN_API_KEY");

  if (!appConfig.nansenUseTokenScreener) {
    return callNansenAgent(request);
  }

  try {
    return await callTokenScreener(request, {
      timeframe: "24h",
      perPage: 100,
      onlySmartMoney: true
    });
  } catch (primaryError) {
    // Nansen may return 500 "Query timed out" for wider screener windows.
    // Retry once with a lighter query before falling back to the agent endpoint.
    if (!isLikelyTimeout(primaryError)) throw primaryError;

    try {
      return await callTokenScreener(request, {
        timeframe: "6h",
        perPage: 40,
        onlySmartMoney: true
      });
    } catch (retryError) {
      try {
        return await callNansenAgent(request);
      } catch (agentError) {
        throw new Error(
          [
            messageFrom(primaryError),
            messageFrom(retryError),
            messageFrom(agentError)
          ].join(" | ")
        );
      }
    }
  }
}

async function callNansenAgent(request: RecommendationRequest) {
  const response = await fetch(appConfig.nansenAgentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apiKey: appConfig.nansenApiKey
    },
    body: JSON.stringify(buildAgentFastPayload(request)),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Nansen recommendation agent failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const directRecommendations = normalizeRecommendationPayload(payload);
  if (directRecommendations.length >= 3) return directRecommendations;

  const rows = normalizeNansenRows(payload);
  const recommendations = scoreNansenRows(rows, request);

  if (recommendations.length < 3) {
    throw new Error("Nansen agent response did not contain 3 normalizable token recommendations.");
  }

  return recommendations;
}

async function callTokenScreener(
  request: RecommendationRequest,
  options: { timeframe: string; perPage: number; onlySmartMoney: boolean }
) {
  const response = await fetch(appConfig.nansenTokenScreenerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apiKey: appConfig.nansenApiKey
    },
    body: JSON.stringify({
      chains: ["solana"],
      timeframe: options.timeframe,
      filters: {
        only_smart_money: options.onlySmartMoney,
        token_age_days: {
          max: 365,
          min: 1
        }
      },
      order_by: [
        { field: "buy_volume", direction: "DESC" }
      ],
      pagination: { page: 1, per_page: options.perPage }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Nansen Token Screener failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const rows = normalizeNansenRows(payload);
  const recommendations = scoreNansenRows(rows, request);

  if (recommendations.length < 3) {
    throw new Error("Nansen returned fewer than 3 usable Solana token rows.");
  }

  return recommendations;
}

function isLikelyTimeout(error: unknown) {
  const message = messageFrom(error).toLowerCase();
  return message.includes("timed out") || message.includes("timeout") || message.includes("request timeout");
}

function messageFrom(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function buildAgentFastPayload(request: RecommendationRequest) {
  return {
    query: [
      "You are powering Token-Metal, a simple Solana investing assistant for normie onboarding.",
      "Return exactly 3 Solana token opportunities ranked best to worst.",
      "Use live Nansen intelligence. Do not invent unsupported token data.",
      "The user connected this wallet:",
      request.walletAddress,
      `USDC balance: ${request.usdcBalance}`,
      `Risk profile: ${request.riskProfile}`,
      `Capital allocation: ${request.allocationPercentage}%`,
      `Expected holding period: ${request.holdingPeriod}`,
      "Only recommend tokens tradable on Solana via Jupiter where possible.",
      "Return strict JSON with a top-level recommendations array. Each item must include: tokenName, tokenSymbol, mintAddress, confidenceScore, riskScore, expectedHoldingPeriod, entryRationale, takeProfit, stopLoss, trailingStop, estimatedUpside, estimatedDownside, profileMatch."
    ].join("\n"),
    context: {
      product: "Token-Metal",
      chain: "solana",
      walletAddress: request.walletAddress,
      usdcBalance: request.usdcBalance,
      riskProfile: request.riskProfile,
      allocationPercentage: request.allocationPercentage,
      holdingPeriod: request.holdingPeriod
    },
    response_format: {
      type: "json_object"
    }
  };
}
