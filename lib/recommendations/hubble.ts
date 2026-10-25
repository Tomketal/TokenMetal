import { readFileSync } from "node:fs";
import path from "node:path";
import { isInvestableCode, type TokenSeries } from "./market";

// Loads the daily price cache exported from Hubble (scripts/hubble-export.ts)
// into the same series shape the engine and backtest use for Horizon data.

interface HubbleRow {
  day: string;
  code: string;
  issuer: string | null;
  price_xlm: number | null;
  volume_xlm: number;
  price_usdc: number | null;
  volume_usdc: number;
}

const DAY_MS = 86_400_000;
// Days with less than this traded are too thin to set a price.
const MIN_DAY_VOLUME_USD = 100;
// A print more than this far from both neighboring prints is treated as bad data.
const BAD_PRINT_RATIO = 3;
const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

export function loadHubbleHistory(file = path.join(process.cwd(), "data", "hubble", "daily-prices.json")) {
  const { rows } = JSON.parse(readFileSync(file, "utf8")) as { rows: HubbleRow[] };

  const firstDay = rows.reduce((min, row) => (row.day < min ? row.day : min), rows[0].day);
  const lastDay = rows.reduce((max, row) => (row.day > max ? row.day : max), rows[0].day);
  const start = Date.parse(firstDay);
  const length = Math.round((Date.parse(lastDay) - start) / DAY_MS) + 1;
  const dates = Array.from({ length }, (_, index) => new Date(start + index * DAY_MS).toISOString().slice(0, 10));
  const indexOf = (day: string) => Math.round((Date.parse(day) - start) / DAY_MS);

  // XLM's USD price: the XLM row priced in USDC, else the USDC row priced in XLM.
  const xlmUsdRaw: Array<number | null> = new Array(length).fill(null);
  for (const row of rows) {
    if (row.code === "XLM" && row.price_usdc) xlmUsdRaw[indexOf(row.day)] = row.price_usdc;
  }
  for (const row of rows) {
    const index = indexOf(row.day);
    if (row.code === "USDC" && row.issuer === USDC_ISSUER && row.price_xlm && xlmUsdRaw[index] === null) {
      xlmUsdRaw[index] = 1 / row.price_xlm;
    }
  }
  const xlmUsd = forwardFill(xlmUsdRaw).map((value) => value ?? 0);

  const byAsset = new Map<string, HubbleRow[]>();
  for (const row of rows) {
    if (!row.code || !isInvestableCode(row.code)) continue;
    const key = row.code === "XLM" ? "native" : `${row.code}:${row.issuer}`;
    (byAsset.get(key) ?? byAsset.set(key, []).get(key)!).push(row);
  }

  const tokens: TokenSeries[] = [];
  for (const [assetId, assetRows] of byAsset) {
    const closes: Array<number | null> = new Array(length).fill(null);
    const volumesUsd: number[] = new Array(length).fill(0);
    const traded: boolean[] = new Array(length).fill(false);

    for (const row of assetRows) {
      const index = indexOf(row.day);
      const viaXlm = row.price_xlm && xlmUsd[index] ? row.price_xlm * xlmUsd[index] : null;
      const xlmLegUsd = row.volume_xlm * xlmUsd[index];
      // Volume-weighted blend of the XLM and USDC markets.
      const weight = (viaXlm ? xlmLegUsd : 0) + (row.price_usdc ? row.volume_usdc : 0);
      if (weight <= 0 || xlmLegUsd + row.volume_usdc < MIN_DAY_VOLUME_USD) continue;
      closes[index] = ((viaXlm ?? 0) * (viaXlm ? xlmLegUsd : 0) + (row.price_usdc ?? 0) * (row.price_usdc ? row.volume_usdc : 0)) / weight;
      volumesUsd[index] = xlmLegUsd + row.volume_usdc;
      traded[index] = true;
    }
    if (assetId === "native") {
      for (let index = 0; index < length; index++) closes[index] = xlmUsd[index] || null;
    }

    if (assetId !== "native") dropBadPrints(closes, traded);
    const firstTradeIndex = traded.indexOf(true);
    if (firstTradeIndex < 0) continue;
    const [code, issuer] = assetId === "native" ? ["XLM", undefined] : assetId.split(":");
    tokens.push({
      item: { asset: assetId === "native" ? "XLM" : `${code}-${issuer}-1`, code },
      assetId,
      closes: forwardFill(closes),
      volumesUsd,
      traded,
      volumeScale: 1,
      pointInTime: { firstTradeIndex }
    });
  }

  return { dates, xlmUsd, tokens };
}

// Thin markets print the occasional absurd trade (a dust order at 10x the
// price). Drop prints that disagree with both the previous and next print.
function dropBadPrints(closes: Array<number | null>, traded: boolean[]) {
  const priced = closes.flatMap((close, index) => (close ? [index] : []));
  for (let i = 1; i < priced.length - 1; i++) {
    const [prev, current, next] = [closes[priced[i - 1]]!, closes[priced[i]]!, closes[priced[i + 1]]!];
    const offPrev = Math.max(current / prev, prev / current);
    const offNext = Math.max(current / next, next / current);
    if (offPrev > BAD_PRINT_RATIO && offNext > BAD_PRINT_RATIO) {
      closes[priced[i]] = null;
      traded[priced[i]] = false;
    }
  }
}

function forwardFill(values: Array<number | null>) {
  let last: number | null = null;
  return values.map((value) => (last = value ?? last));
}
