/**
 * Commission system for Token Metal.
 *
 * 0.5% fee on entry only. On Stellar it is an extra USDC `payment` operation
 * to the treasury inside the same transaction as the swap, so it is atomic:
 * either the swap and the fee both happen, or neither does.
 */

import { StrKey } from "@stellar/stellar-sdk";

export const COMMISSION_BPS = 50; // 0.50% (1 bps = 0.01%)

/**
 * Stellar account (G...) that receives the platform fee.
 * It MUST hold a USDC trustline before the first live trade.
 */
export const TREASURY_WALLET = process.env.TREASURY_WALLET || "";

/**
 * Returns the commission amount in USDC for a given input amount.
 */
export function computeCommission(amountUsdc: number): number {
  return amountUsdc * (COMMISSION_BPS / 10_000);
}

/**
 * Returns the net USDC amount that enters the swap after the fee.
 */
export function computeNetAmount(amountUsdc: number): number {
  return amountUsdc - computeCommission(amountUsdc);
}

/**
 * Returns true when commission is fully configured and should be active.
 * Automatically returns false in dry-run mode or without a valid treasury.
 */
export function isCommissionEnabled(): boolean {
  return StrKey.isValidEd25519PublicKey(TREASURY_WALLET) && process.env.NEXT_PUBLIC_DRY_RUN !== "true";
}
