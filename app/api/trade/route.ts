import { NextResponse } from "next/server";
import { appConfig, shouldUseSandboxTrading } from "@/lib/config";
import { toRawAmount } from "@/lib/number";
import { createPosition } from "@/lib/positions/store";
import { prepareBuyTrade, readSwapResult } from "@/lib/trading/sdex";
import { STELLAR_DECIMALS } from "@/lib/stellar/network";
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

    let preparedTrade = body.preparedTrade as PreparedTrade;
    if (preparedTrade.owner !== body.owner) {
      return NextResponse.json({ error: "Prepared trade belongs to a different wallet." }, { status: 400 });
    }

    if (sandboxTrading) {
      const position = await createPosition(preparedTrade, `dry-run-${crypto.randomUUID()}`);
      return NextResponse.json({ position });
    }

    // Record what the chain says the swap delivered, not the pre-trade quote.
    const result = await readSwapResult(body.signature, body.owner);
    preparedTrade = {
      ...preparedTrade,
      expectedTokenAmountUi: result.destAmount,
      expectedTokenAmountRaw: toRawAmount(result.destAmount, STELLAR_DECIMALS)
    };

    const position = await createPosition(preparedTrade, body.signature);
    return NextResponse.json({ position });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process trade." },
      { status: 400 }
    );
  }
}
