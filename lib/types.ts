export const riskProfiles = [
  "very low",
  "low",
  "medium low",
  "medium",
  "medium high",
  "high",
  "very high"
] as const;

export const holdingPeriods = [
  "3 days",
  "1 week",
  "1 month",
  "3 months",
  "6 months",
  "more than 6 months",
  "I don't care / I HODL"
] as const;

export type RiskProfile = (typeof riskProfiles)[number];
export type HoldingPeriod = (typeof holdingPeriods)[number];
export type PositionStatus = "open" | "closed";
export type TriggerOrderType = "oco";
export type TriggerOrderState =
  | "pending"
  | "open"
  | "executing"
  | "filled"
  | "pending_withdraw"
  | "cancelled"
  | "expired"
  | "failed"
  | "unknown";

export interface RecommendationRequest {
  walletAddress: string;
  usdcBalance: number;
  riskProfile: RiskProfile;
  allocationPercentage: number;
  holdingPeriod: HoldingPeriod;
}

export interface TokenRecommendation {
  id: string;
  tokenName: string;
  tokenSymbol: string;
  mintAddress: string;
  tokenDecimals?: number;
  confidenceScore: number;
  riskScore: number;
  expectedHoldingPeriod: string;
  entryRationale: string;
  takeProfit: string;
  stopLoss: string;
  trailingStop?: string;
  estimatedUpside: string;
  estimatedDownside: string;
  profileMatch: string;
  nansenSource: string;
}

export interface TradePrepareRequest {
  action: "prepare";
  owner: string;
  amountUsdc: number;
  recommendation: TokenRecommendation;
}

export interface TradeConfirmRequest {
  action: "confirm";
  owner: string;
  signature: string;
  preparedTrade: PreparedTrade;
}

export type TradeRequest = TradePrepareRequest | TradeConfirmRequest;

export interface PreparedTrade {
  id: string;
  owner: string;
  inputMint: string;
  outputMint: string;
  amountUsdc: number;
  amountUsdcRaw: string;
  commissionUsdc?: number;
  expectedTokenAmountRaw: string;
  expectedTokenAmountUi: number;
  expectedReturnUsd: number;
  expectedLossUsd: number;
  recommendation: TokenRecommendation;
  quoteResponse: unknown;
  swapTransaction: string;
  createdAt: string;
}

export interface Position {
  id: string;
  owner: string;
  tokenName: string;
  tokenSymbol: string;
  mintAddress: string;
  tokenDecimals: number;
  tokenAmountRaw: string;
  tokenAmountUi: number;
  entryUsdc: number;
  entryPrice: number;
  currentPrice: number | null;
  currentValueUsd: number | null;
  pnlUsd: number | null;
  pnlPercent: number | null;
  takeProfit: string;
  stopLoss: string;
  trailingStop?: string;
  expectedHoldingPeriod: string;
  riskLevel: string;
  recommendationRationale: string;
  openSignature: string;
  closeSignature?: string;
  status: PositionStatus;
  engine?: string;
  triggerOrder?: PositionTriggerOrder;
  openedAt: string;
  closedAt?: string;
}

export interface PositionTriggerOrder {
  provider: "jupiter-trigger-v2";
  orderType: TriggerOrderType;
  orderId: string;
  orderState: TriggerOrderState;
  rawState?: string;
  txSignature?: string;
  inputAmountRaw: string;
  inputMint: string;
  outputMint: string;
  triggerMint: string;
  tpPriceUsd: number;
  slPriceUsd: number;
  expiresAt: number;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
}

export interface ClosePrepareRequest {
  action: "prepare";
  owner: string;
  positionId: string;
}

export interface CloseConfirmRequest {
  action: "confirm";
  owner: string;
  positionId: string;
  signature: string;
}

export type ClosePositionRequest = ClosePrepareRequest | CloseConfirmRequest;
