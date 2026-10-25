import { Asset, Horizon } from "@stellar/stellar-sdk";

// Live market data for the Stellar recommendation engine.
// Universe + metadata come from the Stellar Expert public API; price history
// comes from Horizon daily trade aggregations. Always reads mainnet: testnet
// has no real market to learn from.

const STELLAR_EXPERT_URL = process.env.STELLAR_EXPERT_API_URL || "https://api.stellar.expert/explorer/public";
const MARKET_HORIZON_URL = process.env.MARKET_HORIZON_URL || "https://horizon.stellar.org";
const MAINNET_USDC = new Asset("USDC", "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
const SNAPSHOT_TTL_MS = 10 * 60_000;
export const WINDOW_DAYS = 31;
const DAY_MS = 86_400_000;
const PAGE_DAYS = 180;

// Fiat-pegged, stable and tokenized-yield assets are not "investments" for this
// product; several of the yield ones also require issuer authorization.
const EXCLUDED_CODES =
  /USD|EUR|GBP|ZAR|ARS|BRL|MXN|NGN|KES|TRY|CHF|JPY|CNY|CNH|INR|PHP|IDR|VND|COP|CLP|PEN|UAH|RUB|KRW|AUD|CAD|SGD|HKD|THB|MYR|GHS|XOF|CETES|TESOURO|USTRY|USDY|GOLD|XAU|SLVR/i;

export function isInvestableCode(code: string) {
  return !EXCLUDED_CODES.test(code);
}

const MIN_VOLUME_7D_USD = 10_000;
const MIN_RATING = 6.5;
const MIN_HOLDERS = 1_000;
const MIN_TRADE_DAYS = 8;
const MAX_CANDIDATES = 18;

export interface TokenMetrics {
  assetId: string; // "native" or CODE:ISSUER
  code: string;
  name: string;
  domain?: string;
  priceUsd: number;
  volume7dUsd: number;
  holders: number;
  ageDays: number;
  rating: { average: number; liquidity: number; age: number; activity: number };
  dailyCloses: number[]; // USD, oldest -> newest
  tradeDays: number; // days in the window with at least one trade
  return7d: number; // fraction, e.g. 0.12 = +12%
  return30d: number;
  volatility: number; // annualized, fraction
  maxDrawdown: number; // fraction over the window
  smartFlow?: number; // [-1, 1] net buying by historically profitable wallets
}

export interface ExpertAsset {
  asset: string;
  code?: string;
  price?: number;
  created?: number;
  volume7d?: number;
  trustlines?: { funded?: number };
  rating?: { average?: number; liquidity?: number; age?: number; activity?: number };
  domain?: string;
  toml_info?: { name?: string; orgName?: string };
}

// Daily USD series for one token, aligned with the XLM/USDC series.
// `closes` is null before the token's first trade in the range.
export interface TokenSeries {
  item: ExpertAsset;
  assetId: string;
  closes: Array<number | null>;
  volumesUsd: number[];
  traded: boolean[];
  // Horizon candles only cover the XLM pair; this scales them to the
  // all-markets weekly volume Stellar Expert reports today.
  volumeScale: number;
  // Historical series (Hubble) have no Stellar Expert snapshot for past dates,
  // so liquidity, maturity and age are derived from the market data itself.
  pointInTime?: { firstTradeIndex: number };
}

let snapshot: { expiresAt: number; tokens: TokenMetrics[] } | null = null;
let horizonServer: Horizon.Server | null = null;

function marketHorizon() {
  horizonServer ??= new Horizon.Server(MARKET_HORIZON_URL);
  return horizonServer;
}

export async function loadMarketSnapshot(): Promise<TokenMetrics[]> {
  if (snapshot && snapshot.expiresAt > Date.now()) return snapshot.tokens;

  // Two extra weeks so thinly traded tokens have a close to carry into the window.
  const history = await loadHistory(WINDOW_DAYS + 14);
  const lastIndex = history.xlmUsd.length - 1;
  const tokens = history.tokens
    .map((series) => metricsAt(series, lastIndex, { liveVolume: true }))
    .filter((token): token is TokenMetrics => token !== null);

  if (tokens.length < 3) throw new Error("Stellar market data returned fewer than 3 usable tokens.");
  snapshot = { expiresAt: Date.now() + SNAPSHOT_TTL_MS, tokens };
  return tokens;
}

// Daily series for today's universe over the last `days` days.
export async function loadHistory(days: number) {
  const end = Math.floor(Date.now() / DAY_MS) * DAY_MS + DAY_MS;
  const start = end - days * DAY_MS;

  const [universe, xlm] = await Promise.all([fetchUniverse(), fetchDailySeries(Asset.native(), MAINNET_USDC, start, end)]);
  const xlmUsd = xlm.closes.map((close) => close ?? 0);
  if (xlm.tradeDays < Math.min(days, 10)) throw new Error("Not enough XLM/USDC price history from Horizon.");

  const tokens = (
    await mapWithConcurrency(universe, 5, async (item): Promise<TokenSeries | null> => {
      const assetId = expertToAssetId(item.asset);
      try {
        if (assetId === "native") {
          return {
            item,
            assetId,
            closes: xlmUsd,
            volumesUsd: xlm.counterVolumes,
            traded: xlm.traded,
            volumeScale: scaleFor(item, xlm.counterVolumes)
          };
        }
        // Most liquidity is quoted against XLM; price in USD through XLM/USDC.
        const series = await fetchDailySeries(assetOf(assetId), Asset.native(), start, end);
        const volumesUsd = series.counterVolumes.map((volume, index) => volume * xlmUsd[index]);
        return {
          item,
          assetId,
          closes: series.closes.map((close, index) => (close === null ? null : close * xlmUsd[index])),
          volumesUsd,
          traded: series.traded,
          volumeScale: scaleFor(item, volumesUsd)
        };
      } catch {
        return null;
      }
    })
  ).filter((series): series is TokenSeries => series !== null);

  const dates = xlmUsd.map((_, index) => new Date(start + index * DAY_MS).toISOString().slice(0, 10));
  return { dates, xlmUsd, tokens };
}

// Metrics as they would have been computed at day `endIndex`, using only the
// WINDOW_DAYS days up to and including it.
export function metricsAt(series: TokenSeries, endIndex: number, options: { liveVolume?: boolean } = {}): TokenMetrics | null {
  const startIndex = endIndex - WINDOW_DAYS + 1;
  if (startIndex < 0) return null;

  const window = series.closes.slice(startIndex, endIndex + 1);
  if (window.some((close) => close === null || close <= 0)) return null;
  const closes = window as number[];
  const tradeDays = series.traded.slice(startIndex, endIndex + 1).filter(Boolean).length;
  if (tradeDays < MIN_TRADE_DAYS) return null;

  const returns = closes.slice(1).map((close, index) => Math.log(close / closes[index]));
  const meanReturn = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - meanReturn) ** 2, 0) / Math.max(1, returns.length - 1);
  const last = closes.at(-1)!;

  let peak = closes[0];
  let maxDrawdown = 0;
  for (const close of closes) {
    peak = Math.max(peak, close);
    maxDrawdown = Math.max(maxDrawdown, 1 - close / peak);
  }

  const { item } = series;
  const candleVolume7d = series.volumesUsd.slice(endIndex - 6, endIndex + 1).reduce((sum, value) => sum + value, 0);
  const derived = series.pointInTime ? derivedProfile(series, startIndex, endIndex, tradeDays) : null;

  return {
    assetId: series.assetId,
    code: item.code || "XLM",
    name: item.toml_info?.name || item.toml_info?.orgName || item.code || "Stellar Lumens",
    domain: item.domain,
    priceUsd: options.liveVolume ? item.price ?? last : last,
    volume7dUsd: options.liveVolume ? (item.volume7d ?? 0) / 1e7 : candleVolume7d * series.volumeScale,
    holders: derived ? derived.holders : item.trustlines?.funded ?? 0,
    ageDays: derived ? derived.ageDays : item.created ? (Date.now() / 1000 - item.created) / 86_400 : 3_650,
    rating: derived
      ? derived.rating
      : {
          average: item.rating?.average ?? 0,
          liquidity: item.rating?.liquidity ?? 0,
          age: item.rating?.age ?? 0,
          activity: item.rating?.activity ?? 0
        },
    dailyCloses: closes,
    tradeDays,
    return7d: last / closes[Math.max(0, closes.length - 8)] - 1,
    return30d: last / closes[0] - 1,
    volatility: Math.sqrt(variance) * Math.sqrt(365),
    maxDrawdown
  };
}

