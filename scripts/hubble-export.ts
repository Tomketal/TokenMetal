// Exports Stellar DEX history from Hubble (SDF's public BigQuery dataset) into
// local JSON caches used by the backtest and the live engine.
//
//   npx tsx scripts/hubble-export.ts prices          (dry run: shows GB it would read)
//   npx tsx scripts/hubble-export.ts prices --run    (runs and writes data/hubble/)
//   npx tsx scripts/hubble-export.ts wallets [--run] (weekly flows per wallet, for smart money)
//
// Needs Application Default Credentials (gcloud auth application-default login)
// and BIGQUERY_PROJECT (defaults to tokenmetal-stellar).

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BigQuery } from "@google-cloud/bigquery";

const PROJECT = process.env.BIGQUERY_PROJECT || "tokenmetal-stellar";
const OUT_DIR = path.join(process.cwd(), "data", "hubble");
const FROM_DATE = process.env.HUBBLE_FROM || "2021-03-01";
const [mode, ...flags] = process.argv.slice(2);
const RUN = flags.includes("--run");
const bq = new BigQuery({ projectId: PROJECT });

const DATASET = "`crypto-stellar.crypto_stellar`";

// Daily VWAP of every asset against XLM and against USDC (one table scan; each
// trade is read once per quote asset it touches). Assets need a sustained
// market in at least one of the two quotes to be kept.
const PRICES_SQL = `
with ids as (
  select
    (select asset_id from ${DATASET}.history_assets where asset_type = 'native' limit 1) as xlm,
    (select asset_id from ${DATASET}.history_assets
      where asset_code = 'USDC' and asset_issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' limit 1) as usdc
),
legs as (
  select
    date(t.ledger_closed_at) as day,
    q.quote,
    if(t.selling_asset_id = q.quote_id, t.buying_asset_id, t.selling_asset_id) as asset_id,
    if(t.selling_asset_id = q.quote_id, t.selling_amount, t.buying_amount) as quote_amount,
    if(t.selling_asset_id = q.quote_id, t.buying_amount, t.selling_amount) as token_amount
  from ${DATASET}.history_trades t
  cross join ids
  cross join unnest([struct('XLM' as quote, ids.xlm as quote_id), struct('USDC' as quote, ids.usdc as quote_id)]) q
  where t.ledger_closed_at >= timestamp('${FROM_DATE}')
    and (t.selling_asset_id = q.quote_id or t.buying_asset_id = q.quote_id)
    and t.selling_asset_id != t.buying_asset_id
    and t.selling_amount > 0 and t.buying_amount > 0
),
daily as (
  select
    day,
    asset_id,
    sum(if(quote = 'XLM', quote_amount, 0)) as volume_xlm,
    safe_divide(sum(if(quote = 'XLM', quote_amount, 0)), sum(if(quote = 'XLM', token_amount, 0))) as price_xlm,
    countif(quote = 'XLM') as trades_xlm,
    sum(if(quote = 'USDC', quote_amount, 0)) as volume_usdc,
    safe_divide(sum(if(quote = 'USDC', quote_amount, 0)), sum(if(quote = 'USDC', token_amount, 0))) as price_usdc,
    countif(quote = 'USDC') as trades_usdc
  from legs
  group by day, asset_id
),
kept as (
  select asset_id from daily
  group by asset_id
  having count(*) >= 60 and (sum(volume_xlm) >= 2000000 or sum(volume_usdc) >= 300000)
)
select
  cast(d.day as string) as day,
  if(a.asset_type = 'native', 'XLM', a.asset_code) as code,
  a.asset_issuer as issuer,
  d.price_xlm, d.volume_xlm, d.trades_xlm,
  d.price_usdc, d.volume_usdc, d.trades_usdc
from daily d
join kept using (asset_id)
join ${DATASET}.history_assets a on a.asset_id = d.asset_id
order by code, issuer, day
`;

