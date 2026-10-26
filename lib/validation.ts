import { z } from "zod";
import { isValidAssetId, isValidStellarAddress } from "@/lib/stellar/assets";
import { holdingPeriods, riskProfiles } from "@/lib/types";

const stellarAddress = z.string().refine(isValidStellarAddress, "Invalid Stellar address (G...).");
const assetId = z.string().refine(isValidAssetId, "Invalid Stellar asset id (CODE:ISSUER or native).");
// Live trades send the 64-char transaction hash; sandbox confirms send a placeholder.
const txHash = z.string().min(8);

export const recommendationRequestSchema = z.object({
  walletAddress: stellarAddress.optional(),
  usdcBalance: z.number().nonnegative(),
  riskProfile: z.enum(riskProfiles),
  allocationPercentage: z.number().int().min(5).max(100),
  holdingPeriod: z.enum(holdingPeriods)
});

export const tradeRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("prepare"),
    owner: stellarAddress,
    amountUsdc: z.number().positive(),
    recommendation: z.object({
      id: z.string(),
      tokenName: z.string(),
      tokenSymbol: z.string(),
      mintAddress: assetId,
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
    owner: stellarAddress,
    signature: txHash,
    preparedTrade: z.any()
  })
]);

export const closeRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("prepare"),
    owner: stellarAddress,
    positionId: z.string(),
    // Client copy of the position, used when this server instance never saw it.
    position: z.any().optional()
  }),
  z.object({
    action: z.literal("confirm"),
    owner: stellarAddress,
    positionId: z.string(),
    signature: txHash,
    position: z.any().optional()
  })
]);

export const broadcastRequestSchema = z.object({
  signedTransaction: z.string().min(16)
});
