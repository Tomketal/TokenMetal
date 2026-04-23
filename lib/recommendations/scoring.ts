import type { HoldingPeriod, RecommendationRequest, RiskProfile, TokenRecommendation } from "@/lib/types";

const riskTargets: Record<RiskProfile, number> = {
  "very low": 15,
  low: 28,
  "medium low": 40,
  medium: 52,
  "medium high": 65,
  high: 78,
  "very high": 90
};

const holdingMultipliers: Record<HoldingPeriod, number> = {
  "3 days": 0.85,
  "1 week": 0.95,
  "1 month": 1,
  "3 months": 1.08,
  "6 months": 1.12,
  "more than 6 months": 1.18,
  "I don't care / I HODL": 1.22
};

const holdingVolumeWeight: Record<HoldingPeriod, number> = {
  "3 days": 1.55,
  "1 week": 1.35,
  "1 month": 1.05,
  "3 months": 0.85,
  "6 months": 0.7,
  "more than 6 months": 0.6,
  "I don't care / I HODL": 0.55
};

const holdingMaturityWeight: Record<HoldingPeriod, number> = {
  "3 days": 0.55,
  "1 week": 0.7,
  "1 month": 1,
  "3 months": 1.25,
  "6 months": 1.45,
  "more than 6 months": 1.6,
  "I don't care / I HODL": 1.75
};

export function normalizeNansenRows(payload: unknown): Record<string, unknown>[] {
  const parsedPayload = parseJsonishPayload(payload);
  if (parsedPayload !== payload) return normalizeNansenRows(parsedPayload);

  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const candidates = [
    root.recommendations,
    root.opportunities,
    root.data,
    root.result,
    root.response,
    root.output,
    root.answer,
    root.rows,
    root.tokens,
    root.items,
    payload
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
    if (candidate && typeof candidate === "object") {
      const objectCandidate = candidate as Record<string, unknown>;
      for (const value of Object.values(objectCandidate)) {
        if (Array.isArray(value)) return value.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
      }
    }
  }

  return [];
}

function parseJsonishPayload(payload: unknown): unknown {
  if (typeof payload !== "string") return payload;
  const trimmed = payload.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    return payload;
  }
}

export function normalizeRecommendationPayload(payload: unknown): TokenRecommendation[] {
  const rows = normalizeNansenRows(payload);

  return rows
    .flatMap((row, index): TokenRecommendation[] => {
      const mint = stringField(row, ["mintAddress", "mint_address", "token_address", "contract_address", "mint", "address"]);
      if (!mint) return [];

      const tokenDecimals = numberField(row, ["tokenDecimals", "token_decimals", "decimals"]) || undefined;
      return [{
        id: stringField(row, ["id"]) || `${mint}-${index}`,
        tokenName: stringField(row, ["tokenName", "token_name", "name"]) || stringField(row, ["tokenSymbol", "token_symbol", "symbol"]) || `Token ${index + 1}`,
        tokenSymbol: stringField(row, ["tokenSymbol", "token_symbol", "symbol", "ticker"]) || `TOKEN${index + 1}`,
        mintAddress: mint,
        ...(tokenDecimals ? { tokenDecimals } : {}),
        confidenceScore: numberField(row, ["confidenceScore", "confidence_score", "confidence"]) || 50,
        riskScore: numberField(row, ["riskScore", "risk_score", "risk"]) || 50,
        expectedHoldingPeriod: stringField(row, ["expectedHoldingPeriod", "expected_holding_period", "holding_period"]) || "1 week",
        entryRationale: stringField(row, ["entryRationale", "suggested_entry_rationale", "rationale"]) || "Recommended by the configured Nansen agent.",
        takeProfit: stringField(row, ["takeProfit", "take_profit"]) || "+10%",
        stopLoss: stringField(row, ["stopLoss", "stop_loss"]) || "-5%",
        trailingStop: stringField(row, ["trailingStop", "trailing_stop"]) || undefined,
        estimatedUpside: stringField(row, ["estimatedUpside", "estimated_upside", "upside"]) || "+10%",
        estimatedDownside: stringField(row, ["estimatedDownside", "estimated_downside", "downside"]) || "-5%",
        profileMatch: stringField(row, ["profileMatch", "why_this_token_matches_the_user_profile", "why"]) || "Matches the selected profile according to Nansen signals.",
        nansenSource: stringField(row, ["nansenSource", "source"]) || "Nansen Agent"
      }];
    })
    .slice(0, 3);
}

