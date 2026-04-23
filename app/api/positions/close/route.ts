import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { refreshPositionPnl } from "@/lib/positions/pnl";
import { listPositions, closePosition } from "@/lib/positions/store";
import { prepareCloseTrade } from "@/lib/trading/jupiter";
import { closeRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = closeRequestSchema.parse(await request.json());

    if (body.action === "prepare") {
      const positions = await listPositions(body.owner);
      const position = positions.find((item) => item.id === body.positionId && item.status === "open");
      if (!position) throw new Error("Open position not found.");

      const compatibleRaydiumPosition =
        appConfig.tradeEngine !== "raydium-devnet" ||
        position.mintAddress === appConfig.raydiumDevnetOutputMint ||
        position.mintAddress === appConfig.raydiumDevnetInputMint;

      if (!compatibleRaydiumPosition) {
        throw new Error(`This position uses mint ${position.mintAddress}, which does not belong to the configured Raydium devnet pool. Use local close for sandbox/legacy positions.`);
      }

      const closeTrade = await prepareCloseTrade(body.owner, position.mintAddress, position.tokenAmountRaw);
      return NextResponse.json({ closeTrade, position });
    }

    const positions = await listPositions(body.owner);
    const openPosition = positions.find((item) => item.id === body.positionId);
    if (!openPosition) throw new Error("Position not found.");

    const finalSnapshot = await refreshPositionPnl(openPosition);
    const position = await closePosition(
      body.positionId,
      body.owner,
      appConfig.dryRun ? `dry-run-close-${crypto.randomUUID()}` : body.signature,
      {
        currentPrice: finalSnapshot.currentPrice,
        currentValueUsd: finalSnapshot.currentValueUsd,
        pnlUsd: finalSnapshot.pnlUsd,
        pnlPercent: finalSnapshot.pnlPercent
      }
    );
    return NextResponse.json({ position });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to close position." },
      { status: 400 }
    );
  }
}
