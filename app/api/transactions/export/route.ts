import { NextResponse } from "next/server";
import { isValidStellarAddress } from "@/lib/stellar/assets";
import { listPositions } from "@/lib/positions/store";
import {
  buildTransactionsCsv,
  listTransactions,
  syncTransactionsFromPositions
} from "@/lib/transactions/store";

export const runtime = "nodejs";

function parseOwner(request: Request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner")?.trim();
  if (!owner) return null;

  return isValidStellarAddress(owner) ? owner : null;
}

export async function GET(request: Request) {
  const owner = parseOwner(request);
  if (!owner) {
    return NextResponse.json(
      { error: "Query parameter `owner` (valid Stellar wallet address) is required." },
      { status: 400 }
    );
  }

  const positions = await listPositions(owner);
  await syncTransactionsFromPositions(positions);

  const transactions = await listTransactions(owner);
  const csv = `\uFEFF${buildTransactionsCsv(transactions)}`;
  const stamp = new Date().toISOString().slice(0, 10);
  const ownerSuffix = `-${owner.slice(0, 8)}`;
  const fileName = `token-metal-transactions${ownerSuffix}-${stamp}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`
    }
  });
}
