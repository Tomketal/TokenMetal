// Backtest of the Stellar recommendation engine on Horizon price history.
//
//   npm run backtest -- [days] [--variants] [--hubble] [--out=file.json]
//
// Every 7 days in the past, the engine ranks the universe using only the 31
// days of data available on that date, picks 3 tokens per risk profile and
// holding period, and holds them. Results are compared with:
//   - XLM: put the same money in XLM for the same period
//   - Random: 3 tokens drawn at random from the same universe on that date
// All strategies pay the same 2% entry commission plus a spread estimate.
//
// --variants compares scoring settings without peeking: the best setting is
// chosen on the first half of history (trades that END before the cutoff) and
// then judged only on the second half.
//
// --hubble uses the multi-year Hubble export (scripts/hubble-export.ts) and the
// universe each date really had, instead of today's top tokens from Horizon.

import { writeFileSync } from "node:fs";
import { loadHubbleHistory } from "@/lib/recommendations/hubble";
import { loadHistory, metricsAt, type TokenMetrics, type TokenSeries } from "@/lib/recommendations/market";
import {
  DEFAULT_SCORING,
  duplicatesAPick,
  exitLevels,
  rankTokens,
  type ScoredToken,
  type ScoringOptions
} from "@/lib/recommendations/stellar";
import { COMMISSION_BPS } from "@/lib/commission";
import { holdingDays } from "@/lib/recommendations/scoring";
import { riskProfiles, type HoldingPeriod, type RecommendationRequest, type RiskProfile } from "@/lib/types";

const args = process.argv.slice(2);
const HISTORY_DAYS = Number(args.find((arg) => /^\d+$/.test(arg)) || 420);
const OUT_FILE = args.find((arg) => arg.startsWith("--out="))?.slice("--out=".length);
const VARIANTS_MODE = args.includes("--variants");
const HUBBLE_MODE = args.includes("--hubble");
// Point-in-time universe rules for the Hubble history.
const MIN_VOLUME_7D_USD = 10_000;
const MIN_DERIVED_RATING = 5;
const MIN_VOLATILITY = 0.1; // below this the asset is pegged to something
const MAX_DAILY_JUMP = Math.log(5); // 5x in a day: manipulation or bad prints
const STALE_DAYS = 14;
const STALE_EXIT_HAIRCUT = 0.3;
const STEP_DAYS = 7;
const COMMISSION = COMMISSION_BPS / 10_000;
const RANDOM_SAMPLES = 300;
// 365-day horizons need more history than Horizon gives us cheaply; skip them.
const HORIZONS: HoldingPeriod[] = ["3 days", "1 week", "1 month", "3 months", "6 months"];

const VARIANTS: Record<string, ScoringOptions> = {
  "current (momentum + trend)": DEFAULT_SCORING,
  "no price signals": { momentum: 0, trend: 0, lowVolatilityTilt: 0 },
  "trend only": { momentum: 0, trend: 1, lowVolatilityTilt: 0 },
  "fade 7d (reversal)": { momentum: -1, trend: 1, lowVolatilityTilt: 0 },
  "fade 7d + 30d": { momentum: -1, trend: -1, lowVolatilityTilt: 0 },
  "low volatility": { momentum: 0, trend: 0, lowVolatilityTilt: 1 },
  "fade 7d + low vol": { momentum: -1, trend: 0, lowVolatilityTilt: 1 },
  "quality tilt": { momentum: 1, trend: 1, lowVolatilityTilt: 0, qualityTilt: 1 },
  "strong quality tilt": { momentum: 1, trend: 1, lowVolatilityTilt: 0, qualityTilt: 2 },
  "quality, no price signals": { momentum: 0, trend: 0, lowVolatilityTilt: 0, qualityTilt: 2 }
};

interface Trade {
  profile: RiskProfile;
  date: string;
  endIndex: number;
  picks: string[];
  engine: number; // with take-profit / stop-loss exits
  engineHold: number; // same picks, held to the horizon
  random: number; // expected random 3-token portfolio
  percentile: number; // share of random portfolios engineHold beats
  xlm: number;
  realizedVol: number; // annualized vol of the picks while held
  worstPick: number;
}

type History = Awaited<ReturnType<typeof loadHistory>>;
type Entry = { series: TokenSeries; metrics: TokenMetrics };
type Results = Record<string, Record<string, Trade[]>>;

void main();

