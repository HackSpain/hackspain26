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
  scanning: boolean;
  lastScanAt?: number;
  nextScanAt?: number;
  paused: boolean;
  stopRequested: boolean;
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

export const NOTIFICATIONS_KEPT = 20;
const LOG_KEPT = 6;

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
  state.totals.input += event.tokens.input;
  state.totals.output += event.tokens.output;
  state.totals.cached += event.tokens.cacheRead + event.tokens.cacheWrite;
  if (harness) {
    harness.requests++;
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
