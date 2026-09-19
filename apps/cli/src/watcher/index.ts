import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  rememberTelemetry,
  telemetryDedupKeys,
} from "../../../app/src/app/api/cli/telemetry/canonical";
import type { Session } from "../lib/api";
import { api, fetchImage } from "../lib/api";
import {
  ensureDir,
  readJsonFile,
  stateDir,
  writeFileAtomic,
} from "../lib/config";
import { CliError, EXIT } from "../lib/errors";
import { withImageUrls } from "../lib/feed-format";
import type { Me } from "../lib/me";
import { fetchMe } from "../lib/me";
import { PIXELS_PER_COLUMN, pngSize } from "../lib/term-images";
import { VERSION } from "../version";
import type { Batcher } from "./batcher";
import { BATCH_MAX, createBatcher } from "./batcher";
import { antigravityCollector } from "./collectors/antigravity";
import { claudeCodeCollector } from "./collectors/claude-code";
import { createClaudeOtelCollector } from "./collectors/claude-otel";
import { clineCollector } from "./collectors/cline";
import { codexCollector } from "./collectors/codex";
import { copilotCollector } from "./collectors/copilot";
import { cursorCollector } from "./collectors/cursor";
import { devinCollector } from "./collectors/devin";
import { geminiCliCollector } from "./collectors/gemini-cli";
import { kiloCodeCollector } from "./collectors/kilo-code";
import { openCodeCollector } from "./collectors/opencode";
import { ompCollector, piCollector } from "./collectors/pi";
import { qwenCodeCollector } from "./collectors/qwen-code";
import { openCursorStore } from "./cursor-store";
import type { MemoryStore } from "./memory";
import {
  openMemory,
  rememberNotification,
  replaySpool,
  shouldToast,
} from "./memory";
import type { Toaster } from "./notify";
import { platformToaster } from "./notify";
import type { RawEvent, TelemetryEvent } from "./schema";
import { canonicalize, SCHEMA, validateEvent } from "./schema";
import { httpSink } from "./sinks/http";
import type { Sink } from "./sinks/spool";
import { readSpool, spoolSink } from "./sinks/spool";
import type { WatchState } from "./state";
import {
  appendOlderFeed,
  FEED_PAGE,
  mergeNewerFeed,
  recordEvent,
  recordLog,
  recordNotification,
  WATCH_IMAGE_BOUNDS,
} from "./state";
import type { Collector, CollectorContext } from "./types";
import type { CollectionWindow } from "./window";
import { collectionWindow, inWindow, windowPhase } from "./window";

export const COLLECTORS: Collector[] = [
  claudeCodeCollector,
  codexCollector,
  cursorCollector,
  geminiCliCollector,
  qwenCodeCollector,
  openCodeCollector,
  kiloCodeCollector,
  clineCollector,
  copilotCollector,
  piCollector,
  ompCollector,
  antigravityCollector,
  devinCollector,
];

export type WatchOptions = {
  once: boolean;
  intervalMs: number;
  /** The hackathon as scheduled when the watcher started; null when there is none. */
  window: CollectionWindow | null;
  toast: boolean;
  /** Where batches are uploaded; undefined disables the upload sink. */
  uploadUrl?: string;
  verbose: boolean;
};

export type WatchDeps = {
  session: Session;
  me: Me;
  teamId?: string;
  log: (message: string) => void;
  say: (message: string) => void;
  /** Renders an organiser message; defaults to `say(formatNotification(...))`. */
  announce?: (subject: string, body: string, at: number) => void;
  /** Live-screen state; when given, runWatch keeps it current and honours pause/stop. */
  state?: WatchState;
  toaster?: Toaster;
  collectors?: Collector[];
  extraSinks?: Sink[];
  /** Cross-run memory (first start, last scan, announcements); defaults to the state dir. */
  memory?: MemoryStore;
  /** Usage events recorded by earlier runs, replayed onto the board; defaults to the spool. */
  history?: Iterable<TelemetryEvent>;
  /** Installs a pending CLI update; true asks the watcher to exit cleanly for restart. */
  checkForUpdate?: () => Promise<boolean>;
};