async function main() {
  const history = HUBBLE_MODE ? loadHubbleHistory() : await loadHistory(HISTORY_DAYS);
  const { dates, tokens } = history;
  const lastIndex = dates.length - 1;
  console.log(`Universe: ${tokens.length} tokens (${tokens.map((t) => t.item.code || "XLM").join(", ")})`);
  console.log(`History: ${dates[0]} -> ${dates[lastIndex]}\n`);

  if (VARIANTS_MODE) {
    compareVariants(history);
    return;
  }

  const results = simulate(history, DEFAULT_SCORING);
  for (const holdingPeriod of HORIZONS) {
    const rows = riskProfiles.map((profile) => summarize(profile, results[holdingPeriod][profile]));
    console.log(`=== Holding period: ${holdingPeriod} (${rows[0].n} entry dates) ===`);
    console.table(rows);
  }

  console.log("=== All profiles and horizons ===");
  console.table([summarize("ALL", allTrades(results))]);

  console.log("=== Does the risk profile change the risk you actually get? (1 month) ===");
  console.table(
    riskProfiles.map((profile) => {
      const trades = results["1 month"][profile];
      return {
        profile,
        "realized vol": pct(mean(trades.map((trade) => trade.realizedVol))),
        "worst pick": pct(Math.min(...trades.map((trade) => trade.worstPick))),
        "most picked": topPicks(trades)
      };
    })
  );

  if (OUT_FILE) {
    writeFileSync(OUT_FILE, JSON.stringify({ dates: [dates[0], dates[lastIndex]], results }, null, 2));
    console.log(`Raw results written to ${OUT_FILE}`);
  }
}

function compareVariants(history: History) {
  const lastIndex = history.dates.length - 1;
  const cutoff = Math.floor((30 + lastIndex) / 2);
  console.log(`Calibration: trades ending before ${history.dates[cutoff]} · Validation: trades starting on/after it\n`);

  const rows = Object.entries(VARIANTS).map(([name, options]) => {
    const trades = allTrades(simulate(history, options));
    const calibration = trades.filter((trade) => trade.endIndex < cutoff);
    const validation = trades.filter((trade) => history.dates.indexOf(trade.date) >= cutoff);
    return { name, calibration, validation };
  });

  console.table(
    rows.map(({ name, calibration, validation }) => ({
      variant: name,
      "calib n": calibration.length,
      "calib pctile": pct(mean(calibration.map((trade) => trade.percentile))),
      "calib return": pct(mean(calibration.map((trade) => trade.engine))),
      "valid n": validation.length,
      "valid pctile": pct(mean(validation.map((trade) => trade.percentile))),
      "valid return": pct(mean(validation.map((trade) => trade.engine))),
      "valid XLM": pct(mean(validation.map((trade) => trade.xlm))),
      "valid beats XLM": pct(share(validation, (trade) => trade.engine > trade.xlm))
    }))
  );

  console.log("Validation selection percentile by risk profile:");
  console.table(
    rows.map(({ name, validation }) => ({
      variant: name,
      ...Object.fromEntries(
        riskProfiles.map((profile) => [
          profile,
          pct(mean(validation.filter((trade) => trade.profile === profile).map((trade) => trade.percentile)))
        ])
      )
    }))
  );

  const chosen = rows.reduce((best, row) =>
    mean(row.calibration.map((trade) => trade.percentile)) > mean(best.calibration.map((trade) => trade.percentile))
      ? row
      : best
  );
  const baseline = rows[0];
  console.log(`Chosen on calibration data: "${chosen.name}"`);
  console.log(
    `Validation selection percentile: ${pct(mean(chosen.validation.map((t) => t.percentile)))} ` +
      `(current engine: ${pct(mean(baseline.validation.map((t) => t.percentile)))}, random = +50.0%)`
  );
}

function simulate(history: History, options: ScoringOptions): Results {
  const { dates, xlmUsd, tokens } = history;
  const lastIndex = dates.length - 1;
  const rng = mulberry32(42);
  const results: Results = {};
  const eligibleAt = new Map<number, Entry[]>();
  const eligible = (t: number) => {
    if (!eligibleAt.has(t)) {
      eligibleAt.set(
        t,
        tokens
          .map((series) => ({ series, metrics: metricsAt(series, t) }))
          .filter((entry): entry is Entry => entry.metrics !== null && passesUniverseRules(entry.metrics))
      );
    }
    return eligibleAt.get(t)!;
  };

  for (const holdingPeriod of HORIZONS) {
    const hold = holdingDays[holdingPeriod];
    results[holdingPeriod] = {};

    for (const riskProfile of riskProfiles) {
      const trades: Trade[] = [];
      const request: RecommendationRequest = { usdcBalance: 200, riskProfile, allocationPercentage: 25, holdingPeriod };

      for (let t = 30; t + hold <= lastIndex; t += STEP_DAYS) {
        // Only tokens the engine could have seen on day t and that still trade at t + hold.
        const available = eligible(t).filter((entry) => entry.series.closes[t + hold]);
        if (available.length < 4) continue;

        const ranked = rankTokens(available.map((entry) => entry.metrics), request, options);
        const picks: ScoredToken[] = [];
        for (const candidate of ranked) {
          if (picks.length === 3) break;
          if (!duplicatesAPick(picks, candidate)) picks.push(candidate);
        }

        const seriesOf = (assetId: string) => available.find((entry) => entry.series.assetId === assetId)!.series;
        const engineReturns = picks.map((pick) => {
          const { takeProfit, stopLoss } = exitLevels(pick.token, request);
          return withExits(seriesOf(pick.token.assetId), pick.token, t, hold, takeProfit, stopLoss);
        });
        const holdReturns = picks.map((pick) => holdReturn(seriesOf(pick.token.assetId), pick.token, t, hold));
        const universeReturns = available.map((entry) => holdReturn(entry.series, entry.metrics, t, hold));

        const engineHold = mean(holdReturns);
        let beaten = 0;
        let randomSum = 0;
        for (let sample = 0; sample < RANDOM_SAMPLES; sample++) {
          const portfolio = mean(sampleWithoutReplacement(universeReturns, picks.length, rng));
          randomSum += portfolio;
          if (engineHold > portfolio) beaten++;
        }

        trades.push({
          profile: riskProfile,
          date: dates[t],
          endIndex: t + hold,
          picks: picks.map((pick) => pick.token.code),
          engine: mean(engineReturns),
          engineHold,
          random: randomSum / RANDOM_SAMPLES,
          percentile: beaten / RANDOM_SAMPLES,
          xlm: xlmUsd[t + hold] / xlmUsd[t] - 1 - COMMISSION - 2 * 0.002,
          realizedVol: mean(picks.map((pick) => realizedVolatility(seriesOf(pick.token.assetId), t, hold))),
          worstPick: Math.min(...holdReturns)
        });
      }

      results[holdingPeriod][riskProfile] = trades;
    }
  }

  return results;
}

