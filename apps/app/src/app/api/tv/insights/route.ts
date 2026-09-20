import { NextResponse } from "next/server";
import { cachedTvInsights } from "./load";

export type { TvInsights } from "./load";

export const dynamic = "force-dynamic";

/**
 * Public like /api/tv: the screens run without a session. Returns only what
 * they already show, aggregated per team, harness and bucket of the
 * hackathon window. Per person, only the few names on the individual ranking.
 */
export async function GET() {
  try {
    return NextResponse.json(await cachedTvInsights(), {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=30" },
    });
  } catch {
    return NextResponse.json(
      { error: "TV insights temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
