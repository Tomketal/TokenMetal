export function toRawAmount(amount: number, decimals: number) {
  return BigInt(Math.round(amount * 10 ** decimals)).toString();
}

export function fromRawAmount(rawAmount: string, decimals: number) {
  return Number(rawAmount) / 10 ** decimals;
}

export function usd(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function pct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
