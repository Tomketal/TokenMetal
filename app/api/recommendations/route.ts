import { NextResponse } from "next/server";
import { suggestedAllocation } from "@/lib/recommendations/scoring";
import { getStellarRecommendations } from "@/lib/recommendations/stellar";
import { recommendationRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = recommendationRequestSchema.parse(await request.json());
    const recommendations = await getStellarRecommendations(body);
    return NextResponse.json({
      recommendations,
      suggestedAllocationPercentage: suggestedAllocation[body.riskProfile]
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch recommendations." },
      { status: 400 }
    );
  }
}
