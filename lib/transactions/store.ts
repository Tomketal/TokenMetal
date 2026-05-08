import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { appConfig } from "@/lib/config";
import { toRawAmount } from "@/lib/number";
import type { Position, PreparedTrade } from "@/lib/types";

const bundledDbFile = path.join(process.cwd(), "data", "transactions.db");
const isServerlessRuntime =
  process.env.VERCEL === "1" ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
  Boolean(process.env.LAMBDA_TASK_ROOT);
const defaultWritableDbFile = isServerlessRuntime
  ? path.join("/tmp", "token-letal", "transactions.db")
  : bundledDbFile;

export const transactionsDbPath =
  process.env.TRANSACTIONS_DB_PATH || defaultWritableDbFile;

export type TransactionSide = "buy" | "sell";

export interface TransactionRecord {
  id: string;
  positionId: string;
  owner: string;
  side: TransactionSide;
  tokenName: string;
  tokenSymbol: string;
  mintAddress: string;
  inputMint: string;
  outputMint: string;
  inputAmountRaw: string;
  inputAmountUi: number;
  outputAmountRaw: string;
  outputAmountUi: number;
  amountUsdc: number;
  priceUsdc: number | null;
  feeUsdc: number;
  pnlUsdc: number | null;
  pnlPercent: number | null;
  signature: string;
  engine: string | null;
  recommendation: unknown | null;
  quote: unknown | null;
  occurredAt: string;
}

export interface TransactionSummary {
  totalTransactions: number;
  buyCount: number;
  sellCount: number;
  tradedVolumeUsdc: number;
  totalFeesUsdc: number;
  realizedPnlUsdc: number;
  winningSellCount: number;
  winRatePercent: number;
}

interface InsertableTransaction {
  id: string;
  positionId: string;
  owner: string;
  side: TransactionSide;
  tokenName: string;
  tokenSymbol: string;
  mintAddress: string;
  inputMint: string;
  outputMint: string;
  inputAmountRaw: string;
  inputAmountUi: number;
  outputAmountRaw: string;
  outputAmountUi: number;
  amountUsdc: number;
  priceUsdc: number | null;
  feeUsdc: number;
  pnlUsdc: number | null;
  pnlPercent: number | null;
  signature: string;
  engine: string | null;
  recommendationJson: string | null;
  quoteJson: string | null;
  occurredAt: string;
}

interface RawTransactionRow {
  id: string;
  position_id: string;
  owner: string;
  side: TransactionSide;
  token_name: string;
  token_symbol: string;
  mint_address: string;
  input_mint: string;
  output_mint: string;
  input_amount_raw: string;
  input_amount_ui: number;
  output_amount_raw: string;
  output_amount_ui: number;
  amount_usdc: number;
  price_usdc: number | null;
  fee_usdc: number;
  pnl_usdc: number | null;
  pnl_percent: number | null;
  signature: string;
  engine: string | null;
  recommendation_json: string | null;
  quote_json: string | null;
  occurred_at: string;
}

interface RawSummaryRow {
  total_count: number | null;
  buy_count: number | null;
  sell_count: number | null;
  traded_volume_usdc: number | null;
  total_fees_usdc: number | null;
  realized_pnl_usdc: number | null;
  winning_sell_count: number | null;
}