// Point-in-time stand-ins for Stellar Expert's rating, on the same 0-10 scale:
// liquidity from median daily USD volume ($10k/day ~ 4, $1M/day ~ 8), age from
// days since the first trade (3 years ~ 10), activity from days with trades.
// Holder counts are not available historically; a neutral value is used.
function derivedProfile(series: TokenSeries, startIndex: number, endIndex: number, tradeDays: number) {
  const volumes = series.volumesUsd.slice(startIndex, endIndex + 1).sort((a, b) => a - b);
  const medianVolume = volumes[Math.floor(volumes.length / 2)];
  const liquidity = clampRating(2 * (Math.log10(medianVolume + 1) - 2));
  const ageDays = endIndex - series.pointInTime!.firstTradeIndex;
  const age = clampRating((ageDays / 1095) * 10);
  const activity = clampRating((tradeDays / (endIndex - startIndex + 1)) * 10);
  return {
    holders: 20_000,
    ageDays,
    rating: { average: (liquidity + age + activity) / 3, liquidity, age, activity }
  };
}

function clampRating(value: number) {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

// USD value a buy of `amountUsdc` would receive right now on the mainnet DEX.
export async function quoteBuyValueUsd(token: TokenMetrics, amountUsdc: number) {
  const response = await marketHorizon()
    .strictSendPaths(MAINNET_USDC, amountUsdc.toFixed(7), [assetOf(token.assetId)])
    .call();
  const best = Math.max(0, ...response.records.map((record) => Number(record.destination_amount)));
  return best * token.priceUsd;
}

export async function fetchUniverse(): Promise<ExpertAsset[]> {
  const response = await fetch(`${STELLAR_EXPERT_URL}/asset?sort=volume7d&order=desc&limit=80`, {
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Stellar Expert asset list failed (${response.status}).`);
  const payload = (await response.json()) as { _embedded?: { records?: ExpertAsset[] } };

  return (payload._embedded?.records ?? [])
    .filter((item) => {
      const code = item.code || item.asset;
      const classicOrNative = item.asset === "XLM" || /^[A-Za-z0-9]{1,12}-G[A-Z2-7]{55}-\d$/.test(item.asset);
      return (
        classicOrNative &&
        !EXCLUDED_CODES.test(code) &&
        (item.price ?? 0) > 0 &&
        (item.volume7d ?? 0) / 1e7 >= MIN_VOLUME_7D_USD &&
        (item.rating?.average ?? 0) >= MIN_RATING &&
        (item.trustlines?.funded ?? 0) >= MIN_HOLDERS
      );
    })
    .slice(0, MAX_CANDIDATES);
}

// One close per day between start and end. Days before the first trade are
// null; later days without trades carry the previous close forward.
async function fetchDailySeries(base: Asset, counter: Asset, start: number, end: number) {
  const byDay = new Map<number, { close: number; open: number; counterVolume: number }>();
  for (let pageStart = start; pageStart < end; pageStart += PAGE_DAYS * DAY_MS) {
    const pageEnd = Math.min(end, pageStart + PAGE_DAYS * DAY_MS);
    const response = await withRetry(() =>
      marketHorizon()
        .tradeAggregation(base, counter, pageStart, pageEnd, DAY_MS, 0)
        .limit(PAGE_DAYS + 2)
        .order("asc")
        .call()
    );
    for (const record of response.records) {
      byDay.set(Number(record.timestamp), {
        close: Number(record.close),
        open: Number(record.open),
        counterVolume: Number(record.counter_volume)
      });
    }
  }

  const closes: Array<number | null> = [];
  const counterVolumes: number[] = [];
  const traded: boolean[] = [];
  let lastClose: number | null = null;
  for (let day = start; day < end; day += DAY_MS) {
    const candle = byDay.get(day);
    if (candle) lastClose = candle.close;
    closes.push(lastClose);
    counterVolumes.push(candle?.counterVolume ?? 0);
    traded.push(Boolean(candle));
  }

  return { closes, counterVolumes, traded, tradeDays: byDay.size };
}

// Public Horizon occasionally answers 503/429 under load; back off and retry.
async function withRetry<T>(task: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      const retryable = status === undefined || status === 429 || status >= 500;
      if (!retryable || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}

function scaleFor(item: ExpertAsset, volumesUsd: number[]) {
  const candleWeek = volumesUsd.slice(-7).reduce((sum, value) => sum + value, 0);
  const expertWeek = (item.volume7d ?? 0) / 1e7;
  return candleWeek > 0 ? Math.max(1, expertWeek / candleWeek) : 1;
}

function expertToAssetId(asset: string) {
  if (asset === "XLM") return "native";
  const [code, issuer] = asset.split("-");
  return `${code}:${issuer}`;
}

function assetOf(assetId: string) {
  if (assetId === "native") return Asset.native();
  const [code, issuer] = assetId.split(":");
  return new Asset(code, issuer);
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await task(items[index]);
      }
    })
  );
  return results;
}
