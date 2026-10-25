import Decimal from "decimal.js";

export function toRawAmount(amount: number, decimals: number) {
  return BigInt(Math.round(amount * 10 ** decimals)).toString();
}

export function fromRawAmount(rawAmount: string, decimals: number) {
  return Number(rawAmount) / 10 ** decimals;
}

// Stellar operations take decimal strings with at most 7 places; round down so
// we never ask to spend more than the user approved.
export function toStellarAmount(amount: number | string) {
  return new Decimal(amount).toDecimalPlaces(7, Decimal.ROUND_DOWN).toFixed(7);
}

export function usd(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function pct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
