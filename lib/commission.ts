/**
 * Commission system for Token Letal.
 *
 * 0.5% fee on entry only, collected via Jupiter's native platform-fee
 * mechanism (platformFeeBps + feeAccount). No custom Solana program needed.
 *
 * Docs: https://station.jup.ag/docs/apis/swap-api#platform-fee
 */

export const COMMISSION_BPS = 50; // 0.50% (1 bps = 0.01%)

/**
 * Treasury wallet that receives the platform fee.
 * The USDC ATA for this wallet MUST exist on-chain before the first trade.
 */
export const TREASURY_WALLET =
  process.env.TREASURY_WALLET || "C6SXMQLziW8M7SAXQA2BxCmejE7HJRhKA9ahzbdF6CKW";

/**
 * Returns the commission amount in USDC for a given input amount.
 * Used for UI display only -- Jupiter handles the actual deduction.
 */
export function computeCommission(amountUsdc: number): number {
  return amountUsdc * (COMMISSION_BPS / 10_000);
}

/**
 * Returns the net USDC amount that enters the swap after the fee.
 * Used for UI display only.
 */
export function computeNetAmount(amountUsdc: number): number {
  return amountUsdc - computeCommission(amountUsdc);
}

/**
 * Returns true when commission is fully configured and should be active.
 * Automatically returns false in dry-run or devnet mode.
 */
export function isCommissionEnabled(): boolean {
  const cluster = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "mainnet-beta").toLowerCase();
  return Boolean(TREASURY_WALLET) && process.env.NEXT_PUBLIC_DRY_RUN !== "true" && cluster !== "devnet";
}
