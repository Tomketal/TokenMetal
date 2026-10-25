import { NextResponse } from "next/server";
import { isCommissionEnabled } from "@/lib/commission";
import { appConfig, shouldUseSandboxTrading } from "@/lib/config";

export const runtime = "nodejs";

export async function GET() {
  const sandboxTrading = shouldUseSandboxTrading();

  return NextResponse.json({
    dryRun: appConfig.dryRun,
    sandboxTrading,
    liveTradingEnabled: !sandboxTrading,
    network: appConfig.stellarNetwork,
    engine: appConfig.tradeEngine,
    usdcAsset: appConfig.usdcAsset,
    commissionEnabled: isCommissionEnabled(),
    minLiveTradeUsdc: appConfig.minLiveTradeUsdc
  });
}
