import { promises as fs } from "node:fs";
import path from "node:path";
import { appConfig } from "@/lib/config";
import {
  recordEntryTransaction,
  recordExitTransaction
} from "@/lib/transactions/store";
import type { Position, PreparedTrade } from "@/lib/types";

const bundledDataFile = path.join(process.cwd(), "data", "positions.json");
const isServerlessRuntime = process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) || Boolean(process.env.LAMBDA_TASK_ROOT);
const defaultWritableDataFile = isServerlessRuntime
  ? path.join("/tmp", "token-letal", "positions.json")
  : bundledDataFile;
const dataFile = process.env.POSITIONS_DATA_PATH || defaultWritableDataFile;

export async function listPositions(owner?: string) {
  const positions = await readPositions();
  return owner ? positions.filter((position) => position.owner === owner) : positions;
}

export async function createPosition(preparedTrade: PreparedTrade, signature: string) {
  const positions = await readPositions();
  const existing = positions.find(
    (position) =>
      position.owner === preparedTrade.owner &&
      position.mintAddress === preparedTrade.outputMint &&
      position.status === "open"
  );

  if (existing) {
    throw new Error(`There is already one active ${preparedTrade.recommendation.tokenSymbol} position.`);
  }

  const entryPrice = preparedTrade.expectedTokenAmountUi > 0 ? preparedTrade.amountUsdc / preparedTrade.expectedTokenAmountUi : 0;
  const position: Position = {
    id: crypto.randomUUID(),
    owner: preparedTrade.owner,
    tokenName: preparedTrade.recommendation.tokenName,
    tokenSymbol: preparedTrade.recommendation.tokenSymbol,
    mintAddress: preparedTrade.outputMint,
    tokenDecimals: preparedTrade.recommendation.tokenDecimals ?? 7,
    tokenAmountRaw: preparedTrade.expectedTokenAmountRaw,
    tokenAmountUi: preparedTrade.expectedTokenAmountUi,
    entryUsdc: preparedTrade.amountUsdc,
    entryPrice,
    currentPrice: entryPrice,
    currentValueUsd: preparedTrade.amountUsdc,
    pnlUsd: 0,
    pnlPercent: 0,
    takeProfit: preparedTrade.recommendation.takeProfit,
    stopLoss: preparedTrade.recommendation.stopLoss,
    trailingStop: preparedTrade.recommendation.trailingStop,
    expectedHoldingPeriod: preparedTrade.recommendation.expectedHoldingPeriod,
    riskLevel: String(preparedTrade.recommendation.riskScore),
    recommendationRationale: preparedTrade.recommendation.profileMatch,
    openSignature: signature,
    status: "open",
    engine: appConfig.tradeEngine,
    openedAt: new Date().toISOString()
  };

  positions.push(position);
  await writePositions(positions);
  await recordLedgerSafely(() => recordEntryTransaction(position, preparedTrade, signature));
  return position;
}

// On serverless hosts each instance has its own temporary disk, so the
// instance closing a position may never have seen it open. The client's copy
// is accepted as a fallback; the close itself is still verified on-chain.
export async function findPosition(positionId: string, owner: string, clientCopy?: unknown) {
  const positions = await readPositions();
  const stored = positions.find((item) => item.id === positionId && item.owner === owner);
  if (stored) return stored;

  const candidate = clientCopy as Partial<Position> | undefined;
  if (
    candidate &&
    candidate.id === positionId &&
    candidate.owner === owner &&
    typeof candidate.mintAddress === "string" &&
    typeof candidate.tokenAmountRaw === "string" &&
    typeof candidate.entryUsdc === "number"
  ) {
    return candidate as Position;
  }
  return null;
}

export async function closePosition(
  positionId: string,
  owner: string,
  signature: string,
  finalSnapshot?: Partial<Position>,
  clientCopy?: unknown
) {
  const positions = await readPositions();
  let position = positions.find((item) => item.id === positionId && item.owner === owner);
  if (!position) {
    const fallback = await findPosition(positionId, owner, clientCopy);
    if (!fallback) throw new Error("Position not found.");
    position = { ...fallback, status: "open" };
    positions.push(position);
  }
  if (position.status === "closed") return position;

  const entrySnapshot: Position = { ...position };
  Object.assign(position, finalSnapshot);
  position.status = "closed";
  position.closeSignature = signature;
  position.closedAt = new Date().toISOString();
  await writePositions(positions);
  await recordLedgerSafely(() => recordExitTransaction(entrySnapshot, position, signature));
  return position;
}

// The SQLite activity ledger is a convenience; a failure there (e.g. a
// read-only or wiped disk) must never fail a trade that already settled.
async function recordLedgerSafely(record: () => Promise<unknown> | unknown) {
  try {
    await record();
  } catch (error) {
    console.error("Transaction ledger write failed:", error);
  }
}

export async function patchPosition(positionId: string, owner: string, patch: Partial<Position>) {
  const positions = await readPositions();
  const position = positions.find((item) => item.id === positionId && item.owner === owner);
  if (!position) throw new Error("Position not found.");
  Object.assign(position, patch);
  await writePositions(positions);
  return position;
}

async function readPositions(): Promise<Position[]> {
  try {
    const file = await fs.readFile(dataFile, "utf8");
    return JSON.parse(file) as Position[];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" && dataFile !== bundledDataFile) {
      try {
        const fallback = await fs.readFile(bundledDataFile, "utf8");
        return JSON.parse(fallback) as Position[];
      } catch (fallbackError) {
        if ((fallbackError as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw fallbackError;
      }
    }
    if (code === "ENOENT") return [];
    throw error;
  }
}

async function writePositions(positions: Position[]) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(positions, null, 2));
}
