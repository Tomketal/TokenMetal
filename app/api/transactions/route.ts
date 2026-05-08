import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { listPositions } from "@/lib/positions/store";
import {
  listTransactions,
  summarizeTransactions,
  syncTransactionsFromPositions,
  transactionsDbPath
} from "@/lib/transactions/store";

export const runtime = "nodejs";

function parseOwner(request: Request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner")?.trim();
  if (!owner) return null;

  try {
    return new PublicKey(owner).toBase58();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const owner = parseOwner(request);
  if (!owner) {
    return NextResponse.json(
      { error: "Query parameter `owner` (valid Solana wallet address) is required." },
      { status: 400 }
    );
  }

  const positions = await listPositions(owner);
  await syncTransactionsFromPositions(positions);

  const [transactions, summary] = await Promise.all([
    listTransactions(owner),
    summarizeTransactions(owner)
  ]);

  const openPositions = positions.filter((position) => position.status === "open");
  const closedPositions = positions.filter((position) => position.status === "closed");
  const unrealizedPnlUsd = openPositions.reduce(
    (sum, position) => sum + (position.pnlUsd || 0),
    0
  );
  const closedPnlUsd = closedPositions.reduce(
    (sum, position) => sum + (position.pnlUsd || 0),
    0
  );

  return NextResponse.json({
    owner,
    generatedAt: new Date().toISOString(),
    dbPath: transactionsDbPath,
    summary: {
      ...summary,
      openPositions: openPositions.length,
      closedPositions: closedPositions.length,
      unrealizedPnlUsd,
      closedPnlUsd
    },
    transactions
  });
}
