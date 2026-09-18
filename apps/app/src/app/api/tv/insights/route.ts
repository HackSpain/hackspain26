import { api } from "@convex/_generated/api";
import { INSIGHT_BUCKETS } from "@convex/tvPlayback";
import { RawTreeError } from "@rawtree/sdk";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { reportServerEvent } from "@/lib/server-observability";
import { fetchUsage } from "./usage";
import type { ModelRow, UsageRow } from "./usage";

export const dynamic = "force-dynamic";

export type TvInsights = {
  /** Where the AI usage came from; the boxes show "Sin datos" on anything but "ok". */
  usage: "ok" | "empty" | "unconfigured" | "unavailable" | "unscheduled";
  window: { startsAt?: number; endsAt?: number };
  buckets: number;
  teams: { id: string; name: string; project: string; members: number }[];
  samples: UsageRow[];
  /** Tokens per normalised model name over the window; empty unless `usage` is "ok". */
  models: ModelRow[];
  activity: {
    teamId: string;
    bucket: number;
    pushes: number;
    pullRequests: number;
  }[];
  /** Technologies per project, read from the repos (or typed by the team). */
  stacks: {
    auto: number;
    rows: { category: string; count: number; name: string }[];
    total: number;
  };
  generatedAt: number;
};

// Every screen polls this; one RawTree aggregate per interval serves them all.
const CACHE_MS = 30_000;
let cached: { at: number; value: TvInsights } | null = null;
let inFlight: Promise<TvInsights> | null = null;

async function load(): Promise<TvInsights> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("Convex is not configured");
  }
  const base = await new ConvexHttpClient(url).query(
    api.tvPlayback.insightsBase,
    {}
  );
  const { startsAt, endsAt } = base.window;
  const shared = {
    activity: base.activity,
    buckets: INSIGHT_BUCKETS,
    generatedAt: Date.now(),
    stacks: base.stacks,
    teams: base.teams,
    window: base.window,
  };
  if (startsAt === undefined || endsAt === undefined || endsAt <= startsAt) {
    return { ...shared, models: [], samples: [], usage: "unscheduled" };
  }
  try {
    const usage = await fetchUsage({
      buckets: INSIGHT_BUCKETS,
      endsAt,
      startsAt,
    });
    return { ...shared, models: usage.models, samples: usage.rows, usage: usage.status };
  } catch (error) {
    await reportServerEvent("error", "RawTree TV insights query failed", {
      kind: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "unknown",
      ...(error instanceof RawTreeError
        ? { code: error.error, hint: error.hint, status: error.status }
        : {}),
    });
    // The rest of the TV keeps working; usage boxes fall back to "Sin datos".
    return { ...shared, models: [], samples: [], usage: "unavailable" };
  }
}

/**
 * Public like /api/tv: the screens run without a session. Returns only what
 * they already show, aggregated per team, harness and bucket of the
 * hackathon window. Nothing per person.
 */
export async function GET() {
  try {
    const now = Date.now();
    if (!cached || now - cached.at > CACHE_MS) {
      inFlight ??= load().finally(() => {
        inFlight = null;
      });
      cached = { at: now, value: await inFlight };
    }
    return NextResponse.json(cached.value, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=30" },
    });
  } catch {
    return NextResponse.json(
      { error: "TV insights temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
