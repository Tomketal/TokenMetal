import type { HoldingPeriod, RiskProfile } from "@/lib/types";

// Profile tables that translate the user's three inputs into scoring targets.

// Targets sit where Stellar's liquid tokens actually cluster: XLM/XRP-like
// majors (~20), mid-caps such as SHX (~45), small caps such as XXA (~75).
export const riskTargets: Record<RiskProfile, number> = {
  low: 20,
  medium: 45,
  high: 75
};

// Suggested share of the user's USDC to invest. On Stellar the healthy tokens
// cluster at low-to-medium risk, so "high" mostly differs in how much is put to
// work and how much room its stop loss gives (see exitLevels), not in picks.
export const suggestedAllocation: Record<RiskProfile, number> = {
  low: 20,
  medium: 35,
  high: 50
};

// Short horizons reward recent momentum and trading activity...
export const holdingVolumeWeight: Record<HoldingPeriod, number> = {
  "3 days": 1.55,
  "1 week": 1.35,
  "1 month": 1.05,
  "3 months": 0.85,
  "6 months": 0.7,
  "more than 6 months": 0.6,
  "I don't care / I HODL": 0.55
};

// ...long horizons reward maturity: age, holder base, 30-day trend.
export const holdingMaturityWeight: Record<HoldingPeriod, number> = {
  "3 days": 0.55,
  "1 week": 0.7,
  "1 month": 1,
  "3 months": 1.25,
  "6 months": 1.45,
  "more than 6 months": 1.6,
  "I don't care / I HODL": 1.75
};

export const holdingDays: Record<HoldingPeriod, number> = {
  "3 days": 3,
  "1 week": 7,
  "1 month": 30,
  "3 months": 90,
  "6 months": 180,
  "more than 6 months": 365,
  "I don't care / I HODL": 365
};

export function boundedScore(value: number) {
  return Math.max(1, Math.min(99, value));
}

export function profileMatchText(riskScore: number, riskProfile: RiskProfile, holdingPeriod: HoldingPeriod) {
  const targetRisk = riskTargets[riskProfile];
  const distance = Math.abs(riskScore - targetRisk);
  const fit = distance <= 10 ? "closely matches" : distance <= 22 ? "reasonably matches" : "is the nearest available match for";

  return `Risk score ${riskScore} ${fit} the selected ${riskProfile} profile, with a ${holdingPeriod} horizon.`;
}
