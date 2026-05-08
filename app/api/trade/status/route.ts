import { NextResponse } from "next/server";
import { appConfig, hasWriteEnabledRpcForLiveTrading, shouldUseSandboxTrading } from "@/lib/config";

export const runtime = "nodejs";

export async function GET() {
  const writeEnabledRpc = hasWriteEnabledRpcForLiveTrading();
  const sandboxTrading = shouldUseSandboxTrading();

  return NextResponse.json({
    dryRun: appConfig.dryRun,
    sandboxTrading,
    liveTradingEnabled: !sandboxTrading,
    sandboxSigning: process.env.NEXT_PUBLIC_SANDBOX_SIGNING === "true",
    writeEnabledRpc
  });
}
