import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@convex/_generated/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("Convex is not configured");
    }
    const client = new ConvexHttpClient(url);
    return NextResponse.json(await client.query(api.tvPlayback.snapshot, {}), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "TV temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