const RECENT_IDS_CAP = 5000;
/** Thumbnails fetched per loop iteration, so a burst of images never stalls a scan. */
const FEED_IMAGES_PER_TURN = 4;
const TEAM_REFRESH_MS = 5 * 60 * 1000;
/**
 * How often the watcher asks for the team's stack to be re-read from its
 * repo. Only asks: the server scans when the stack has gone stale, so a whole
 * team of watchers costs one scan, and it leaves a hand-typed stack alone.
 */
export const STACK_REFRESH_MS = 30 * 60 * 1000;
/** After this long without a usage event, scans slow down to save battery. */
export const IDLE_AFTER_MS = 10 * 60 * 1000;
export const IDLE_INTERVAL_MS = 60 * 1000;
const UPDATE_RECHECK_MS = 5 * 60 * 1000;

/**
 * Scan cadence: the configured interval while there is activity, at most
 * once a minute once the machine has been idle for a while. Organiser
 * messages are polled on the same tick, so one wakeup covers both.
 */
export function scanIntervalFor(
  baseMs: number,
  lastEventAt: number | undefined,
  now: number,
  startedAt: number
): number {
  const reference = lastEventAt ?? startedAt;
  if (now - reference >= IDLE_AFTER_MS) {
    return Math.max(baseMs, IDLE_INTERVAL_MS);
  }
  return baseMs;
}

/** Sleep for `ms`, or until something calls `state.wake()` (a key press). */
/** Whether this tick should ask for the team's stack to be re-read. */
export function stackRefreshDue(input: {
  inEvent: boolean;
  lastAskedAt: number;
  now: number;
  once?: boolean;
  teamId?: string;
}): boolean {
  return (
    input.inEvent &&
    Boolean(input.teamId) &&
    !input.once &&
    input.now - input.lastAskedAt > STACK_REFRESH_MS
  );
}

function sleepOrWake(state: WatchState | undefined, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (state) {
        state.wake = undefined;
      }
      resolve();
    }, ms);
    if (state) {
      state.wake = () => {
        clearTimeout(timer);
        state.wake = undefined;
        resolve();
      };
    }
  });
}

function lockPath(): string {
  return join(stateDir(), "watch.lock");
}

export function acquireWatchLock(): () => void {
  ensureDir(stateDir(), 0o700);
  const path = lockPath();
  if (existsSync(path)) {
    const pid = Number(readFileSync(path, "utf8").trim());
    let alive = false;
    try {
      process.kill(pid, 0);
      alive = true;
    } catch {
      alive = false;
    }
    if (alive && pid !== process.pid) {
      throw new CliError(`Another watcher is running (pid ${pid}).`, {
        code: "WATCHER_RUNNING",
        hint: `Stop it first, or delete ${path} if it is stale.`,
      });
    }
  }
  writeFileSync(path, `${process.pid}\n`, { mode: 0o600 });
  return () => {
    try {
      unlinkSync(path);
    } catch {
      // Already gone.
    }
  };
}

type RecentIds = { version: 1; ids: string[] };

function recentIdsPath(): string {
  return join(stateDir(), "recent-ids.json");
}

/**
 * Harnesses that rewrite files (OpenCode, Cline) can surface the same event
 * twice across runs; a small persisted ring of ids keeps the spool clean.
 */
export function loadRecentIds(): Set<string> {
  const stored = readJsonFile<RecentIds>(recentIdsPath());
  return new Set(stored?.version === 1 ? stored.ids : []);
}

export function saveRecentIds(ids: Set<string>): void {
  const list = [...ids].slice(-RECENT_IDS_CAP);
  writeFileAtomic(
    recentIdsPath(),
    `${JSON.stringify({ ids: list, version: 1 })}\n`,
    0o600
  );
}

export function stamp(
  raw: RawEvent,
  identity: TelemetryEvent["identity"],
  observedAt = new Date()
): TelemetryEvent {
  return {
    schema: SCHEMA,
    ...canonicalize(raw),
    observedAt: observedAt.toISOString(),
    identity,
  };
}

export type ScanResult = {
  events: number;
  skipped: number;
  byHarness: Record<string, number>;
  deferred?: boolean;
};

