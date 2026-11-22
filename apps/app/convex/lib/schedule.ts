import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";

export const applicationsModeValidator = v.union(
  v.literal("auto"),
  v.literal("closed"),
  v.literal("waitlist"),
  v.literal("open")
);

export const submissionsModeValidator = v.union(
  v.literal("auto"),
  v.literal("on"),
  v.literal("off")
);

export type ApplicationsMode = Infer<typeof applicationsModeValidator>;
export type SubmissionsMode = Infer<typeof submissionsModeValidator>;
export type ApplicationsStatus = "closed" | "waitlist" | "open";

export type EditionSchedule = Pick<
  Doc<"editions">,
  | "applicationsClosesAt"
  | "applicationsMode"
  | "applicationsOpensAt"
  | "applicationsWaitlistFrom"
  | "checkInOpensAt"
  | "submissionsMode"
  | "submissionsOpen"
  | "submitClosesAt"
  | "submitOpensAt"
>;

/**
 * Landing of the current edition. Empty dates mean unscheduled = closed.
 * Overrides short-circuit the calendar.
 */
export function applicationsStatus(
  edition: EditionSchedule,
  now: number
): ApplicationsStatus {
  const mode = edition.applicationsMode ?? "auto";
  if (mode === "closed" || mode === "waitlist" || mode === "open") {
    return mode;
  }
  const opens = edition.applicationsOpensAt;
  const waitlistFrom = edition.applicationsWaitlistFrom;
  const closes = edition.applicationsClosesAt;
  if (
    opens === undefined &&
    waitlistFrom === undefined &&
    closes === undefined
  ) {
    return "closed";
  }
  if (opens !== undefined && now < opens) {
    return "closed";
  }
  if (closes !== undefined && now >= closes) {
    return "closed";
  }
  if (waitlistFrom !== undefined && now >= waitlistFrom) {
    return "waitlist";
  }
  return "open";
}

/**
 * `submissionsMode` wins when set. Unset keeps the stored boolean so existing
 * editions keep today's toggle. Auto uses submit open/close; empty dates are
 * closed.
 */
export function submissionsAreOpenFor(
  edition: EditionSchedule,
  now: number
): boolean {
  const mode = edition.submissionsMode;
  if (mode === "on") {
    return true;
  }
  if (mode === "off") {
    return false;
  }
  if (mode === "auto") {
    const opens = edition.submitOpensAt;
    const closes = edition.submitClosesAt;
    if (opens === undefined && closes === undefined) {
      return false;
    }
    if (opens !== undefined && now < opens) {
      return false;
    }
    if (closes !== undefined && now >= closes) {
      return false;
    }
    return true;
  }
  return edition.submissionsOpen;
}

/** Unset check-in time means scans are allowed. */
export function checkInIsOpen(edition: EditionSchedule, now: number): boolean {
  return edition.checkInOpensAt === undefined || now >= edition.checkInOpensAt;
}
