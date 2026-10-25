import { appConfig, shouldUseSandboxTrading } from "@/lib/config";
import { getTokenValueInUsdc } from "@/lib/trading/sdex";
import type { Position } from "@/lib/types";

const valueCache = new Map<string, { expiresAt: number; value: number }>();

// Closed positions keep the PnL recorded from the on-chain close swap.
export async function refreshPositionPnl(position: Position): Promise<Position> {
  if (position.status === "closed") return position;

  if (shouldUseSandboxTrading()) {
    const ageMs = Date.now() - new Date(position.openedAt).getTime();
    const wave = Math.sin(ageMs / 20000);
    const drift = Math.min(0.08, ageMs / 1000 / 60 / 100);
    const pnlPercent = (wave * 2.4 + drift * 100) / 2;
    const currentValueUsd = position.entryUsdc * (1 + pnlPercent / 100);
    return withValue(position, currentValueUsd);
  }

  try {
    return withValue(position, await getCachedTokenValue(position));
  } catch {
    return position;
  }
}

export function withValue(position: Position, currentValueUsd: number): Position {
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
