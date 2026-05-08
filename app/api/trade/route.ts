import { NextResponse } from "next/server";
import { shouldUseSandboxTrading } from "@/lib/config";
import { createPosition } from "@/lib/positions/store";
import { prepareBuyTrade } from "@/lib/trading/jupiter";
import type { PreparedTrade } from "@/lib/types";
import { tradeRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = tradeRequestSchema.parse(await request.json());

    if (body.action === "prepare") {
      const preparedTrade = await prepareBuyTrade(body.owner, body.amountUsdc, body.recommendation);
      return NextResponse.json({ preparedTrade });
    }

    const position = await createPosition(body.preparedTrade as PreparedTrade, shouldUseSandboxTrading() ? `dry-run-${crypto.randomUUID()}` : body.signature);
    return NextResponse.json({ position });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process trade." },
      { status: 400 }
    );
  }
}
