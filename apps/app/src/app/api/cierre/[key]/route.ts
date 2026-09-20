import { api } from "@convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { cachedTvInsights } from "@/app/api/tv/insights/load";
import { CLOSING_KEY } from "@/lib/closing";
import type { ClosingData } from "@/lib/closing";

export const dynamic = "force-dynamic";

/** Fresh numbers for the closing slides: the TV insights plus event totals. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  if ((await params).key !== CLOSING_KEY) {
    return new Response(null, { status: 404 });
  }
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    return NextResponse.json({ error: "Convex is not configured" }, { status: 503 });
  }
  try {
    const [insights, totals] = await Promise.all([
      cachedTvInsights(),
      new ConvexHttpClient(url).query(api.closing.stats, {}),
    ]);
    const data: ClosingData = { generatedAt: Date.now(), insights, totals };
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Closing data temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
