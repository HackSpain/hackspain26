import type { Me } from "../lib/me";

/**
 * What the watcher may report: `[since, until)` on the time the harness
 * recorded the event (`occurredAt`), never on when the watcher read it.
 */
export type CollectionWindow = {
  since: number;
  /** Exclusive upper bound; undefined while no end is scheduled. */
  until?: number;
  /** True when the bounds come from the organisers' hackathon window. */
  scheduled: boolean;
};

/**
 * With a scheduled hackathon the window is the hackathon itself, whole: a
 * watcher first opened on Sunday still reports Saturday's usage, and nothing
 * from before the start or after the end is reported at all. `--backfill`
 * and the last-run catch-up only matter on a server without a schedule (dev)
 * and for organisers, who test before the doors open.
 */
export function collectionWindow(
  me: Pick<Me, "event" | "role">,
  fallbackSince: number
): CollectionWindow {
  const { startsAt, endsAt } = me.event;
  if (me.role === "admin" || startsAt === undefined || endsAt === undefined) {
    return { scheduled: false, since: fallbackSince };
  }
  return { scheduled: true, since: startsAt, until: endsAt };
}

export type WindowPhase = "before" | "during" | "after";

/** Where `now` falls; undefined without a scheduled window. */
export function windowPhase(
  window: Pick<CollectionWindow, "since" | "until" | "scheduled"> | undefined,
  now: number
): WindowPhase | undefined {
  if (!window?.scheduled || window.until === undefined) {
    return;
  }
  if (now < window.since) {
    return "before";
  }
  return now < window.until ? "during" : "after";
}

/**
 * What the watcher shows while the clock is outside the window, so nobody
 * leaves it running believing it records. `formatDate` is injected to keep
 * this module free of the CLI's copy helpers.
 */
export function windowNotice(
  window: CollectionWindow | undefined,
  now: number,
  formatDate: (ms: number) => string
): string | undefined {
  const phase = windowPhase(window, now);
  if (!window || window.until === undefined || !phase || phase === "during") {
    return;
  }
  return phase === "before"
    ? `Not recording yet: the hackathon starts ${formatDate(window.since)}. Leave this open, it starts on its own.`
    : `Not recording: the hackathon ended ${formatDate(window.until)}. Only usage from inside it is still delivered.`;
}

export function inWindow(
  occurredAt: string,
  window: Pick<CollectionWindow, "since" | "until">
): boolean {
  const at = Date.parse(occurredAt);
  if (Number.isNaN(at) || at < window.since) {
    return false;
  }
  return window.until === undefined || at < window.until;
}
