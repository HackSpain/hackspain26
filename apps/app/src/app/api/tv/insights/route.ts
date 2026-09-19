import { api } from "@convex/_generated/api";
import { INSIGHT_BUCKETS, INSIGHT_PEOPLE } from "@convex/tvPlayback";
import { RawTreeError } from "@rawtree/sdk";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { reportServerEvent } from "@/lib/server-observability";
import { mergePeople, pickPeople } from "./people";
import type { PersonRow } from "./people";
import { fetchUsage } from "./usage";
import type { ModelRow, PersonUsageRow, UsageResult, UsageRow } from "./usage";

export const dynamic = "force-dynamic";

export type TvInsights = {
  /** Where the AI usage came from; the boxes show "Sin datos" on anything but "ok". */
  usage: "ok" | "empty" | "unconfigured" | "unavailable" | "unscheduled";
  window: { startsAt?: number; endsAt?: number };
  buckets: number;
  teams: { id: string; name: string; project: string; members: number; logoUrl?: string }[];
  samples: UsageRow[];
  /** Tokens per normalised model name over the window; empty unless `usage` is "ok". */
  models: ModelRow[];
  activity: {
    teamId: string;
    bucket: number;
    pushes: number;
    pullRequests: number;
  }[];
  /**
   * The individual ranking: the top few people by tokens and by GitHub
   * activity, by display name. Nobody else's numbers leave the server.
   */
  people: PersonRow[];
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
  const convex = new ConvexHttpClient(url);
  const base = await convex.query(api.tvPlayback.insightsBase, {});
  const people = async (usage: PersonUsageRow[]): Promise<PersonRow[]> => {
    const picked = pickPeople(usage, base.actors, INSIGHT_PEOPLE);
    if (picked.userIds.length + picked.logins.length === 0) {
      return [];
    }
    const resolved = await convex.query(api.tvPlayback.insightsPeople, picked);
    return mergePeople(usage, base.actors, resolved, picked, base.teams);
  };
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
    return { ...shared, models: [], people: [], samples: [], usage: "unscheduled" };
  }
  let usage: UsageResult | null = null;
  try {
    usage = await fetchUsage({
      buckets: INSIGHT_BUCKETS,
      endsAt,
      startsAt,
    });
  } catch (error) {
    await reportServerEvent("error", "RawTree TV insights query failed", {
      kind: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "unknown",
      ...(error instanceof RawTreeError
        ? { code: error.error, hint: error.hint, status: error.status }
        : {}),
    });
  }
  // Without RawTree the rest of the TV keeps working: usage boxes fall back to
  // "Sin datos" and the individual ranking keeps its GitHub half, from Convex.
  return {
    ...shared,
    models: usage?.models ?? [],
    people: await people(usage?.people ?? []),
    samples: usage?.rows ?? [],
    usage: usage?.status ?? "unavailable",
  };
}

/**
 * Public like /api/tv: the screens run without a session. Returns only what
 * they already show, aggregated per team, harness and bucket of the
 * hackathon window. Per person, only the few names on the individual ranking.
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
