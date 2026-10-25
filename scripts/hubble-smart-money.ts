// Builds the weekly "smart money" signal from wallet flows stored in BigQuery.
//
//   npx tsx scripts/hubble-smart-money.ts          (dry run: shows GB it would read)
//   npx tsx scripts/hubble-smart-money.ts --run    (writes data/hubble/smart-money-weekly.json)
//
// Inputs:
//   tokenmetal.wallet_flows   weekly net flows per wallet/token (scripts/hubble-export.ts wallets)
//   tokenmetal.weekly_prices  uploaded here from data/hubble/daily-prices.json
//
// Every 4 weeks, wallets are ranked on the return of what they traded in the
// previous 26 weeks (PnL / USD spent, marked at the last week's prices). The
// top 10% with positive returns are "smart". The signal for a token and week
// is how much those wallets net bought that week. Rankings only use weeks
// before the period they apply to, so the signal never sees the future.

import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { BigQuery } from "@google-cloud/bigquery";
import { loadHubbleHistory } from "@/lib/recommendations/hubble";

const PROJECT = process.env.BIGQUERY_PROJECT || "tokenmetal-stellar";
const DATASET = "tokenmetal";
const RUN = process.argv.includes("--run");
const bq = new BigQuery({ projectId: PROJECT });
const OUT_FILE = path.join(process.cwd(), "data", "hubble", "smart-money-weekly.json");

const SMART_SQL = `
with prices as (
  select code, issuer, week, price_usd from \`${PROJECT}.${DATASET}.weekly_prices\`
),
cash as (
  select
    date(f.week) as week, f.account, f.code, f.issuer, f.token_net,
    f.xlm_net * x.price_usd + f.usdc_net as cash_usd,
    p.price_usd
  from \`${PROJECT}.${DATASET}.wallet_flows\` f
  join prices p on p.code = f.code and p.issuer = f.issuer and p.week = date(f.week)
  join prices x on x.code = 'XLM' and x.week = date(f.week)
),
targets as (
  select distinct week as target from cash
  where mod(date_diff(week, date '2022-01-03', week), 4) = 0
),
lookback as (
  select t.target, c.account, c.code, c.issuer,
    sum(c.cash_usd) as cash_usd, sum(c.token_net) as tokens,
    sum(greatest(-c.cash_usd, 0)) as spent_usd, count(distinct c.week) as weeks
  from targets t
  join cash c on c.week >= date_sub(t.target, interval 182 day) and c.week < t.target
  group by 1, 2, 3, 4
),
marked as (
  select l.target, l.account,
    sum(l.cash_usd + l.tokens * p.price_usd) as pnl_usd,
    sum(l.spent_usd) as spent_usd,
    max(l.weeks) as weeks
  from lookback l
  join prices p on p.code = l.code and p.issuer = l.issuer and p.week = date_sub(l.target, interval 7 day)
  group by 1, 2
),
ranked as (
  select target, account, pnl_usd / spent_usd as ret,
    percent_rank() over (partition by target order by pnl_usd / spent_usd) as pct
  from marked
  where spent_usd >= 500 and weeks >= 3
),
smart as (
  select target, account from ranked where pct >= 0.9 and ret > 0
),
smart_count as (
  select target, count(*) as smart_wallets from smart group by target
)
select
  cast(c.week as string) as week, c.code, c.issuer,
  sum(c.token_net * c.price_usd) as smart_net_usd,
  countif(c.token_net > 0) as smart_buyers,
  countif(c.token_net < 0) as smart_sellers,
  any_value(sc.smart_wallets) as smart_wallets
from cash c
join smart s
  on s.account = c.account
  and s.target = date_sub(c.week, interval mod(date_diff(c.week, date '2022-01-03', week), 4) week)
join smart_count sc on sc.target = s.target
group by 1, 2, 3
order by 1, 2, 3
`;

void main();

async function main() {
  await uploadWeeklyPrices();

  const [dry] = await bq.createQueryJob({ query: SMART_SQL, dryRun: true, location: "US" });
  const gb = Number(dry.metadata.statistics.totalBytesProcessed) / 1e9;
  console.log(`smart money: would read up to ${gb.toFixed(1)} GB`);
  if (!RUN) return;

  const started = Date.now();
  const [job] = await bq.createQueryJob({ query: SMART_SQL, location: "US" });
  const [rows] = await job.getQueryResults();
  const [meta] = await job.getMetadata();
  const billed = Number(meta.statistics.query?.totalBytesBilled ?? 0) / 1e9;

  mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify({ exportedAt: new Date().toISOString(), rows }));
  console.log(`wrote ${rows.length} rows to ${OUT_FILE} · billed ${billed.toFixed(1)} GB · ${Math.round((Date.now() - started) / 1000)}s`);
}

// Weekly close (Sunday) for every token in the local Hubble price cache, keyed
// by the Monday that starts the week, matching wallet_flows.week.
async function uploadWeeklyPrices() {
  const { dates, tokens } = loadHubbleHistory();
  const lines: string[] = [];
  for (const series of tokens) {
    const [code, issuer] = series.assetId === "native" ? ["XLM", ""] : series.assetId.split(":");
    for (let index = 0; index < dates.length; index++) {
      if (new Date(Date.parse(dates[index])).getUTCDay() !== 1) continue; // Mondays
      const close = series.closes[Math.min(index + 6, dates.length - 1)];
      if (!close) continue;
      lines.push(JSON.stringify({ code, issuer, week: dates[index], price_usd: close }));
    }
  }

  const file = path.join(os.tmpdir(), `tokenmetal-weekly-prices-${Date.now()}.ndjson`);
  writeFileSync(file, lines.join("\n"));
  await bq
    .dataset(DATASET)
    .table("weekly_prices")
    .load(file, {
      sourceFormat: "NEWLINE_DELIMITED_JSON",
      writeDisposition: "WRITE_TRUNCATE",
      schema: {
        fields: [
          { name: "code", type: "STRING" },
          { name: "issuer", type: "STRING" },
          { name: "week", type: "DATE" },
          { name: "price_usd", type: "FLOAT64" }
        ]
      }
    });
  console.log(`uploaded ${lines.length} weekly prices (${tokens.length} tokens, ~${Math.round(lines.length / tokens.length)} weeks each)`);
}
