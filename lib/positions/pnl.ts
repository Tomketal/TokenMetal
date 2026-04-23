import { appConfig } from "@/lib/config";
import { getTokenValueInUsdc } from "@/lib/trading/jupiter";
import type { Position } from "@/lib/types";

const valueCache = new Map<string, { expiresAt: number; value: number }>();

export async function refreshPositionPnl(position: Position): Promise<Position> {
  if (position.status === "closed") {
    if (position.closeSignature && (position.pnlUsd === null || position.pnlUsd === 0)) {
      const closedSnapshot = await inferClosedPnlFromSignature(position);
      return closedSnapshot ?? position;
    }
    return position;
  }

  if (appConfig.dryRun) {
    const ageMs = Date.now() - new Date(position.openedAt).getTime();
    const wave = Math.sin(ageMs / 20000);
    const drift = Math.min(0.08, ageMs / 1000 / 60 / 100);
    const pnlPercent = (wave * 2.4 + drift * 100) / 2;
    const currentValueUsd = position.entryUsdc * (1 + pnlPercent / 100);
    const pnlUsd = currentValueUsd - position.entryUsdc;
    const currentPrice = position.tokenAmountUi > 0 ? currentValueUsd / position.tokenAmountUi : null;

    return {
      ...position,
      currentPrice,
      currentValueUsd,
      pnlUsd,
      pnlPercent
    };
  }

  try {
    const currentValueUsd = await getCachedTokenValue(position);
    const pnlUsd = currentValueUsd - position.entryUsdc;
    const pnlPercent = position.entryUsdc > 0 ? (pnlUsd / position.entryUsdc) * 100 : 0;
    const currentPrice = position.tokenAmountUi > 0 ? currentValueUsd / position.tokenAmountUi : null;

    return {
      ...position,
      currentPrice,
      currentValueUsd,
      pnlUsd,
      pnlPercent
    };
  } catch {
    return position;
  }
}

async function getCachedTokenValue(position: Position) {
  const cacheKey = `${appConfig.tradeEngine}:${position.mintAddress}:${position.tokenAmountRaw}`;
  const cached = valueCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const value = await getTokenValueInUsdc(position.mintAddress, position.tokenAmountRaw);
  valueCache.set(cacheKey, {
    value,
    expiresAt: now + appConfig.priceCacheTtlMs
  });
  return value;
}

async function inferClosedPnlFromSignature(position: Position): Promise<Position | null> {
  if (appConfig.tradeEngine !== "raydium-devnet") return null;

  try {
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          position.closeSignature,
          {
            encoding: "jsonParsed",
            maxSupportedTransactionVersion: 0
          }
        ]
      }),
      cache: "no-store"
    });
    const payload = await response.json();
    const ownerAccount = payload?.result?.transaction?.message?.accountKeys?.[0]?.pubkey;
    const preBalance = payload?.result?.meta?.preBalances?.[0];
    const postBalance = payload?.result?.meta?.postBalances?.[0];
    const fee = payload?.result?.meta?.fee || 0;

    if (ownerAccount !== position.owner || typeof preBalance !== "number" || typeof postBalance !== "number") {
      return null;
    }

    const exitValue = (postBalance - preBalance + fee) / 1_000_000_000;
    if (!Number.isFinite(exitValue) || exitValue <= 0) return null;

    const pnlUsd = exitValue - position.entryUsdc;
    const pnlPercent = position.entryUsdc > 0 ? (pnlUsd / position.entryUsdc) * 100 : 0;
    const currentPrice = position.tokenAmountUi > 0 ? exitValue / position.tokenAmountUi : null;

    return {
      ...position,
      currentValueUsd: exitValue,
      currentPrice,
      pnlUsd,
      pnlPercent
    };
  } catch {
    return null;
  }
}
