import { appConfig, requireEnv } from "@/lib/config";
import type { Position, PositionTriggerOrder, TriggerOrderState } from "@/lib/types";

export type TriggerChallengeType = "message" | "transaction";

export type TriggerChallengeResponse =
  | {
    type: "message";
    challenge: string;
  }
  | {
    type: "transaction";
    transaction: string;
  };

export interface TriggerVault {
  userPubkey: string;
  vaultPubkey: string;
  privyVaultId: string;
}

export interface TriggerDepositDraft {
  transaction: string;
  requestId: string;
  receiverAddress: string;
  mint: string;
  amount: string;
  tokenDecimals?: number;
}

export interface TriggerOcoDraft {
  inputMint: string;
  inputAmount: string;
  outputMint: string;
  triggerMint: string;
  tpPriceUsd: number;
  slPriceUsd: number;
  tpSlippageBps?: number;
  slSlippageBps?: number;
  expiresAt: number;
  notionalUsd: number;
}

interface TriggerHistoryResponse {
  orders?: TriggerHistoryOrder[];
}

interface TriggerHistoryOrder {
  id: string;
  orderType?: string;
  orderState?: string;
  rawState?: string;
  inputMint?: string;
  outputMint?: string;
  triggerMint?: string;
  initialInputAmount?: string;
  triggerPriceUsd?: number;
  tpPriceUsd?: number;
  slPriceUsd?: number;
  expiresAt?: number;
  createdAt?: number;
  updatedAt?: number;
  events?: Array<{ txSignature?: string; type?: string }>;
}

interface TriggerCreateOrderResponse {
  id: string;
  txSignature: string;
}

interface TriggerCancelPrepareResponse {
  id: string;
  requestId: string;
  transaction: string;
}

interface TriggerCancelConfirmResponse {
  id: string;
  txSignature: string;
}

const orderStates: TriggerOrderState[] = [
  "pending",
  "open",
  "executing",
  "filled",
  "pending_withdraw",
  "cancelled",
  "expired",
  "failed",
  "unknown"
];

function triggerHeaders(authToken?: string) {
  requireEnv(appConfig.jupiterTriggerApiKey, "JUPITER_TRIGGER_API_KEY");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": appConfig.jupiterTriggerApiKey
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
}

async function parseError(response: Response) {
  let details = "";

  try {
    details = await response.text();
  } catch {
    // Ignore read failures.
  }

  if (!details) {
    return `HTTP ${response.status}`;
  }

  return `HTTP ${response.status}: ${details}`;
}

async function triggerGet<T>(path: string, authToken: string, allowStatuses: number[] = [200]) {
  const response = await fetch(`${appConfig.jupiterTriggerBaseUrl}${path}`, {
    method: "GET",
    headers: triggerHeaders(authToken),
    cache: "no-store"
  });

  if (!allowStatuses.includes(response.status)) {
    throw new Error(`Jupiter Trigger request failed (${await parseError(response)}).`);
  }

  return response.json() as Promise<T>;
}

async function triggerPost<T>(path: string, body: unknown, authToken?: string, allowStatuses: number[] = [200]) {
  const response = await fetch(`${appConfig.jupiterTriggerBaseUrl}${path}`, {
    method: "POST",
    headers: triggerHeaders(authToken),
    body: JSON.stringify(body),
    cache: "no-store"
  });

  if (!allowStatuses.includes(response.status)) {
    throw new Error(`Jupiter Trigger request failed (${await parseError(response)}).`);
  }

  return response.json() as Promise<T>;
}

async function triggerPatch<T>(path: string, body: unknown, authToken: string, allowStatuses: number[] = [200]) {
  const response = await fetch(`${appConfig.jupiterTriggerBaseUrl}${path}`, {
    method: "PATCH",
    headers: triggerHeaders(authToken),
    body: JSON.stringify(body),
    cache: "no-store"
  });

  if (!allowStatuses.includes(response.status)) {
    throw new Error(`Jupiter Trigger request failed (${await parseError(response)}).`);
  }

  return response.json() as Promise<T>;
}

export async function requestTriggerChallenge(walletPubkey: string, type: TriggerChallengeType = "message") {
  return triggerPost<TriggerChallengeResponse>(
    "/auth/challenge",
    {
      walletPubkey,
      type
    },
    undefined,
    [200]
  );
}

export async function verifyTriggerChallenge(
  payload:
    | {
      walletPubkey: string;
      type: "message";
      signature: string;
    }
    | {
      walletPubkey: string;
      type: "transaction";
      signedTransaction: string;
    }
) {
  return triggerPost<{ token: string }>("/auth/verify", payload, undefined, [200]);
}