const insertTransactionSql = `
  INSERT OR IGNORE INTO transactions (
    id,
    position_id,
    owner,
    side,
    token_name,
    token_symbol,
    mint_address,
    input_mint,
    output_mint,
    input_amount_raw,
    input_amount_ui,
    output_amount_raw,
    output_amount_ui,
    amount_usdc,
    price_usdc,
    fee_usdc,
    pnl_usdc,
    pnl_percent,
    signature,
    engine,
    recommendation_json,
    quote_json,
    occurred_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export async function recordEntryTransaction(
  position: Position,
  preparedTrade: PreparedTrade,
  signature: string
) {
  const inputAmountUi = preparedTrade.amountUsdc;
  const outputAmountUi = preparedTrade.expectedTokenAmountUi;
  const occurredAt = position.openedAt || new Date().toISOString();

  withDatabase((db) => {
    insertTransaction(db, {
      id: crypto.randomUUID(),
      positionId: position.id,
      owner: position.owner,
      side: "buy",
      tokenName: position.tokenName,
      tokenSymbol: position.tokenSymbol,
      mintAddress: position.mintAddress,
      inputMint: preparedTrade.inputMint,
      outputMint: preparedTrade.outputMint,
      inputAmountRaw: preparedTrade.amountUsdcRaw,
      inputAmountUi,
      outputAmountRaw: preparedTrade.expectedTokenAmountRaw,
      outputAmountUi,
      amountUsdc: inputAmountUi,
      priceUsdc: position.entryPrice,
      feeUsdc: preparedTrade.commissionUsdc ?? 0,
      pnlUsdc: null,
      pnlPercent: null,
      signature,
      engine: position.engine || appConfig.tradeEngine,
      recommendationJson: toJson(preparedTrade.recommendation),
      quoteJson: toJson(preparedTrade.quoteResponse),
      occurredAt
    });
  });
}

export async function recordExitTransaction(
  entryPosition: Position,
  closedPosition: Position,
  signature: string
) {
  const usdcOutput = ensureFinite(
    closedPosition.currentValueUsd,
    entryPosition.currentValueUsd ?? entryPosition.entryUsdc
  );
  const pnlUsdc = ensureFinite(
    closedPosition.pnlUsd,
    usdcOutput - entryPosition.entryUsdc
  );
  const pnlPercent = ensureFinite(
    closedPosition.pnlPercent,
    entryPosition.entryUsdc > 0 ? (pnlUsdc / entryPosition.entryUsdc) * 100 : 0
  );
  const occurredAt = closedPosition.closedAt || new Date().toISOString();
  const closeOutputMint =
    appConfig.tradeEngine === "raydium-devnet"
      ? appConfig.raydiumDevnetInputMint || appConfig.usdcMint
      : appConfig.usdcMint;

  withDatabase((db) => {
    insertTransaction(db, {
      id: crypto.randomUUID(),
      positionId: closedPosition.id,
      owner: closedPosition.owner,
      side: "sell",
      tokenName: closedPosition.tokenName,
      tokenSymbol: closedPosition.tokenSymbol,
      mintAddress: closedPosition.mintAddress,
      inputMint: closedPosition.mintAddress,
      outputMint: closeOutputMint,
      inputAmountRaw: closedPosition.tokenAmountRaw,
      inputAmountUi: closedPosition.tokenAmountUi,
      outputAmountRaw: toRawAmount(usdcOutput, appConfig.usdcDecimals),
      outputAmountUi: usdcOutput,
      amountUsdc: usdcOutput,
      priceUsdc: closedPosition.currentPrice,
      feeUsdc: 0,
      pnlUsdc,
      pnlPercent,
      signature,
      engine: closedPosition.engine || appConfig.tradeEngine,
      recommendationJson: toJson({
        takeProfit: closedPosition.takeProfit,
        stopLoss: closedPosition.stopLoss,
        trailingStop: closedPosition.trailingStop,
        expectedHoldingPeriod: closedPosition.expectedHoldingPeriod,
        riskLevel: closedPosition.riskLevel
      }),
      quoteJson: null,
      occurredAt
    });
  });
}

export async function syncTransactionsFromPositions(positions: Position[]) {
  if (positions.length === 0) return;

  withDatabase((db) => {
    const insertStatement = db.prepare(insertTransactionSql);
    db.exec("BEGIN");
    try {
      for (const position of positions) {
        if (position.openSignature) {
          insertStatement.run(
            `legacy-open-${position.openSignature}`,
            position.id,
            position.owner,
            "buy",
            position.tokenName,
            position.tokenSymbol,
            position.mintAddress,
            appConfig.usdcMint,
            position.mintAddress,
            toRawAmount(position.entryUsdc, appConfig.usdcDecimals),
            position.entryUsdc,
            position.tokenAmountRaw,
            position.tokenAmountUi,
            position.entryUsdc,
            position.entryPrice,
            0,
            null,
            null,
            position.openSignature,
            position.engine || appConfig.tradeEngine,
            toJson({
              takeProfit: position.takeProfit,
              stopLoss: position.stopLoss,
              trailingStop: position.trailingStop,
              expectedHoldingPeriod: position.expectedHoldingPeriod,
              riskLevel: position.riskLevel
            }),
            null,
            position.openedAt
          );
        }

        if (position.status === "closed" && position.closeSignature) {
          const usdcOutput = ensureFinite(
            position.currentValueUsd,
            position.entryUsdc
          );
          const pnlUsdc = ensureFinite(
            position.pnlUsd,
            usdcOutput - position.entryUsdc
          );
          const pnlPercent = ensureFinite(
            position.pnlPercent,
            position.entryUsdc > 0 ? (pnlUsdc / position.entryUsdc) * 100 : 0
          );
          const closeOutputMint =
            appConfig.tradeEngine === "raydium-devnet"
              ? appConfig.raydiumDevnetInputMint || appConfig.usdcMint
              : appConfig.usdcMint;

          insertStatement.run(
            `legacy-close-${position.closeSignature}`,
            position.id,
            position.owner,
            "sell",
            position.tokenName,
            position.tokenSymbol,
            position.mintAddress,
            position.mintAddress,
            closeOutputMint,
            position.tokenAmountRaw,
            position.tokenAmountUi,
            toRawAmount(usdcOutput, appConfig.usdcDecimals),
            usdcOutput,
            usdcOutput,
            position.currentPrice,
            0,
            pnlUsdc,
            pnlPercent,
            position.closeSignature,
            position.engine || appConfig.tradeEngine,
            toJson({
              takeProfit: position.takeProfit,
              stopLoss: position.stopLoss,
              trailingStop: position.trailingStop,
              expectedHoldingPeriod: position.expectedHoldingPeriod,
              riskLevel: position.riskLevel
            }),
            null,
            position.closedAt || new Date().toISOString()
          );
        }
      }

      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });
}

export async function listTransactions(owner?: string): Promise<TransactionRecord[]> {
  return withDatabase((db) => {
    const baseQuery = `
      SELECT
        id,
        position_id,
        owner,
        side,
        token_name,
        token_symbol,
        mint_address,
        input_mint,
        output_mint,
        input_amount_raw,
        input_amount_ui,
        output_amount_raw,
        output_amount_ui,
        amount_usdc,
        price_usdc,
        fee_usdc,
        pnl_usdc,
        pnl_percent,
        signature,
        engine,
        recommendation_json,
        quote_json,
        occurred_at
      FROM transactions
    `;
    const query = owner
      ? `${baseQuery} WHERE owner = ? ORDER BY occurred_at DESC, rowid DESC`
      : `${baseQuery} ORDER BY occurred_at DESC, rowid DESC`;
    const rows = owner
      ? (db.prepare(query).all(owner) as unknown as RawTransactionRow[])
      : (db.prepare(query).all() as unknown as RawTransactionRow[]);

    return rows.map((row) => ({
      id: row.id,
      positionId: row.position_id,
      owner: row.owner,
      side: row.side,
      tokenName: row.token_name,
      tokenSymbol: row.token_symbol,
      mintAddress: row.mint_address,
      inputMint: row.input_mint,
      outputMint: row.output_mint,
      inputAmountRaw: row.input_amount_raw,
      inputAmountUi: normalizeNumber(row.input_amount_ui),
      outputAmountRaw: row.output_amount_raw,
      outputAmountUi: normalizeNumber(row.output_amount_ui),
      amountUsdc: normalizeNumber(row.amount_usdc),
      priceUsdc: normalizeNullableNumber(row.price_usdc),
      feeUsdc: normalizeNumber(row.fee_usdc),
      pnlUsdc: normalizeNullableNumber(row.pnl_usdc),
      pnlPercent: normalizeNullableNumber(row.pnl_percent),
      signature: row.signature,
      engine: row.engine,
      recommendation: fromJson(row.recommendation_json),
      quote: fromJson(row.quote_json),
      occurredAt: row.occurred_at
    }));
  });
}

export async function summarizeTransactions(
  owner?: string
): Promise<TransactionSummary> {
  return withDatabase((db) => {
    const baseQuery = `
      SELECT
        COUNT(*) AS total_count,
        SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) AS buy_count,
        SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) AS sell_count,
        COALESCE(SUM(amount_usdc), 0) AS traded_volume_usdc,
        COALESCE(SUM(fee_usdc), 0) AS total_fees_usdc,
        COALESCE(SUM(CASE WHEN side = 'sell' THEN COALESCE(pnl_usdc, 0) ELSE 0 END), 0) AS realized_pnl_usdc,
        SUM(CASE WHEN side = 'sell' AND COALESCE(pnl_usdc, 0) > 0 THEN 1 ELSE 0 END) AS winning_sell_count
      FROM transactions
    `;
    const query = owner ? `${baseQuery} WHERE owner = ?` : baseQuery;
    const row = owner
      ? (db.prepare(query).get(owner) as RawSummaryRow | undefined)
      : (db.prepare(query).get() as RawSummaryRow | undefined);

    const sellCount = normalizeNumber(row?.sell_count);
    const winningSellCount = normalizeNumber(row?.winning_sell_count);
    const winRatePercent = sellCount > 0 ? (winningSellCount / sellCount) * 100 : 0;

    return {
      totalTransactions: normalizeNumber(row?.total_count),
      buyCount: normalizeNumber(row?.buy_count),
      sellCount,
      tradedVolumeUsdc: normalizeNumber(row?.traded_volume_usdc),
      totalFeesUsdc: normalizeNumber(row?.total_fees_usdc),
      realizedPnlUsdc: normalizeNumber(row?.realized_pnl_usdc),
      winningSellCount,
      winRatePercent
    };
  });
}

export function buildTransactionsCsv(transactions: TransactionRecord[]) {
  const headers = [
    "occurredAt",
    "side",
    "owner",
    "tokenSymbol",
    "tokenName",
    "mintAddress",
    "inputMint",
    "outputMint",
    "inputAmountRaw",
    "inputAmountUi",
    "outputAmountRaw",
    "outputAmountUi",
    "amountUsdc",
    "priceUsdc",
    "feeUsdc",
    "pnlUsdc",
    "pnlPercent",
    "signature",
    "positionId",
    "engine",
    "recommendationJson",
    "quoteJson"
  ];

  const lines = transactions.map((transaction) => {
    const recommendationJson = transaction.recommendation
      ? JSON.stringify(transaction.recommendation)
      : "";
    const quoteJson = transaction.quote ? JSON.stringify(transaction.quote) : "";

    return [
      transaction.occurredAt,
      transaction.side,
      transaction.owner,
      transaction.tokenSymbol,
      transaction.tokenName,
      transaction.mintAddress,
      transaction.inputMint,
      transaction.outputMint,
      transaction.inputAmountRaw,
      transaction.inputAmountUi,
      transaction.outputAmountRaw,
      transaction.outputAmountUi,
      transaction.amountUsdc,
      transaction.priceUsdc ?? "",
      transaction.feeUsdc,
      transaction.pnlUsdc ?? "",
      transaction.pnlPercent ?? "",
      transaction.signature,
      transaction.positionId,
      transaction.engine ?? "",
      recommendationJson,
      quoteJson
    ]
      .map(csvEscape)
      .join(",");
  });

  return [headers.join(","), ...lines].join("\n");
}

function withDatabase<T>(handler: (db: DatabaseSync) => T): T {
  fs.mkdirSync(path.dirname(transactionsDbPath), { recursive: true });
  const db = new DatabaseSync(transactionsDbPath);
  try {
    ensureSchema(db);
    return handler(db);
  } finally {
    db.close();
  }
}

function ensureSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      position_id TEXT NOT NULL,
      owner TEXT NOT NULL,
      side TEXT NOT NULL CHECK(side IN ('buy', 'sell')),
      token_name TEXT NOT NULL,
      token_symbol TEXT NOT NULL,
      mint_address TEXT NOT NULL,
      input_mint TEXT NOT NULL,
      output_mint TEXT NOT NULL,
      input_amount_raw TEXT NOT NULL,
      input_amount_ui REAL NOT NULL,
      output_amount_raw TEXT NOT NULL,
      output_amount_ui REAL NOT NULL,
      amount_usdc REAL NOT NULL,
      price_usdc REAL,
      fee_usdc REAL NOT NULL DEFAULT 0,
      pnl_usdc REAL,
      pnl_percent REAL,
      signature TEXT NOT NULL UNIQUE,
      engine TEXT,
      recommendation_json TEXT,
      quote_json TEXT,
      occurred_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_owner_occurred_at
      ON transactions(owner, occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_transactions_position_id
      ON transactions(position_id);
  `);
}

function insertTransaction(db: DatabaseSync, transaction: InsertableTransaction) {
  db.prepare(insertTransactionSql).run(
    transaction.id,
    transaction.positionId,
    transaction.owner,
    transaction.side,
    transaction.tokenName,
    transaction.tokenSymbol,
    transaction.mintAddress,
    transaction.inputMint,
    transaction.outputMint,
    transaction.inputAmountRaw,
    transaction.inputAmountUi,
    transaction.outputAmountRaw,
    transaction.outputAmountUi,
    transaction.amountUsdc,
    transaction.priceUsdc,
    transaction.feeUsdc,
    transaction.pnlUsdc,
    transaction.pnlPercent,
    transaction.signature,
    transaction.engine,
    transaction.recommendationJson,
    transaction.quoteJson,
    transaction.occurredAt
  );
}

function toJson(value: unknown): string | null {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function fromJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeNullableNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ensureFinite(primary: number | null | undefined, fallback: number) {
  if (typeof primary === "number" && Number.isFinite(primary)) return primary;
  return Number.isFinite(fallback) ? fallback : 0;
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!/["\n,]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}
