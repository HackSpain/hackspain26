import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { api, type Session } from "../lib/api";
import {
  ensureDir,
  readJsonFile,
  stateDir,
  writeFileAtomic,
} from "../lib/config";
import { CliError, EXIT } from "../lib/errors";
import type { Me } from "../lib/me";
import { VERSION } from "../version";
import { type Batcher, createBatcher } from "./batcher";
import { claudeCodeCollector } from "./collectors/claude-code";
import { clineCollector } from "./collectors/cline";
import { codexCollector } from "./collectors/codex";
import { openCodeCollector } from "./collectors/opencode";
import { openCursorStore } from "./cursor-store";
import { platformToaster, type Toaster } from "./notify";
import {
  type RawEvent,
  SCHEMA,
  type TelemetryEvent,
  validateEvent,
} from "./schema";
import { httpSink } from "./sinks/http";
import { type Sink, spoolSink } from "./sinks/spool";
import {
  recordEvent,
  recordLog,
  recordNotification,
  type WatchState,
} from "./state";
import type { Collector, CollectorContext } from "./types";

export const COLLECTORS: Collector[] = [
  claudeCodeCollector,
  codexCollector,
  openCodeCollector,
  clineCollector,
];

export type WatchOptions = {
  once: boolean;
  intervalMs: number;
  since: number;
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
};

const RECENT_IDS_CAP = 5000;
const TEAM_REFRESH_MS = 5 * 60 * 1000;
/** Organiser messages are polled through the same server API as everything else. */
export const NOTIFY_POLL_MS = 10 * 1000;

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
    `${JSON.stringify({ version: 1, ids: list })}\n`,
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
    ...raw,
    observedAt: observedAt.toISOString(),
    identity,
  };
}

export type ScanResult = {
  events: number;
  skipped: number;
  byHarness: Record<string, number>;
};

export async function scanOnce(
  collectors: Collector[],
  ctx: CollectorContext,
  batcher: Batcher,
  identity: TelemetryEvent["identity"],
  recent: Set<string>
): Promise<ScanResult> {
  const result: ScanResult = { events: 0, skipped: 0, byHarness: {} };
  for (const collector of collectors) {
    const roots = await collector.discover();
    if (roots.length === 0) {
      continue;
    }
    try {
      for await (const raw of collector.collect(ctx)) {
        if (recent.has(raw.eventId)) {
          result.skipped++;
          continue;
        }
        const event = stamp(raw, identity);
        const problems = validateEvent(event);
        if (problems.length > 0) {
          ctx.log(
            `${collector.id}: dropped ${raw.eventId}: ${problems.join("; ")}`
          );
          result.skipped++;
          continue;
        }
        recent.add(event.eventId);
        batcher.push(event);
        result.events++;
        result.byHarness[collector.id] =
          (result.byHarness[collector.id] ?? 0) + 1;
      }
    } catch (err) {
      ctx.log(`${collector.id}: collector failed: ${String(err)}`);
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
  return `[${time}] Organisers: ${subject}\n${body.replace(/\n/g, "\n  ")}`;
}

export async function runWatch(
  options: WatchOptions,
  deps: WatchDeps
): Promise<number> {
  const { session, me, say } = deps;
  const state = deps.state;
  const log = (message: string) => {
    deps.log(message);
    if (state) {
      recordLog(state, message);
    }
  };
  const collectors = deps.collectors ?? COLLECTORS;
  const cursors = openCursorStore();
  const recent = loadRecentIds();
  const sinks: Sink[] = [spoolSink(), ...(deps.extraSinks ?? [])];
  if (options.uploadUrl) {
    sinks.push(httpSink(options.uploadUrl, () => session.token()));
  }
  const batcher = createBatcher(sinks, log);
  const recording: Batcher = {
    ...batcher,
    push: (event) => {
      if (state) {
        recordEvent(state, event);
      }
      batcher.push(event);
    },
  };
  let teamId = deps.teamId;
  let teamCheckedAt = Date.now();
  const identity = (): TelemetryEvent["identity"] => ({
    userId: me._id,
    ...(teamId ? { teamId } : {}),
    clientVersion: VERSION,
  });
  const ctx: CollectorContext = { cursors, since: options.since, log };

  const discovered: string[] = [];
  for (const c of collectors) {
    if ((await c.discover()).length > 0) {
      discovered.push(c.id);
    }
  }
  if (state) {
    state.harnesses = collectors.map((c) => ({
      id: c.id,
      found: discovered.includes(c.id),
      requests: 0,
    }));
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
  let lastSeen = Date.now();
  const pollNotifications = async (): Promise<void> => {
    let rows: Awaited<
      ReturnType<typeof session.client.query<typeof api.notifications.forMe>>
    >;
    try {
      rows = await session.client.query(api.notifications.forMe, {
        since: lastSeen,
      });
    } catch (err) {
      log(`notifications: ${String(err)}`);
      return;
    }
    for (const row of rows) {
      if (row.sentAt <= lastSeen) {
        continue;
      }
      lastSeen = row.sentAt;
      if (state) {
        recordNotification(state, row.subject, row.body, row.sentAt);
      }
      (deps.announce ?? ((s, b, at) => say(formatNotification(s, b, at))))(
        row.subject,
        row.body,
        row.sentAt
      );
      if (options.toast) {
        toaster(row.subject, row.body).then((ok) => {
          if (!ok) {
            log("toast failed; notifications still print here");
          }
        });
      }
    }
  };

  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  const tick = async (): Promise<ScanResult> => {
    if (Date.now() - teamCheckedAt > TEAM_REFRESH_MS) {
      teamCheckedAt = Date.now();
      try {
        teamId = (await session.client.query(api.teams.mine, {}))?._id;
      } catch (err) {
        log(`team lookup failed: ${String(err)}`);
      }
    }
    if (state) {
      state.scanning = true;
    }
    const scanned = await scanOnce(
      collectors,
      ctx,
      recording,
      identity(),
      recent
    );
    const ok = await batcher.flush();
    if (ok) {
      cursors.save();
      saveRecentIds(recent);
    }
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
      return EXIT.OK;
    }
    let nextScan = Date.now() + options.intervalMs;
    let nextPoll = Date.now();
    if (state) {
      state.nextScanAt = nextScan;
    }
    while (!(stopping || state?.stopRequested)) {
      const now = Date.now();
      if (now >= nextPoll) {
        await pollNotifications();
        nextPoll = Date.now() + NOTIFY_POLL_MS;
      }
      if (now >= nextScan) {
        if (state?.paused) {
          nextScan = Date.now() + 1000;
        } else {
          await tick();
          nextScan = Date.now() + options.intervalMs;
        }
        if (state) {
          state.nextScanAt = nextScan;
        }
      }
      await Bun.sleep(250);
    }
    say("Stopping, flushing…");
    await batcher.flush();
    cursors.save();
    saveRecentIds(recent);
    return EXIT.INTERRUPTED;
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}