export async function getOrRegisterTriggerVault(authToken: string): Promise<TriggerVault> {
  try {
    return await triggerGet<TriggerVault>("/vault", authToken, [200]);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";

    if (!message.includes("401") && !message.includes("404") && !message.includes("no vault") && !message.includes("not found")) {
      throw error;
    }

    const registerResponse = await fetch(`${appConfig.jupiterTriggerBaseUrl}/vault/register`, {
      method: "GET",
      headers: triggerHeaders(authToken),
      cache: "no-store"
    });

    if (registerResponse.status === 201) {
      return registerResponse.json() as Promise<TriggerVault>;
    }

    if (registerResponse.status === 409) {
      return triggerGet<TriggerVault>("/vault", authToken, [200]);
    }

    throw new Error(`Jupiter Trigger vault registration failed (${await parseError(registerResponse)}).`);
  }
}

export async function craftTriggerDeposit(authToken: string, params: {
  inputMint: string;
  outputMint: string;
  userAddress: string;
  amount: string;
}) {
  return triggerPost<TriggerDepositDraft>("/deposit/craft", params, authToken, [200]);
}

export async function createTriggerOcoOrder(authToken: string, params: {
  depositRequestId: string;
  depositSignedTx: string;
  userPubkey: string;
  draft: TriggerOcoDraft;
}) {
  return triggerPost<TriggerCreateOrderResponse>(
    "/orders/price",
    {
      orderType: "oco",
      depositRequestId: params.depositRequestId,
      depositSignedTx: params.depositSignedTx,
      userPubkey: params.userPubkey,
      inputMint: params.draft.inputMint,
      inputAmount: params.draft.inputAmount,
      outputMint: params.draft.outputMint,
      triggerMint: params.draft.triggerMint,
      tpPriceUsd: params.draft.tpPriceUsd,
      slPriceUsd: params.draft.slPriceUsd,
      tpSlippageBps: params.draft.tpSlippageBps,
      slSlippageBps: params.draft.slSlippageBps,
      expiresAt: params.draft.expiresAt
    },
    authToken,
    [200]
  );
}

export async function prepareTriggerOrderCancellation(authToken: string, orderId: string) {
  return triggerPost<TriggerCancelPrepareResponse>(`/orders/price/cancel/${orderId}`, {}, authToken, [200]);
}

export async function confirmTriggerOrderCancellation(authToken: string, orderId: string, payload: {
  signedTransaction: string;
  cancelRequestId: string;
}) {
  return triggerPost<TriggerCancelConfirmResponse>(
    `/orders/price/confirm-cancel/${orderId}`,
    payload,
    authToken,
    [200]
  );
}

export async function fetchTriggerOrderById(authToken: string, orderId: string): Promise<TriggerHistoryOrder | null> {
  const active = await triggerGet<TriggerHistoryResponse>("/orders/history?state=active&limit=100&offset=0", authToken, [200]);
  const activeMatch = active.orders?.find((order) => order.id === orderId);
  if (activeMatch) return activeMatch;

  const past = await triggerGet<TriggerHistoryResponse>("/orders/history?state=past&limit=100&offset=0", authToken, [200]);
  return past.orders?.find((order) => order.id === orderId) || null;
}

export async function updateTriggerOrder(
  authToken: string,
  orderId: string,
  params:
    | {
      orderType: "single";
      triggerPriceUsd: number;
      slippageBps?: number;
    }
    | {
      orderType: "oco";
      tpPriceUsd: number;
      slPriceUsd: number;
    }
    | {
      orderType: "otoco";
      triggerPriceUsd: number;
      tpPriceUsd: number;
      slPriceUsd: number;
    }
) {
  return triggerPatch<{ id: string }>(`/orders/price/${orderId}`, params, authToken, [200]);
}

export function deriveTriggerOcoDraft(position: Position): TriggerOcoDraft {
  if (position.status !== "open") {
    throw new Error("Only open positions can be armed with TP/SL orders.");
  }

  const notionalUsd = ensureFinite(position.currentValueUsd, position.entryUsdc);

  if (notionalUsd < appConfig.triggerMinOrderUsd) {
    throw new Error(
      `Position size is ${notionalUsd.toFixed(2)} USD, below Jupiter Trigger minimum of ${appConfig.triggerMinOrderUsd.toFixed(2)} USD.`
    );
  }

  const entryPrice = ensureFinite(position.entryPrice, 0);
  if (entryPrice <= 0) {
    throw new Error("Position entry price is invalid; cannot derive TP/SL trigger prices.");
  }

  const tpPriceUsd = toAbsoluteTargetPrice(entryPrice, position.takeProfit, "tp");
  const slPriceUsd = toAbsoluteTargetPrice(entryPrice, position.stopLoss, "sl");

  if (!(tpPriceUsd > slPriceUsd)) {
    throw new Error("Take Profit must be above Stop Loss to create an OCO order.");
  }

  const expiresAt = Date.now() + Math.max(1, appConfig.triggerOrderExpiryDays) * 24 * 60 * 60 * 1000;

  return {
    inputMint: position.mintAddress,
    inputAmount: position.tokenAmountRaw,
    outputMint: appConfig.usdcMint,
    triggerMint: position.mintAddress,
    tpPriceUsd,
    slPriceUsd,
    tpSlippageBps: clampBps(appConfig.triggerTpSlippageBps),
    slSlippageBps: clampBps(appConfig.triggerSlSlippageBps),
    expiresAt,
    notionalUsd
  };
}