/** Retry setup/discovery each scan: tools may start or be repaired after us. */
export async function discoverCollectors(
  collectors: Collector[],
  window: CollectionWindow | null,
  log: (message: string) => void
): Promise<Collector[]> {
  const found: Collector[] = [];
  for (const collector of collectors) {
    try {
      collector.setWindow?.(window);
      await collector.prepare?.(log);
      if ((await collector.discover()).length > 0) {
        found.push(collector);
      }
    } catch (error) {
      log(
        `${collector.id}: setup/discovery failed; will retry: ${String(error)}`
      );
    }
  }
  return found;
}

export async function scanOnce(
  collectors: Collector[],
  ctx: CollectorContext,
  batcher: Batcher,
  identity: TelemetryEvent["identity"],
  recent: Set<string>
): Promise<ScanResult> {
  const result: ScanResult = { byHarness: {}, events: 0, skipped: 0 };
  for (const collector of collectors) {
    try {
      const roots = await collector.discover();
      if (roots.length === 0) {
        continue;
      }
      for await (const raw of collector.collect(ctx)) {
        const event = stamp(raw, identity);
        if (
          recent.has(raw.eventId) ||
          telemetryDedupKeys(event).some((key) => recent.has(key))
        ) {
          rememberTelemetry(recent, event);
          result.skipped++;
          continue;
        }
        // Collectors drop what is older than `since` themselves; the end of
        // the window is enforced here, on the harness's own timestamp.
        if (!inWindow(raw.occurredAt, ctx)) {
          result.skipped++;
          continue;
        }
        const problems = validateEvent(event);
        if (problems.length > 0) {
          ctx.log(
            `${collector.id}: dropped ${raw.eventId}: ${problems.join("; ")}`
          );
          result.skipped++;
          continue;
        }
        // Apply backpressure before a large catch-up can overflow the queues.
        // Returning closes the generator without committing its unread cursor.
        if (batcher.size() >= BATCH_MAX && !(await batcher.flush())) {
          ctx.log(
            "scan deferred until queued telemetry can be written; source cursors retained"
          );
          result.deferred = true;
          return result;
        }
        batcher.push(event);
        rememberTelemetry(recent, event);
        result.events++;
        result.byHarness[collector.id] =
          (result.byHarness[collector.id] ?? 0) + 1;
      }
    } catch (error) {
      ctx.log(`${collector.id}: collector failed: ${String(error)}`);
    }
  }
  return result;
}

