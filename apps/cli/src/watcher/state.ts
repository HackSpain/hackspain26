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
    lastEventAt?: number;
  }[];
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
  /** Last few diagnostics, newest last. */
  log: string[];
};

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
  if (harness) {
    harness.requests++;
  }
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
