import type { FeedItem } from "../lib/feed-format";
import type { HarnessId, TelemetryEvent } from "./schema";

/** Everything the live screen shows. runWatch mutates it; the screen only reads. */
export type WatchState = {
  startedAt: number;
  me: { name: string; email?: string };
  team?: { name: string; isOwner: boolean; repoUrl?: string; members: number };
  project?: {
    name: string;
    status: "draft" | "submitted";
    tracks: string[];
    updatedAt: number;
  };
  harnesses: {
    id: HarnessId;
    found: boolean;
    requests: number;
    tokens: number;
    lastEventAt?: number;
  }[];
  /** Newest first, capped; what the "Recent requests" table shows. */
  recent: RecentRequest[];
  totals: {
    requests: number;
    sessions: Set<string>;
    input: number;
    output: number;
    cached: number;
  };
  /** Per-minute activity, keyed by bucket start (epoch ms), for the graphs. */
  series: Map<number, SeriesPoint>;
  scanning: boolean;
  lastScanAt?: number;
  nextScanAt?: number;
  paused: boolean;
  stopRequested: boolean;
  /** Set by the loop while it sleeps; the screen calls it on q/p so the loop reacts at once. */
  wake?: () => void;
  /** Newest usage event seen, for the idle backoff. */
  lastEventAt?: number;
  upload: {
    enabled: boolean;
    lastOkAt?: number;
    failing: boolean;
    queued: number;
  };
  notifications: { subject: string; body: string; at: number }[];
  /** Latest feed posts, newest first, refreshed on every scan tick. */
  feed: FeedItem[];
  /** Last few diagnostics, newest last. */
  log: string[];
};

export type RecentRequest = {
  at: number;
  harness: HarnessId;
  model: string;
  input: number;
  output: number;
  cached: number;
  sessionId: string;
};

export const RECENT_KEPT = 60;

export type SeriesPoint = {
  requests: number;
  tokens: number;
  byHarness: Partial<Record<HarnessId, number>>;
};

export const NOTIFICATIONS_KEPT = 20;
export const BUCKET_MS = 60 * 1000;
const SERIES_KEPT = 240;
const LOG_KEPT = 6;

function bucketOf(at: number): number {
  return Math.floor(at / BUCKET_MS) * BUCKET_MS;
}

/** Last `count` minute buckets ending now, oldest first, zero-filled. */
export function seriesWindow(
  state: WatchState,
  count: number,
  now = Date.now()
): SeriesPoint[] {
  const end = bucketOf(now);
  const out: SeriesPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(
      state.series.get(end - i * BUCKET_MS) ?? {
        requests: 0,
        tokens: 0,
        byHarness: {},
      }
    );
  }
  return out;
}

export function createState(
  init: Pick<WatchState, "me" | "team" | "project"> & {
    uploadEnabled: boolean;
  }
): WatchState {
  return {
    startedAt: Date.now(),
    me: init.me,
    team: init.team,
    project: init.project,
    harnesses: [],
    recent: [],
    totals: {
      requests: 0,
      sessions: new Set(),
      input: 0,
      output: 0,
      cached: 0,
    },
    series: new Map(),
    scanning: false,
    paused: false,
    stopRequested: false,
    upload: { enabled: init.uploadEnabled, failing: false, queued: 0 },
    notifications: [],
    feed: [],
    log: [],
  };
}

export function recordEvent(state: WatchState, event: TelemetryEvent): void {
  const harness = state.harnesses.find((h) => h.id === event.harness);
  const at = Date.parse(event.occurredAt);
  if (harness) {
    harness.lastEventAt = Math.max(harness.lastEventAt ?? 0, at);
  }
  state.totals.sessions.add(`${event.harness}:${event.sessionId}`);
  if (event.type !== "usage" || !event.tokens) {
    return;
  }
  state.totals.requests++;
  state.lastEventAt = Math.max(state.lastEventAt ?? 0, at);
  state.totals.input += event.tokens.input;
  state.totals.output += event.tokens.output;
  state.totals.cached += event.tokens.cacheRead + event.tokens.cacheWrite;
  const cached = event.tokens.cacheRead + event.tokens.cacheWrite;
  if (harness) {
    harness.requests++;
    harness.tokens += event.tokens.input + event.tokens.output + cached;
  }
  // Backfill reads newest files first, so events do not arrive in time
  // order; keep the list sorted newest first regardless.
  const entry: RecentRequest = {
    at,
    harness: event.harness,
    model: event.model?.raw ?? "unknown",
    input: event.tokens.input,
    output: event.tokens.output,
    cached,
    sessionId: event.sessionId,
  };
  const index = state.recent.findIndex((r) => r.at <= at);
  state.recent.splice(index === -1 ? state.recent.length : index, 0, entry);
  state.recent.splice(RECENT_KEPT);
  const bucket = bucketOf(at);
  const point = state.series.get(bucket) ?? {
    requests: 0,
    tokens: 0,
    byHarness: {},
  };
  point.requests++;
  point.tokens += event.tokens.input + event.tokens.output;
  point.byHarness[event.harness] = (point.byHarness[event.harness] ?? 0) + 1;
  state.series.set(bucket, point);
  if (state.series.size > SERIES_KEPT) {
    const oldest = Math.min(...state.series.keys());
    state.series.delete(oldest);
  }
}

export function recordNotification(
  state: WatchState,
  subject: string,
  body: string,
  at: number
): void {
  state.notifications.unshift({ subject, body, at });
  state.notifications.splice(NOTIFICATIONS_KEPT);
}

export function recordLog(state: WatchState, message: string): void {
  state.log.push(message);
  if (state.log.length > LOG_KEPT) {
    state.log.splice(0, state.log.length - LOG_KEPT);
  }
}
