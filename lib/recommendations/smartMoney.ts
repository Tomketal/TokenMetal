import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Weekly "smart money" flows per token, produced by scripts/hubble-smart-money.ts:
// how much the wallets with the best trailing returns net bought each week.

interface SmartRow {
  week: string; // Monday that starts the week
  code: string;
  issuer: string;
  smart_net_usd: number;
  smart_buyers: number;
  smart_sellers: number;
}

const DAY_MS = 86_400_000;
const LOOKBACK_WEEKS = 2;

export type SmartMoneyIndex = Map<string, Map<string, SmartRow>>;

export function loadSmartMoney(file = path.join(process.cwd(), "data", "hubble", "smart-money-weekly.json")): SmartMoneyIndex | null {
  if (!existsSync(file)) return null;
  const { rows } = JSON.parse(readFileSync(file, "utf8")) as { rows: SmartRow[] };
  const index: SmartMoneyIndex = new Map();
  for (const row of rows) {
    const assetId = `${row.code}:${row.issuer}`;
    (index.get(assetId) ?? index.set(assetId, new Map()).get(assetId)!).set(row.week, row);
  }
  return index;
}

// Signal in [-1, 1] for a token on `day` (YYYY-MM-DD), using only the last
// LOOKBACK_WEEKS weeks that had fully ended before that day. Combines net USD
// bought relative to the token's weekly volume with how many smart wallets
// bought versus sold. 0 when smart wallets did not touch the token.
export function smartFlowAt(index: SmartMoneyIndex, assetId: string, day: string, volume7dUsd: number) {
  const weeks = index.get(assetId);
  if (!weeks) return 0;

  const dayMs = Date.parse(day);
  const lastMonday = dayMs - (((new Date(dayMs).getUTCDay() + 6) % 7) * DAY_MS) - 7 * DAY_MS; // week fully closed
  let net = 0;
  let buyers = 0;
  let sellers = 0;
  for (let back = 0; back < LOOKBACK_WEEKS; back++) {
    const week = new Date(lastMonday - back * 7 * DAY_MS).toISOString().slice(0, 10);
    const row = weeks.get(week);
    if (!row) continue;
    net += row.smart_net_usd;
    buyers += row.smart_buyers;
    sellers += row.smart_sellers;
  }
  if (buyers + sellers === 0) return 0;

  const flow = Math.tanh(net / Math.max(1, 0.02 * volume7dUsd * LOOKBACK_WEEKS));
  const breadth = (buyers - sellers) / (buyers + sellers + 1);
  return 0.5 * flow + 0.5 * breadth;
}
