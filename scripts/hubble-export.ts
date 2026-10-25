// Exports Stellar DEX history from Hubble (SDF's public BigQuery dataset) into
// local JSON caches used by the backtest and the live engine.
//
//   npx tsx scripts/hubble-export.ts prices          (dry run: shows GB it would read)
//   npx tsx scripts/hubble-export.ts prices --run    (runs and writes data/hubble/)
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

async function main() {
  if (mode !== "prices") {
    console.error("Usage: npx tsx scripts/hubble-export.ts prices [--run]");
    process.exit(1);
  }

  const [dryJob] = await bq.createQueryJob({ query: PRICES_SQL, dryRun: true });
  const gb = Number(dryJob.metadata.statistics.totalBytesProcessed) / 1e9;
  console.log(`prices: would read up to ${gb.toFixed(1)} GB (from ${FROM_DATE})`);
  if (!RUN) return;

  const started = Date.now();
  const [job] = await bq.createQueryJob({ query: PRICES_SQL });
  const [rows] = await job.getQueryResults();
  const [meta] = await job.getMetadata();
  const billed = Number(meta.statistics.query?.totalBytesBilled ?? 0) / 1e9;

  mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, "daily-prices.json");
  writeFileSync(file, JSON.stringify({ exportedAt: new Date().toISOString(), from: FROM_DATE, rows }));
  const assets = new Set(rows.map((row: { code: string; issuer: string }) => `${row.code}:${row.issuer}`));
  console.log(
    `wrote ${rows.length} rows for ${assets.size} assets to ${file} · billed ${billed.toFixed(1)} GB · ${Math.round((Date.now() - started) / 1000)}s`
  );
}

main().catch((error) => {
  console.error("ERR", error.message);
  process.exit(1);
});
