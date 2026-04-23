import { NextResponse } from "next/server";
import { getNansenRecommendations } from "@/lib/recommendations/nansen";
import { recommendationRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = recommendationRequestSchema.parse(await request.json());
    const recommendations = await getNansenRecommendations(body);
    return NextResponse.json({ recommendations });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch recommendations." },
      { status: 400 }
    );
  }
}
