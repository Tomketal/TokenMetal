import { Asset, Horizon } from "@stellar/stellar-sdk";

// Live market data for the Stellar recommendation engine.
// Universe + metadata come from the Stellar Expert public API; price history
// comes from Horizon daily trade aggregations. Always reads mainnet: testnet
// has no real market to learn from.

const STELLAR_EXPERT_URL = process.env.STELLAR_EXPERT_API_URL || "https://api.stellar.expert/explorer/public";
const MARKET_HORIZON_URL = process.env.MARKET_HORIZON_URL || "https://horizon.stellar.org";
const MAINNET_USDC = new Asset("USDC", "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
const SNAPSHOT_TTL_MS = 10 * 60_000;
const HISTORY_DAYS = 31;
const DAY_MS = 86_400_000;

// Fiat-pegged, stable and tokenized-yield assets are not "investments" for this
// product; several of the yield ones also require issuer authorization.
const EXCLUDED_CODES =
  /USD|EUR|GBP|ZAR|ARS|BRL|MXN|NGN|KES|TRY|CHF|JPY|CETES|TESOURO|USTRY|USDY|GOLD|XAU|SLVR/i;

const MIN_VOLUME_7D_USD = 10_000;
const MIN_RATING = 6.5;
const MIN_HOLDERS = 1_000;
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
}

interface ExpertAsset {
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

let snapshot: { expiresAt: number; tokens: TokenMetrics[] } | null = null;
let horizonServer: Horizon.Server | null = null;

function marketHorizon() {
  horizonServer ??= new Horizon.Server(MARKET_HORIZON_URL);
  return horizonServer;
}

export async function loadMarketSnapshot(): Promise<TokenMetrics[]> {
  if (snapshot && snapshot.expiresAt > Date.now()) return snapshot.tokens;

  const [universe, xlmUsd] = await Promise.all([fetchUniverse(), fetchDailyCloses(Asset.native(), MAINNET_USDC)]);
  if (xlmUsd.closes.length < 10) throw new Error("Not enough XLM/USDC price history from Horizon.");

  const tokens = (
    await mapWithConcurrency(universe, 5, async (item) => {
      try {
        return await buildMetrics(item, xlmUsd.closes);
      } catch {
        return null;
      }
    })
  ).filter((token): token is TokenMetrics => token !== null);

  if (tokens.length < 3) throw new Error("Stellar market data returned fewer than 3 usable tokens.");
  snapshot = { expiresAt: Date.now() + SNAPSHOT_TTL_MS, tokens };
  return tokens;
}

// USD value a buy of `amountUsdc` would receive right now on the mainnet DEX.
export async function quoteBuyValueUsd(token: TokenMetrics, amountUsdc: number) {
  const response = await marketHorizon()
    .strictSendPaths(MAINNET_USDC, amountUsdc.toFixed(7), [assetOf(token.assetId)])
    .call();
  const best = Math.max(0, ...response.records.map((record) => Number(record.destination_amount)));
  return best * token.priceUsd;
}

async function fetchUniverse(): Promise<ExpertAsset[]> {
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

async function buildMetrics(item: ExpertAsset, xlmUsdCloses: number[]): Promise<TokenMetrics | null> {
  const assetId = expertToAssetId(item.asset);
  let closes: number[];
  let tradeDays: number;

  if (assetId === "native") {
    closes = xlmUsdCloses;
    tradeDays = closes.length;
  } else {
    // Most liquidity is quoted against XLM; price in USD through XLM/USDC.
    const history = await fetchDailyCloses(assetOf(assetId), Asset.native());
    if (history.tradeDays < 8) return null;
    closes = history.closes.map((xlmPrice, index) => xlmPrice * xlmUsdCloses[index]);
    tradeDays = history.tradeDays;
  }

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

  return {
    assetId,
    code: item.code || "XLM",
    name: item.toml_info?.name || item.toml_info?.orgName || item.code || "Stellar Lumens",
    domain: item.domain,
    priceUsd: item.price ?? last,
    volume7dUsd: (item.volume7d ?? 0) / 1e7,
    holders: item.trustlines?.funded ?? 0,
    ageDays: item.created ? (Date.now() / 1000 - item.created) / 86_400 : 3_650,
    rating: {
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

// One close per day for the last HISTORY_DAYS days, forward-filling days
// without trades so every series lines up with the XLM/USDC series.
async function fetchDailyCloses(base: Asset, counter: Asset) {
  const end = Math.floor(Date.now() / DAY_MS) * DAY_MS + DAY_MS;
  const start = end - HISTORY_DAYS * DAY_MS;
  const response = await marketHorizon()
    .tradeAggregation(base, counter, start, end, DAY_MS, 0)
    .limit(HISTORY_DAYS + 2)
    .order("asc")
    .call();

  const byDay = new Map<number, number>();
  for (const record of response.records) byDay.set(Number(record.timestamp), Number(record.close));

  // Days before the first trade in the window take that trade's open price.
  const closes: number[] = [];
  let lastClose = response.records[0] ? Number(response.records[0].open) : 0;
  for (let day = start; day < end; day += DAY_MS) {
    lastClose = byDay.get(day) ?? lastClose;
    closes.push(lastClose);
  }

  return { closes, tradeDays: byDay.size };
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