function allTrades(results: Results) {
  return HORIZONS.flatMap((h) => riskProfiles.flatMap((p) => results[h][p]));
}

function summarize(profile: RiskProfile | "ALL", trades: Trade[]) {
  return {
    profile,
    n: trades.length,
    "engine (TP/SL)": pct(mean(trades.map((trade) => trade.engine))),
    "engine (hold)": pct(mean(trades.map((trade) => trade.engineHold))),
    random: pct(mean(trades.map((trade) => trade.random))),
    XLM: pct(mean(trades.map((trade) => trade.xlm))),
    "beats XLM": pct(share(trades, (trade) => trade.engine > trade.xlm)),
    "beats random": pct(share(trades, (trade) => trade.engine > trade.random)),
    "selection pctile": pct(mean(trades.map((trade) => trade.percentile))),
    "win rate": pct(share(trades, (trade) => trade.engine > 0))
  };
}

function passesUniverseRules(metrics: TokenMetrics) {
  if (!HUBBLE_MODE) return true; // Horizon mode already uses today's filtered universe
  const closes = metrics.dailyCloses;
  const maxJump = Math.max(...closes.slice(1).map((close, index) => Math.abs(Math.log(close / closes[index]))));
  return (
    metrics.volume7dUsd >= MIN_VOLUME_7D_USD &&
    metrics.rating.average >= MIN_DERIVED_RATING &&
    metrics.volatility >= MIN_VOLATILITY &&
    maxJump < MAX_DAILY_JUMP
  );
}

// Return after costs, exiting at the first daily close beyond take-profit or stop-loss.
function withExits(series: TokenSeries, token: TokenMetrics, t: number, hold: number, takeProfit: number, stopLoss: number) {
  const entry = series.closes[t]!;
  let exitDay = t + hold;
  for (let day = t + 1; day <= t + hold; day++) {
    const change = series.closes[day]! / entry - 1;
    if (change >= takeProfit || change <= -stopLoss) {
      exitDay = day;
      break;
    }
  }
  return exitPrice(series, exitDay) / entry - 1 - roundTripCost(token);
}

function holdReturn(series: TokenSeries, token: TokenMetrics, t: number, hold: number) {
  return exitPrice(series, t + hold) / series.closes[t]! - 1 - roundTripCost(token);
}

// A token nobody has traded for two weeks can't really be sold at its last print.
function exitPrice(series: TokenSeries, day: number) {
  const recentlyTraded = series.traded.slice(Math.max(0, day - STALE_DAYS + 1), day + 1).some(Boolean);
  return series.closes[day]! * (recentlyTraded ? 1 : 1 - STALE_EXIT_HAIRCUT);
}

// Commission on entry plus an estimated spread on both legs, wider for thin markets.
function roundTripCost(token: TokenMetrics) {
  const liquidity = token.rating.liquidity;
  const spread = liquidity >= 8 ? 0.002 : liquidity >= 5 ? 0.005 : 0.012;
  return COMMISSION + 2 * spread;
}

function realizedVolatility(series: TokenSeries, t: number, hold: number) {
  const closes = series.closes.slice(t, t + hold + 1) as number[];
  const returns = closes.slice(1).map((close, index) => Math.log(close / closes[index]));
  if (returns.length < 2) return 0;
  const average = mean(returns);
  const variance = returns.reduce((sum, value) => sum + (value - average) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(365);
}

function topPicks(trades: Trade[]) {
  const counts = new Map<string, number>();
  for (const trade of trades) for (const code of trade.picks) counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([code, count]) => `${code} ${Math.round((count / trades.length) * 100)}%`)
    .join(", ");
}

function sampleWithoutReplacement<T>(items: T[], count: number, random: () => number) {
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length; i++) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return out;
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function share<T>(items: T[], predicate: (item: T) => boolean) {
  return items.length ? items.filter(predicate).length / items.length : 0;
}

function pct(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
