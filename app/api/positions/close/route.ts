import { NextResponse } from "next/server";
import { shouldUseSandboxTrading } from "@/lib/config";
import { refreshPositionPnl, withValue } from "@/lib/positions/pnl";
import { listPositions, closePosition } from "@/lib/positions/store";
import { prepareCloseTrade, readSwapResult } from "@/lib/trading/sdex";
import { closeRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = closeRequestSchema.parse(await request.json());
    const positions = await listPositions(body.owner);

    if (body.action === "prepare") {
      const position = positions.find((item) => item.id === body.positionId && item.status === "open");
      if (!position) throw new Error("Open position not found.");

      const closeTrade = await prepareCloseTrade(body.owner, position.mintAddress, position.tokenAmountRaw);
      return NextResponse.json({ closeTrade, position });
    }

    const openPosition = positions.find((item) => item.id === body.positionId);
    if (!openPosition) throw new Error("Position not found.");

    let finalSnapshot;
    let signature = body.signature;
    if (shouldUseSandboxTrading()) {
      finalSnapshot = await refreshPositionPnl(openPosition);
      signature = `dry-run-close-${crypto.randomUUID()}`;
    } else {
      // Exit value is the USDC the close swap actually delivered.
      const result = await readSwapResult(body.signature, body.owner);
      finalSnapshot = withValue(openPosition, result.destAmount);
    }

    const position = await closePosition(body.positionId, body.owner, signature, {
      currentPrice: finalSnapshot.currentPrice,
      currentValueUsd: finalSnapshot.currentValueUsd,
      pnlUsd: finalSnapshot.pnlUsd,
      pnlPercent: finalSnapshot.pnlPercent
    });
    return NextResponse.json({ position });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to close position." },
      { status: 400 }
    );
  }
}