export function formatNotification(
  subject: string,
  body: string,
  at: number
): string {
  const time = new Date(at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `[${time}] Organisers: ${subject}\n${body.replaceAll("\n", "\n  ")}`;
}

export async function runWatch(
  options: WatchOptions,
  deps: WatchDeps
): Promise<number> {
  const { session, me, say } = deps;
  const { state } = deps;
  const log = (message: string) => {
    deps.log(message);
    if (state) {
      recordLog(state, message);
    }
  };
  let { window } = options;
  const nativeClaude = createClaudeOtelCollector({
    userId: me._id,
    listen: !options.once,
    window: () => window,
    paused: () => Boolean(state?.paused),
  });
  const collectors =
    deps.collectors ??
    COLLECTORS.map((collector) =>
      collector.id === "claude-code" ? nativeClaude.collector : collector
    );
  const memory = deps.memory ?? openMemory();
  const cursors = openCursorStore();
  const recent = loadRecentIds();
  // A supplied history may be a one-shot generator; aliases and board replay
  // both need it. The production spool remains streamed from disk.
  const history = deps.history ? [...deps.history] : undefined;
  const recorded = new Set<string>();
  // A local spool write is not proof of delivery: a crash can happen before
  // the upload has even been staged. Only extend successfully saved recent
  // ids with aliases; retain all local identities separately for board replay.
  for (const event of history ?? readSpool()) {
    if (validateEvent(event).length === 0 && event.identity.userId === me._id) {
      rememberTelemetry(recorded, event);
      if (
        recent.has(event.eventId) ||
        telemetryDedupKeys(event).some((key) => recent.has(key))
      ) {
        rememberTelemetry(recent, event);
      }
    }
  }
  const sinks: Sink[] = [spoolSink(), ...(deps.extraSinks ?? [])];
  if (options.uploadUrl) {
    sinks.push(
      httpSink(options.uploadUrl, () => session.token(), fetch, {
        onRejected: log,
        pendingScope: me._id,
      })
    );
  }
  const batcher = createBatcher(sinks, log);
  const pendingRepoObservations = new Set<string>();
  const sentRepoObservations = new Set<string>();
  const recording: Batcher = {
    ...batcher,
    push: (event) => {
      if (state && !rememberTelemetry(recorded, event)) {
        recordEvent(state, event);
      }
      if (event.project?.repo) {
        pendingRepoObservations.add(event.project.repo);
      }
      batcher.push(event);
    },
  };
  let { teamId } = deps;
  let teamCheckedAt = Date.now();
  let stackCheckedAt = 0;
  const identity = (): TelemetryEvent["identity"] => ({
    userId: me._id,
    ...(teamId ? { teamId } : {}),
    clientVersion: VERSION,
  });
  const reportObservedRepos = async (): Promise<void> => {
    if (!(options.uploadUrl && teamId)) {
      return;
    }
    for (const repo of pendingRepoObservations) {
      const key = `${teamId}:${repo}`;
      if (sentRepoObservations.has(key)) {
        pendingRepoObservations.delete(repo);
        continue;
      }
      try {
        await session.client.mutation(api.teams.observeRepo, { repo });
        sentRepoObservations.add(key);
        pendingRepoObservations.delete(repo);
      } catch (error) {
        log(`repo observation failed: ${String(error)}`);
      }
    }
  };
  // Nobody records outside the hackathon window, and without a window
  // nothing is recorded at all; `ctx` is only ever scanned with one set.
  const ctx: CollectorContext = { cursors, log, since: 0 };
  const applyWindow = (next: CollectionWindow | null): void => {
    window = next;
    if (state) {
      state.window = next;
    }
    if (!next) {
      return;
    }
    ctx.since = next.since;
    ctx.until = next.until;
    // An earlier `since` than the cursors were built with (the first
    // windowed run, or organisers moving the start) means reading the logs
    // again. Committed recent ids avoid ordinary repeats; older deliveries
    // may be sent again and are permanently deduplicated by the server.
    if (cursors.coverFrom(next.since)) {
      log("reading harness logs again to cover the whole hackathon window");
    }
  };
  applyWindow(window);

  const discovered = (await discoverCollectors(collectors, window, log)).map(
    (collector) => collector.id
  );
  if (state) {
    state.harnesses = collectors.map((c) => ({
      cached: 0,
      found: discovered.includes(c.id),
      id: c.id,
      requests: 0,
      tokens: 0,
    }));
    // The board remembers: everything this machine reported since the first
    // run comes back from the local spool, and the last announcements too.
    state.trackedSince = memory.data.firstStartedAt;
    const replayed = replaySpool(state, history ?? readSpool());
    if (replayed > 0) {
      log(`replayed ${replayed} events from the local spool`);
    }
    for (const n of memory.data.notifications.toReversed()) {
      recordNotification(state, n.subject, n.body, n.at);
    }
  }
  say(
    discovered.length
      ? `Watching: ${discovered.join(", ")}. Sinks: ${sinks.map((s) => s.name).join(", ")}.`
      : "No supported AI harness found on this machine; only notifications will show."
  );
  if (!teamId) {
    say(
      "You are not in a team yet; events are recorded without a team until you join one."
    );
  }

  const toaster = deps.toaster ?? platformToaster();
  // Poll from the last announcement seen by any run, so messages sent while
  // the watcher was closed still show up (a first run fetches them all).
  let lastSeen = memory.data.lastNotificationAt ?? 0;
  const pollNotifications = async (): Promise<void> => {
    let rows: Awaited<
      ReturnType<typeof session.client.query<typeof api.notifications.forMe>>
    >;
    try {
      rows = await session.client.query(api.notifications.forMe, {
        since: lastSeen,
      });
    } catch (error) {
      log(`notifications: ${String(error)}`);
      return;
    }
    let remembered = false;
    for (const row of rows) {
      if (row.sentAt <= lastSeen) {
        continue;
      }
      lastSeen = row.sentAt;
      rememberNotification(memory.data, {
        at: row.sentAt,
        body: row.body,
        subject: row.subject,
      });
      remembered = true;
      if (state) {
        recordNotification(state, row.subject, row.body, row.sentAt);
      }
      (deps.announce ?? ((s, b, at) => say(formatNotification(s, b, at))))(
        row.subject,
        row.body,
        row.sentAt
      );
      // Catching up on old announcements stays on screen; only fresh ones toast.
      if (options.toast && shouldToast(row.sentAt)) {
        toaster(row.subject, row.body).then((ok) => {
          if (!ok) {
            log("toast failed; notifications still print here");
          }
        });
      }
    }
    if (remembered) {
      memory.save();
    }
  };

  /**
   * Thumbnails for loaded posts that do not have one yet, a few per call.
   * Only when the terminal can draw them; failures turn into links.
   */
  const loadFeedImages = async (): Promise<void> => {
    if (!state?.imageProtocol) {
      return;
    }
    const width = WATCH_IMAGE_BOUNDS.maxColumns * PIXELS_PER_COLUMN;
    let budget = FEED_IMAGES_PER_TURN;
    for (const post of state.feed) {
      if (budget === 0) {
        return;
      }
      if (
        !post.imagePath ||
        state.feedImages.has(post._id) ||
        state.feedImageFailed.has(post._id)
      ) {
        continue;
      }
      budget--;
      const png = await fetchImage(session, post.imagePath, width);
      const size = png ? pngSize(png) : null;
      if (png && size) {
        state.feedImages.set(post._id, { png, ...size });
      } else {
        state.feedImageFailed.add(post._id);
      }
    }
  };

  /** Latest feed page for the board; nothing to do in line mode. */
  const pollFeed = async (): Promise<void> => {
    if (!state) {
      return;
    }
    try {
      mergeNewerFeed(
        state,
        withImageUrls(
          await session.client.query(api.feed.list, { limit: FEED_PAGE }),
          session.url
        )
      );
    } catch (error) {
      log(`feed: ${String(error)}`);
      return;
    }
    await loadFeedImages();
  };

  /** The next older page, when scrolling asked for it. */
  const fetchOlderFeed = async (): Promise<void> => {
    if (!state?.feedNeedOlder) {
      return;
    }
    const oldest = state.feed.at(-1);
    if (!oldest) {
      state.feedNeedOlder = false;
      return;
    }
    try {
      appendOlderFeed(
        state,
        withImageUrls(
          await session.client.query(api.feed.list, {
            before: oldest.createdAt,
            limit: FEED_PAGE,
          }),
          session.url
        ),
        FEED_PAGE
      );
    } catch (error) {
      state.feedNeedOlder = false;
      log(`feed: ${String(error)}`);
      return;
    }
    await loadFeedImages();
  };

  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  // Team, announcements and the feed are hackathon-window functions on the
  // server: before and after it they only answer "closed", so they are not
  // asked. Organisers are never closed out, and neither is anybody while no
  // hackathon is scheduled.
  const inEvent = (): boolean => {
    const phase = windowPhase(window, Date.now());
    return me.role === "admin" || phase === "during" || phase === "unscheduled";
  };
  let wasInEvent = inEvent();
  let windowCheckedAt = Date.now();

  let tickComplete = false;
  const tick = async (): Promise<ScanResult> => {
    // Organisers may schedule or move the hackathon while this is open.
    if (Date.now() - windowCheckedAt > TEAM_REFRESH_MS) {
      windowCheckedAt = Date.now();
      try {
        const latest = await fetchMe(session);
        if (latest) {
          const next = collectionWindow(latest);
          if (next?.since !== window?.since || next?.until !== window?.until) {
            applyWindow(next);
          }
        }
      } catch (error) {
        log(`hackathon window lookup failed: ${String(error)}`);
      }
    }
    // The doors just opened with the watcher already running: pick the team
    // up now rather than at the next refresh.
    const opened = inEvent() && !wasInEvent;
    wasInEvent = inEvent();
    if (inEvent() && (opened || Date.now() - teamCheckedAt > TEAM_REFRESH_MS)) {
      teamCheckedAt = Date.now();
      try {
        teamId = (await session.client.query(api.teams.mine, {}))?._id;
      } catch (error) {
        log(`team lookup failed: ${String(error)}`);
      }
    }
    // The team keeps building after linking the repo; this keeps what the
    // dashboards say they build with current. Not awaited: a scan reads
    // GitHub for a few seconds and telemetry does not wait for it.
    if (
      stackRefreshDue({
        inEvent: inEvent(),
        lastAskedAt: stackCheckedAt,
        now: Date.now(),
        once: options.once,
        teamId,
      })
    ) {
      stackCheckedAt = Date.now();
      session.client
        .action(api.stackDetect.mine, {})
        .then((result) => {
          if (result.scanned) {
            log(`stack re-read from the repo: ${result.techStack.join(", ")}`);
          }
        })
        .catch((error: unknown) =>
          log(`stack refresh failed: ${String(error)}`)
        );
    }
    if (state) {
      state.scanning = true;
    }
    const available = await discoverCollectors(collectors, window, log);
    if (state) {
      const found = new Set(available.map((collector) => collector.id));
      for (const harness of state.harnesses) {
        harness.found = found.has(harness.id);
      }
    }
    // Without a scheduled hackathon there is no window to read for.
    const scanned: ScanResult = window
      ? await scanOnce(available, ctx, recording, identity(), recent)
      : { byHarness: {}, events: 0, skipped: 0 };
    await reportObservedRepos();
    const ok = await batcher.flush();
    tickComplete = ok && !scanned.deferred;
    if (ok) {
      try {
        nativeClaude.checkpoint(cursors);
      } catch {
        log("claude-code: OTLP queue cleanup deferred; events remain on disk");
      }
      cursors.save();
      saveRecentIds(recent);
    }
    // The next run catches up from here.
    memory.data.lastActiveAt = Date.now();
    memory.save();
    if (state) {
      state.scanning = false;
      state.lastScanAt = Date.now();
      state.upload.failing = !ok;
      state.upload.queued = batcher.size();
      if (ok && state.upload.enabled) {
        state.upload.lastOkAt = Date.now();
      }
    }
    if (scanned.events > 0 || options.verbose) {
      const parts = Object.entries(scanned.byHarness).map(
        ([h, n]) => `${h} ${n}`
      );
      say(
        `${scanned.events} event${scanned.events === 1 ? "" : "s"}${parts.length ? ` (${parts.join(", ")})` : ""}${ok ? "" : ", some queued"}`
      );
    }
    return scanned;
  };

  try {
    await tick();
    if (options.once) {
      return tickComplete ? EXIT.OK : EXIT.NETWORK;
    }
    const startedAt = Date.now();
    let lastEventAt: number | undefined = state?.lastEventAt;
    const interval = () =>
      scanIntervalFor(
        options.intervalMs,
        state?.lastEventAt ?? lastEventAt,
        Date.now(),
        startedAt
      );
    if (inEvent()) {
      await pollNotifications();
      await pollFeed();
    }
    let nextScan = Date.now() + interval();
    let nextUpdateCheck = Date.now() + UPDATE_RECHECK_MS;
    if (state) {
      state.nextScanAt = nextScan;
    }
    while (!(stopping || state?.stopRequested)) {
      const now = Date.now();
      if (now >= nextUpdateCheck) {
        nextUpdateCheck = now + UPDATE_RECHECK_MS;
        if (await deps.checkForUpdate?.()) {
          return EXIT.OK;
        }
      }
      if (now >= nextScan) {
        if (state?.paused) {
          nextScan = Date.now() + 1000;
        } else {
          // One wakeup does both the scan and the organiser-message poll.
          const scanned = await tick();
          if (scanned.events > 0) {
            lastEventAt = Date.now();
          }
          if (inEvent()) {
            await pollNotifications();
            await pollFeed();
          }
          nextScan = Date.now() + interval();
        }
        if (state) {
          state.nextScanAt = nextScan;
        }
      }
      // One wakeup per second at most; a key press wakes it immediately.
      await sleepOrWake(state, state?.paused ? 5000 : 1000);
      // Scrolling past the loaded posts asks for an older page; pictures
      // for anything loaded trickle in a few per turn.
      if (inEvent()) {
        await fetchOlderFeed();
        await loadFeedImages();
      }
    }
    say("Stopping, flushing…");
    if (await batcher.flush()) {
      cursors.save();
      saveRecentIds(recent);
    } else {
      log(
        "Pending telemetry remains; the next run will retry from the last saved cursors."
      );
    }
    return EXIT.INTERRUPTED;
  } finally {
    await nativeClaude.stop();
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}