export function buildTriggerOrderSnapshot(
  draft: TriggerOcoDraft,
  createdOrder: TriggerCreateOrderResponse
): PositionTriggerOrder {
  const nowIso = new Date().toISOString();

  return {
    provider: "jupiter-trigger-v2",
    orderType: "oco",
    orderId: createdOrder.id,
    orderState: "pending",
    txSignature: createdOrder.txSignature,
    inputAmountRaw: draft.inputAmount,
    inputMint: draft.inputMint,
    outputMint: draft.outputMint,
    triggerMint: draft.triggerMint,
    tpPriceUsd: draft.tpPriceUsd,
    slPriceUsd: draft.slPriceUsd,
    expiresAt: draft.expiresAt,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastSyncedAt: nowIso
  };
}

export function mergeTriggerOrderFromHistory(
  existing: PositionTriggerOrder,
  order: TriggerHistoryOrder
): PositionTriggerOrder {
  const normalizedOrderState = normalizeOrderState(order.orderState);
  const createdAt = order.createdAt ? new Date(order.createdAt).toISOString() : existing.createdAt;
  const updatedAt = order.updatedAt ? new Date(order.updatedAt).toISOString() : new Date().toISOString();
  const lastEvent = order.events && order.events.length ? order.events[order.events.length - 1] : undefined;

  return {
    ...existing,
    orderState: normalizedOrderState,
    rawState: typeof order.rawState === "string" ? order.rawState : existing.rawState,
    txSignature: lastEvent?.txSignature || existing.txSignature,
    inputMint: order.inputMint || existing.inputMint,
    outputMint: order.outputMint || existing.outputMint,
    triggerMint: order.triggerMint || existing.triggerMint,
    inputAmountRaw: order.initialInputAmount || existing.inputAmountRaw,
    tpPriceUsd: typeof order.tpPriceUsd === "number" ? order.tpPriceUsd : existing.tpPriceUsd,
    slPriceUsd: typeof order.slPriceUsd === "number" ? order.slPriceUsd : existing.slPriceUsd,
    expiresAt: typeof order.expiresAt === "number" ? order.expiresAt : existing.expiresAt,
    createdAt,
    updatedAt,
    lastSyncedAt: new Date().toISOString()
  };
}

function normalizeOrderState(value: unknown): TriggerOrderState {
  if (typeof value !== "string") return "unknown";
  if ((orderStates as string[]).includes(value)) {
    return value as TriggerOrderState;
  }
  return "unknown";
}

function ensureFinite(value: number | null | undefined, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function clampBps(value: number) {
  if (!Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(10_000, Math.round(value)));
}

function toAbsoluteTargetPrice(entryPrice: number, raw: string, mode: "tp" | "sl") {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`Missing ${mode === "tp" ? "take profit" : "stop loss"} value.`);

  if (trimmed.includes("%")) {
    const percent = parseNumber(trimmed.replace("%", ""));

    if (mode === "tp" && percent <= 0) {
      throw new Error("Take Profit percentage must be greater than 0.");
    }

    if (mode === "sl" && percent >= 0) {
      throw new Error("Stop Loss percentage must be negative (e.g. -5%).");
    }

    const target = entryPrice * (1 + percent / 100);
    if (!Number.isFinite(target) || target <= 0) {
      throw new Error(`Invalid ${mode === "tp" ? "take profit" : "stop loss"} percentage.`);
    }

    return roundUsd(target);
  }

  const absolute = parseNumber(trimmed.replace("$", ""));
  if (!Number.isFinite(absolute) || absolute <= 0) {
    throw new Error(`Invalid ${mode === "tp" ? "take profit" : "stop loss"} price.`);
  }

  return roundUsd(absolute);
}

function parseNumber(raw: string) {
  const normalized = raw.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Unable to parse numeric value from \"${raw}\".`);
  }
  return parsed;
}

function roundUsd(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
