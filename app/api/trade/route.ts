import { NextResponse } from "next/server";
import { appConfig, shouldUseSandboxTrading } from "@/lib/config";
import { createPosition } from "@/lib/positions/store";
import { prepareBuyTrade } from "@/lib/trading/jupiter";
import type { PreparedTrade } from "@/lib/types";
import { tradeRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = tradeRequestSchema.parse(await request.json());
    const sandboxTrading = shouldUseSandboxTrading();

    if (body.action === "prepare") {
      if (!sandboxTrading && body.amountUsdc < appConfig.minLiveTradeUsdc) {
        return NextResponse.json(
          {
            error: `Live trades must be at least ${appConfig.minLiveTradeUsdc} USDC. Increase your allocation or deposit more USDC before trading.`
          },
          { status: 400 }
        );
      }

      const preparedTrade = await prepareBuyTrade(body.owner, body.amountUsdc, body.recommendation);
      return NextResponse.json({ preparedTrade });
    }

    const preparedTrade = body.preparedTrade as PreparedTrade;
    if (!sandboxTrading && preparedTrade.amountUsdc < appConfig.minLiveTradeUsdc) {
      return NextResponse.json(
        {
          error: `This prepared trade is below the ${appConfig.minLiveTradeUsdc} USDC live minimum. Recreate it with a larger allocation.`
        },
        { status: 400 }
      );
    }

    const position = await createPosition(preparedTrade, sandboxTrading ? `dry-run-${crypto.randomUUID()}` : body.signature);
    return NextResponse.json({ position });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process trade." },
      { status: 400 }
    );
  }
}
