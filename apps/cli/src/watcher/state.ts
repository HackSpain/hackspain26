import type { FeedItem } from "../lib/feed-format";
import type { ImageBounds, ImageProtocol } from "../lib/term-images";
import type { HarnessId, TelemetryEvent } from "./schema";
import type { CollectionWindow } from "./window";

/** Everything the live screen shows. runWatch mutates it; the screen only reads. */
export type WatchState = {
  /** This run's start; `elapsed` in the header. */
  startedAt: number;
  /** First run on this machine; the totals cover everything since then. */
  trackedSince?: number;
  /** The hackathon window (null: none scheduled); the screen warns while outside it. */
  window?: CollectionWindow | null;
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
    /** Fresh tokens: input + output. Cache traffic is counted apart. */
    tokens: number;
    /** Prompt-cache reads and writes; large on long sessions, not "burned". */
    cached: number;
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
  /** Loaded feed posts, newest first: the latest page plus older pages fetched on demand. */
  feed: FeedItem[];
  /** Index into `feed` of the first post on screen; 0 is live. */
  feedOffset: number;
  /** The server has no posts older than `feed.at(-1)`. */
  feedExhausted: boolean;
  /** Set by scrolling near the end; the loop fetches the next older page. */
  feedNeedOlder: boolean;
  /** Which inline-image protocol the terminal speaks; null prints links. */
  imageProtocol: ImageProtocol | null;
  /** PNG thumbnails by post id, ready for the screen. */
  feedImages: Map<string, FeedImage>;
  /** Posts whose thumbnail could not be fetched; shown as links, not retried. */
  feedImageFailed: Set<string>;
  /** Last few diagnostics, newest last. */
  log: string[];
};

export type FeedImage = { png: Uint8Array; width: number; height: number };

/** Posts per page, both for the live refresh and for older pages. */
export const FEED_PAGE = 15;
/** Fetch the next older page when this few posts remain below the view. */
export const FEED_PREFETCH = 5;
const FEED_KEPT = 200;
/** Pictures in the watcher band are small: it shares the screen with everything else. */
export const WATCH_IMAGE_BOUNDS: Required<ImageBounds> = {
  maxColumns: 30,
  maxRows: 6,
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

export const NOTIFICATIONS_KEPT = 20;
const LOG_KEPT = 6;

export function createState(
  init: Pick<
    WatchState,
    "me" | "team" | "project" | "trackedSince" | "window"
  > & {
    uploadEnabled: boolean;
    imageProtocol?: ImageProtocol | null;
  }
): WatchState {
  return {
    trackedSince: init.trackedSince,
    window: init.window,
    feed: [],
    feedExhausted: false,
    feedImageFailed: new Set(),
    feedImages: new Map(),
    feedNeedOlder: false,
    feedOffset: 0,
    harnesses: [],
    imageProtocol: init.imageProtocol ?? null,
    log: [],
    me: init.me,
    notifications: [],
    paused: false,
    project: init.project,
    recent: [],
    scanning: false,
    startedAt: Date.now(),
    stopRequested: false,
    team: init.team,
    totals: {
      cached: 0,
      input: 0,
      output: 0,
      requests: 0,
      sessions: new Set(),
    },
    upload: { enabled: init.uploadEnabled, failing: false, queued: 0 },
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
    harness.tokens += event.tokens.input + event.tokens.output;
    harness.cached += cached;
  }
  // Backfill reads newest files first, so events do not arrive in time
  // order; keep the list sorted newest first regardless.
  const entry: RecentRequest = {
    at,
    cached,
    harness: event.harness,
    input: event.tokens.input,
    model: event.model?.name ?? "unknown",
    output: event.tokens.output,
    sessionId: event.sessionId,
  };
  const index = state.recent.findIndex((r) => r.at <= at);
  state.recent.splice(index === -1 ? state.recent.length : index, 0, entry);
  state.recent.splice(RECENT_KEPT);
}

export function recordNotification(
  state: WatchState,
  subject: string,
  body: string,
  at: number
): void {
  state.notifications.unshift({ at, body, subject });
  state.notifications.splice(NOTIFICATIONS_KEPT);
}

function clampOffset(state: WatchState): void {
  state.feedOffset = Math.max(
    0,
    Math.min(state.feedOffset, Math.max(0, state.feed.length - 1))
  );
}

function trimFeed(state: WatchState): void {
  if (state.feed.length > FEED_KEPT) {
    state.feed.splice(FEED_KEPT);
    state.feedExhausted = false;
  }
  const alive = new Set(state.feed.map((post) => post._id));
  for (const key of state.feedImages.keys()) {
    if (!alive.has(key)) {
      state.feedImages.delete(key);
    }
  }
  clampOffset(state);
}

/**
 * Fold the latest page (newest first) into the loaded feed. New posts go on
 * top; posts that vanished from the window the page covers were deleted.
 * While the reader is scrolled down, the view stays put: the offset grows by
 * the number of posts inserted above it.
 */
export function mergeNewerFeed(state: WatchState, page: FeedItem[]): void {
  if (page.length === 0) {
    return;
  }
  const fetched = new Set(page.map((post) => post._id));
  const windowOldest = page.at(-1)?.createdAt ?? Number.POSITIVE_INFINITY;
  const kept = state.feed.filter(
    (post) => post.createdAt < windowOldest || fetched.has(post._id)
  );
  const known = new Set(kept.map((post) => post._id));
  const fresh = page.filter((post) => !known.has(post._id));
  state.feed = [...fresh, ...kept];
  if (state.feedOffset > 0) {
    state.feedOffset += fresh.length;
  }
  trimFeed(state);
}

/** Append an older page; fewer than `pageSize` rows means the end was reached. */
export function appendOlderFeed(
  state: WatchState,
  page: FeedItem[],
  pageSize = FEED_PAGE
): void {
  const known = new Set(state.feed.map((post) => post._id));
  state.feed.push(...page.filter((post) => !known.has(post._id)));
  state.feedExhausted = page.length < pageSize;
  state.feedNeedOlder = false;
  trimFeed(state);
}

/** Move the feed view by `delta` posts; asks for an older page when near the end. */
export function scrollFeed(state: WatchState, delta: number): boolean {
  const before = state.feedOffset;
  state.feedOffset += delta;
  clampOffset(state);
  if (
    !state.feedExhausted &&
    state.feed.length - state.feedOffset <= FEED_PREFETCH
  ) {
    state.feedNeedOlder = true;
  }
  return state.feedOffset !== before;
}

/** Back to the newest posts. */
export function feedLive(state: WatchState): void {
  state.feedOffset = 0;
}

export function recordLog(state: WatchState, message: string): void {
  state.log.push(message);
  if (state.log.length > LOG_KEPT) {
    state.log.splice(0, state.log.length - LOG_KEPT);
  }
}