export function scoreNansenRows(rows: Record<string, unknown>[], request: RecommendationRequest): TokenRecommendation[] {
  const targetRisk = riskTargets[request.riskProfile];
  const holdingMultiplier = holdingMultipliers[request.holdingPeriod];
  const volumeWeight = holdingVolumeWeight[request.holdingPeriod];
  const maturityWeight = holdingMaturityWeight[request.holdingPeriod];

  return rows
    .flatMap((row, index): Array<TokenRecommendation & { rankScore: number }> => {
      const symbol = stringField(row, ["symbol", "token_symbol", "ticker"]) || `TOKEN${index + 1}`;
      const name = stringField(row, ["name", "token_name"]) || symbol;
      const mint = stringField(row, ["token_address", "contract_address", "mint", "address"]);
      if (!mint) return [];

      const liquidity = numberField(row, ["liquidity", "liquidity_usd", "total_liquidity_usd"]);
      const volume = numberField(row, ["volume", "volume_usd", "volume_24h", "volume_24h_usd", "buy_volume"]);
      const marketCap = numberField(row, ["market_cap", "market_cap_usd", "marketcap", "fdv"]);
      const holders = numberField(row, ["holders", "holder_count", "unique_holders"]);
      const smartMoney = numberField(row, ["smart_money_inflow", "smart_money_netflow", "smart_money_balance_usd", "netflow", "inflow_fdv_ratio"]);
      const ageDays = numberField(row, ["token_age_days", "age_days"]);
      const priceChange = Math.abs(numberField(row, ["price_change", "price_change_24h"]));

      const liquidityScore = boundedScore(Math.log10((liquidity || 0) + 1) * 12);
      const volumeScore = boundedScore(Math.log10((volume || 0) + 1) * 10);
      const holderScore = boundedScore(Math.log10((holders || 0) + 1) * 18);
      const smartMoneyScore = boundedScore(Math.log10(Math.abs(smartMoney || 0) + 1) * 10);
      const marketCapRisk = marketCap ? Math.max(4, 92 - Math.log10(marketCap + 1) * 9) : 62;
      const liquidityRisk = liquidity ? Math.max(4, 88 - Math.log10(liquidity + 1) * 10) : 70;
      const ageRisk = ageDays ? Math.max(0, 42 - Math.log10(ageDays + 1) * 20) : 25;
      const momentumRisk = Math.min(22, priceChange * 3);
      const flowRisk = smartMoney < 0 ? 8 : 0;
      const riskScore = boundedScore((marketCapRisk * 0.4) + (liquidityRisk * 0.32) + ageRisk + momentumRisk + flowRisk);
      const riskFit = 100 - Math.abs(riskScore - targetRisk);
      const activityScore = boundedScore((volumeScore * volumeWeight + smartMoneyScore * 1.25) / (volumeWeight + 1.25));
      const maturityScore = boundedScore((liquidityScore + holderScore + (marketCap ? Math.log10(marketCap + 1) * 8 : 20)) / 3);
      const horizonFit = boundedScore((activityScore * volumeWeight + maturityScore * maturityWeight) / (volumeWeight + maturityWeight));
      const confidenceScore = boundedScore((riskFit * 0.45) + (horizonFit * 0.35) + (smartMoneyScore * 0.2));
      const upside = Math.max(4, Math.round((confidenceScore * holdingMultiplier * (1 + riskScore / 135)) / 3));
      const downside = Math.max(2, Math.round((riskScore * (1.25 - confidenceScore / 180)) / 4));
      const rankScore = (riskFit * 1.8) + (horizonFit * 1.15) + (smartMoneyScore * 0.8) + (volumeScore * volumeWeight * 0.45) - Math.abs(targetRisk - riskScore) * 0.55;
      const matchText = profileMatchText(Math.round(riskScore), request.riskProfile, request.holdingPeriod);

      const tokenDecimals = numberField(row, ["decimals", "token_decimals"]) || undefined;
      return [{
        id: `${mint}-${request.riskProfile}-${request.holdingPeriod}`.replaceAll(" ", "-"),
        tokenName: name,
        tokenSymbol: symbol,
        mintAddress: mint,
        ...(tokenDecimals ? { tokenDecimals } : {}),
        confidenceScore: Math.round(confidenceScore),
        riskScore: Math.round(riskScore),
        expectedHoldingPeriod: request.holdingPeriod,
        entryRationale: `${symbol} ranks well in the live Nansen Solana screen for liquidity, activity, holder breadth, and smart-money signals.`,
        takeProfit: `+${upside}%`,
        stopLoss: `-${downside}%`,
        trailingStop: riskScore >= 65 ? `${Math.max(7, Math.round(downside * 0.8))}% after +${Math.max(10, Math.round(upside * 0.55))}% move` : undefined,
        estimatedUpside: `+${upside}%`,
        estimatedDownside: `-${downside}%`,
        profileMatch: matchText,
        nansenSource: "Nansen Token Screener",
        rankScore
      }];
    })
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 3)
    .map(({ rankScore: _rankScore, ...recommendation }) => recommendation);
}

function stringField(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function numberField(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}

function boundedScore(value: number) {
  return Math.max(1, Math.min(99, value));
}

function profileMatchText(riskScore: number, riskProfile: RiskProfile, holdingPeriod: HoldingPeriod) {
  const targetRisk = riskTargets[riskProfile];
  const distance = Math.abs(riskScore - targetRisk);
  const fit = distance <= 10 ? "closely matches" : distance <= 22 ? "reasonably matches" : "is the nearest available match for";

  return `Risk score ${riskScore} ${fit} the selected ${riskProfile} profile, with a ${holdingPeriod} horizon.`;
}
