import { NextResponse } from "next/server";
import { refreshPositionPnl } from "@/lib/positions/pnl";
import { listPositions } from "@/lib/positions/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner") || undefined;
  const positions = await listPositions(owner);
  const refreshed = await Promise.all(
    positions.map((position) => (position.status === "open" ? refreshPositionPnl(position) : position))
  );

  return NextResponse.json({
    open: refreshed.filter((position) => position.status === "open"),
    closed: refreshed.filter((position) => position.status === "closed")
  });
}
