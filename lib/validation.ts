import { z } from "zod";
import { holdingPeriods, riskProfiles } from "@/lib/types";

export const recommendationRequestSchema = z.object({
  walletAddress: z.string().min(32),
  usdcBalance: z.number().nonnegative(),
  riskProfile: z.enum(riskProfiles),
  allocationPercentage: z.number().int().min(5).max(100),
  holdingPeriod: z.enum(holdingPeriods)
});

export const tradeRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("prepare"),
    owner: z.string().min(32),
    amountUsdc: z.number().positive(),
    recommendation: z.object({
      id: z.string(),
      tokenName: z.string(),
      tokenSymbol: z.string(),
      mintAddress: z.string().min(32),
      tokenDecimals: z.number().optional(),
      confidenceScore: z.number(),
      riskScore: z.number(),
      expectedHoldingPeriod: z.string(),
      entryRationale: z.string(),
      takeProfit: z.string(),
      stopLoss: z.string(),
      trailingStop: z.string().optional(),
      estimatedUpside: z.string(),
      estimatedDownside: z.string(),
      profileMatch: z.string(),
      nansenSource: z.string()
    })
  }),
  z.object({
    action: z.literal("confirm"),
    owner: z.string().min(32),
    signature: z.string().min(32),
    preparedTrade: z.any()
  })
]);

export const closeRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("prepare"),
    owner: z.string().min(32),
    positionId: z.string()
  }),
  z.object({
    action: z.literal("confirm"),
    owner: z.string().min(32),
    positionId: z.string(),
    signature: z.string().min(32)
  })
]);
