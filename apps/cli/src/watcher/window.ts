import type { Me } from "../lib/me";

/**
 * What the watcher may report: `[since, until)` on the time the harness
 * recorded the event (`occurredAt`), never on when the watcher read it.
 */
export type CollectionWindow = { since: number; until: number };

/**
 * The window is the hackathon as organisers scheduled it, whole and for
 * everyone: a watcher first opened on Sunday still reports Saturday's usage,
 * and nothing from before the start or after the end is reported by anybody,
 * organisers included. No schedule means no window, so nothing is recorded
 * (null). The server enforces the same rule on every upload.
 */
export function collectionWindow(
  me: Pick<Me, "event">
): CollectionWindow | null {
  const { startsAt, endsAt } = me.event;
  if (startsAt === undefined || endsAt === undefined) {
    return null;
  }
  return { since: startsAt, until: endsAt };
}

export type WindowPhase = "unscheduled" | "before" | "during" | "after";

/** Where `now` falls. `null` is "no hackathon scheduled"; `undefined` is "not known". */
export function windowPhase(
  window: CollectionWindow | null | undefined,
  now: number
): WindowPhase | undefined {
  if (window === undefined) {
    return;
  }
  if (window === null) {
    return "unscheduled";
  }
  if (now < window.since) {
    return "before";
  }
  return now < window.until ? "during" : "after";
}

/** Whether usage happening right now is recorded: only during the hackathon. */
export function isRecording(
  window: CollectionWindow | null | undefined,
  now: number
): boolean {
  return windowPhase(window, now) === "during";
}

/**
 * What the watcher shows while the clock is outside the window, so nobody
 * leaves it running believing it records. `formatDate` is injected to keep
 * this module free of the CLI's copy helpers.
 */
export function windowNotice(
  window: CollectionWindow | null | undefined,
  now: number,
  formatDate: (ms: number) => string
): string | undefined {
  const phase = windowPhase(window, now);
  if (phase === "unscheduled") {
    return "Not recording: no hackathon is scheduled on this server yet. Leave this open, it starts once there is one.";
  }
  if (!window || phase === undefined || phase === "during") {
    return;
  }
  return phase === "before"
    ? `Not recording yet: the hackathon starts ${formatDate(window.since)}. Leave this open, it starts on its own.`
    : `Not recording: the hackathon ended ${formatDate(window.until)}. Only usage from inside it is still delivered.`;
}

export function inWindow(
  occurredAt: string,
  window: { since: number; until?: number }
): boolean {
  const at = Date.parse(occurredAt);
  if (Number.isNaN(at) || at < window.since) {
    return false;
  }
  return window.until === undefined || at < window.until;
}