// Weekly net flows per wallet and token against XLM/USDC, for the most traded
// tokens. Liquidity pools and high-frequency bots (market makers, arbitrage)
// are left out: we want wallets that take positions, not ones that quote prices.
const WALLETS_FROM = process.env.HUBBLE_WALLETS_FROM || "2022-01-01";
const WALLETS_SQL = `
with ids as (
  select
    (select asset_id from ${DATASET}.history_assets where asset_type = 'native' limit 1) as xlm,
    (select asset_id from ${DATASET}.history_assets
      where asset_code = 'USDC' and asset_issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' limit 1) as usdc
),
trades as (
  select t.*, ids.xlm, ids.usdc
  from ${DATASET}.history_trades t cross join ids
  where t.ledger_closed_at >= timestamp('${WALLETS_FROM}')
    and (t.selling_asset_id in (ids.xlm, ids.usdc) or t.buying_asset_id in (ids.xlm, ids.usdc))
    and t.selling_asset_id != t.buying_asset_id
    and t.selling_amount > 0 and t.buying_amount > 0
    and t.selling_account_address is not null and t.buying_account_address is not null
),
-- Each trade has two sides. The seller gives selling_amount of selling_asset and
-- receives buying_amount of buying_asset; the buyer does the opposite.
sides as (
  select
    date_trunc(date(ledger_closed_at), week(monday)) as week,
    side.account,
    if(selling_asset_id in (xlm, usdc), buying_asset_id, selling_asset_id) as asset_id,
    if(selling_asset_id in (xlm, usdc), selling_asset_id, buying_asset_id) as quote_id,
    xlm,
    side.sign as sign,
    selling_asset_id, buying_asset_id, selling_amount, buying_amount, usdc
  from trades,
  unnest([struct(selling_account_address as account, 1 as sign), struct(buying_account_address as account, -1 as sign)]) side
),
legs as (
  select
    week, account, asset_id,
    -- seller (sign = 1) receives buying_asset; buyer (sign = -1) receives selling_asset
    case
      when selling_asset_id = asset_id then -sign * selling_amount   -- token was sold by seller
      else sign * buying_amount                                        -- token was bought by seller
    end as token_net,
    case
      when quote_id = xlm then (case when selling_asset_id = quote_id then -sign * selling_amount else sign * buying_amount end)
      else 0
    end as xlm_net,
    case
      when quote_id = usdc then (case when selling_asset_id = quote_id then -sign * selling_amount else sign * buying_amount end)
      else 0
    end as usdc_net
  from sides
  where asset_id not in (xlm, usdc)
),
top_assets as (
  select asset_id from legs
  group by asset_id
  order by sum(abs(xlm_net)) + 8 * sum(abs(usdc_net)) desc
  limit 150
),
weekly as (
  select week, account, asset_id, sum(token_net) as token_net, sum(xlm_net) as xlm_net, sum(usdc_net) as usdc_net, count(*) as trades
  from legs join top_assets using (asset_id)
  group by week, account, asset_id
),
humans as (
  select account from weekly
  group by account
  having max(trades) <= 300 and count(distinct week) >= 4
)
select cast(w.week as string) as week, w.account, a.asset_code as code, a.asset_issuer as issuer,
  w.token_net, w.xlm_net, w.usdc_net, w.trades
from weekly w
join humans using (account)
join ${DATASET}.history_assets a on a.asset_id = w.asset_id
`;

const QUERIES: Record<string, { sql: string; file: string; from: string }> = {
  prices: { sql: PRICES_SQL, file: "daily-prices.json", from: FROM_DATE },
  wallets: { sql: WALLETS_SQL, file: "weekly-wallet-flows.json", from: WALLETS_FROM }
};

async function main() {
  const spec = QUERIES[mode];
  if (!spec) {
    console.error("Usage: npx tsx scripts/hubble-export.ts <prices|wallets> [--run]");
    process.exit(1);
  }
  const query = spec.sql;

  const [dryJob] = await bq.createQueryJob({ query, dryRun: true });
  const gb = Number(dryJob.metadata.statistics.totalBytesProcessed) / 1e9;
  console.log(`${mode}: would read up to ${gb.toFixed(1)} GB (from ${spec.from})`);
  if (!RUN) return;

  const started = Date.now();
  const [job] = await bq.createQueryJob({ query });
  const [rows] = await job.getQueryResults();
  const [meta] = await job.getMetadata();
  const billed = Number(meta.statistics.query?.totalBytesBilled ?? 0) / 1e9;

  mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, spec.file);
  writeFileSync(file, JSON.stringify({ exportedAt: new Date().toISOString(), from: spec.from, rows }));
  const assets = new Set(rows.map((row: { code: string; issuer: string }) => `${row.code}:${row.issuer}`));
  console.log(
    `wrote ${rows.length} rows for ${assets.size} assets to ${file} · billed ${billed.toFixed(1)} GB · ${Math.round((Date.now() - started) / 1000)}s`
  );
}

main().catch((error) => {
  console.error("ERR", error.message);
  process.exit(1);
});
