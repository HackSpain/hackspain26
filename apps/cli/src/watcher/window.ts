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
  /**
   * The hackathon as scheduled on the server, whoever is watching. Organiser
   * accounts are not bound by it (`scheduled` is false for them), yet the
   * screen still tells them where the clock stands.
   */
  hackathon?: { startsAt: number; endsAt: number };
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
  if (startsAt === undefined || endsAt === undefined) {
    return { scheduled: false, since: fallbackSince };
  }
  const hackathon = { endsAt, startsAt };
  if (me.role === "admin") {
    return { hackathon, scheduled: false, since: fallbackSince };
  }
  return { hackathon, scheduled: true, since: startsAt, until: endsAt };
}

export type WindowPhase = "before" | "during" | "after";

/** Where `now` falls in the hackathon; undefined when none is scheduled. */
export function windowPhase(
  window: Pick<CollectionWindow, "hackathon"> | undefined,
  now: number
): WindowPhase | undefined {
  const hackathon = window?.hackathon;
  if (!hackathon) {
    return;
  }
  if (now < hackathon.startsAt) {
    return "before";
  }
  return now < hackathon.endsAt ? "during" : "after";
}

/**
 * Whether this watcher records right now. Participants only during the
 * hackathon; organisers and servers without a schedule always.
 */
export function isRecording(
  window: CollectionWindow | undefined,
  now: number
): boolean {
  return !window?.scheduled || windowPhase(window, now) === "during";
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
  const hackathon = window?.hackathon;
  if (!(hackathon && phase) || phase === "during") {
    return;
  }
  const when =
    phase === "before"
      ? `starts ${formatDate(hackathon.startsAt)}`
      : `ended ${formatDate(hackathon.endsAt)}`;
  if (!window?.scheduled) {
    // Organisers test before the doors open, so theirs keeps recording.
    return `Outside the hackathon window: it ${when}. Organiser account, so this one still records; participants' watchers do not.`;
  }
  return phase === "before"
    ? `Not recording yet: the hackathon ${when}. Leave this open, it starts on its own.`
    : `Not recording: the hackathon ${when}. Only usage from inside it is still delivered.`;
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
