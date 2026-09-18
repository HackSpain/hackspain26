import { join } from "node:path";
import { readJsonFile, stateDir, writeFileAtomic } from "../lib/config";
import type { TelemetryEvent } from "./schema";
import type { WatchState } from "./state";
import { NOTIFICATIONS_KEPT, recordEvent } from "./state";

/**
 * What the watcher remembers between runs, so reopening it does not start
 * from a blank board:
 *
 * - `firstStartedAt`: when this machine first ran the watcher; the board
 *   says "since …" and totals cover everything from then (replayed from the
 *   local spool, which is the source of truth for usage).
 * - `lastActiveAt`: the last scan; the next run catches up on harness logs
 *   written while the watcher was closed instead of skipping them.
 * - `notifications`: the last organiser announcements, shown again on start,
 *   and `lastNotificationAt` so the first poll fetches what was missed.
 */
export type RememberedNotification = {
  subject: string;
  body: string;
  at: number;
};

export type WatchMemory = {
  version: 1;
  firstStartedAt: number;
  lastActiveAt?: number;
  lastNotificationAt?: number;
  notifications: RememberedNotification[];
};

export type MemoryStore = {
  readonly data: WatchMemory;
  /** Persist; cheap and idempotent, called after every scan. */
  save(): void;
};

export function memoryPath(): string {
  return join(stateDir(), "watch-memory.json");
}

function fresh(now: number): WatchMemory {
  return { firstStartedAt: now, notifications: [], version: 1 };
}

function sane(loaded: unknown, now: number): WatchMemory {
  if (
    typeof loaded !== "object" ||
    loaded === null ||
    (loaded as { version?: unknown }).version !== 1
  ) {
    return fresh(now);
  }
  const m = loaded as Partial<WatchMemory>;
  const number = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;
  const notifications = Array.isArray(m.notifications)
    ? m.notifications
        .filter(
          (n): n is RememberedNotification =>
            typeof n === "object" &&
            n !== null &&
            typeof n.subject === "string" &&
            typeof n.body === "string" &&
            typeof n.at === "number"
        )
        .slice(0, NOTIFICATIONS_KEPT)
    : [];
  return {
    firstStartedAt: number(m.firstStartedAt) ?? now,
    lastActiveAt: number(m.lastActiveAt),
    lastNotificationAt: number(m.lastNotificationAt),
    notifications,
    version: 1,
  };
}

/** Load (or start) the memory file at `path`. */
export function openMemory(path = memoryPath(), now = Date.now()): MemoryStore {
  const data = sane(readJsonFile<unknown>(path), now);
  return {
    data,
    save: () => {
      writeFileAtomic(path, `${JSON.stringify(data)}\n`, 0o600);
    },
  };
}

/** In-memory store for tests. */
export function ephemeralMemory(now = Date.now()): MemoryStore {
  return { data: fresh(now), save: () => undefined };
}

/** Remember an announcement, newest first, deduplicated, capped. */
export function rememberNotification(
  memory: WatchMemory,
  notification: RememberedNotification
): void {
  if (
    memory.notifications.some(
      (n) => n.at === notification.at && n.subject === notification.subject
    )
  ) {
    return;
  }
  memory.notifications.unshift(notification);
  memory.notifications.sort((a, b) => b.at - a.at);
  memory.notifications.splice(NOTIFICATIONS_KEPT);
  memory.lastNotificationAt = Math.max(
    memory.lastNotificationAt ?? 0,
    notification.at
  );
}

/** Desktop toasts only for announcements that are actually new; catching up stays on screen. */
export const TOAST_WINDOW_MS = 10 * 60 * 1000;

export function shouldToast(sentAt: number, now = Date.now()): boolean {
  return now - sentAt <= TOAST_WINDOW_MS;
}

/**
 * Rebuild the board from the local spool: every usage event this machine
 * recorded since the first run, so the harness table and recent requests
 * are never empty on reopen. Returns how many events were replayed.
 */
export function replaySpool(
  state: WatchState,
  events: Iterable<TelemetryEvent>
): number {
  let count = 0;
  for (const event of events) {
    recordEvent(state, event);
    count++;
  }
  return count;
}
