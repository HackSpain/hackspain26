import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { currentEdition } from "./editions";
import { fail } from "./errors";

type Ctx = QueryCtx | MutationCtx;

export type EventWindow = { startsAt?: number; endsAt?: number };

/**
 * Where "now" sits relative to the admin-set window. `unscheduled` means an
 * admin has not saved both bounds yet, which counts as open.
 */
export type EventPhase = "unscheduled" | "before" | "during" | "after";

export const eventPhaseValidator = v.union(
  v.literal("unscheduled"),
  v.literal("before"),
  v.literal("during"),
  v.literal("after")
);

export const eventWindowValidator = v.object({
  endsAt: v.optional(v.number()),
  /** False only for non-admins outside a scheduled window. */
  open: v.boolean(),
  phase: eventPhaseValidator,
  startsAt: v.optional(v.number()),
});

export async function getEventWindow(ctx: Ctx): Promise<EventWindow> {
  const edition = await currentEdition(ctx);
  return { endsAt: edition.eventEndsAt, startsAt: edition.eventStartsAt };
}

export function eventPhase(window: EventWindow, now: number): EventPhase {
  if (window.startsAt === undefined || window.endsAt === undefined) {
    return "unscheduled";
  }
  if (now < window.startsAt) {
    return "before";
  }
  if (now >= window.endsAt) {
    return "after";
  }
  return "during";
}

export function eventIsOpen(phase: EventPhase): boolean {
  return phase === "unscheduled" || phase === "during";
}

const DATE_FORMAT = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "long",
  timeZone: "Europe/Madrid",
  weekday: "long",
});

export function formatEventDate(ms: number): string {
  return DATE_FORMAT.format(new Date(ms));
}

const DAY_FORMAT = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Madrid",
  year: "numeric",
});

function madridDay(ms: number): { day: string; month: string; year: string } {
  const parts = DAY_FORMAT.formatToParts(new Date(ms));
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return { day, month, year };
}

/** Compact Madrid range for emails. Missing bounds leave the caller to fall back. */
export function editionDatesLine(
  startsAt?: number,
  endsAt?: number
): string | undefined {
  if (startsAt === undefined || endsAt === undefined) {
    return undefined;
  }
  const start = madridDay(startsAt);
  const end = madridDay(endsAt);
  if (start.month === end.month && start.year === end.year) {
    return `Madrid · ${start.day}—${end.day} ${start.month} ${start.year}`;
  }
  if (start.year === end.year) {
    return `Madrid · ${start.day} ${start.month} — ${end.day} ${end.month} ${start.year}`;
  }
  return `Madrid · ${start.day} ${start.month} ${start.year} — ${end.day} ${end.month} ${end.year}`;
}

/** Spanish copy for a closed window; the CLI swaps it for English by code. */
export function closedMessage(phase: EventPhase, window: EventWindow): string {
  if (phase === "before" && window.startsAt !== undefined) {
    return `La hackathon empieza el ${formatEventDate(window.startsAt)}. Hasta entonces puedes editar tu perfil, ver el directorio y acceder a los perks.`;
  }
  if (phase === "after" && window.endsAt !== undefined) {
    return `La hackathon terminó el ${formatEventDate(window.endsAt)}. Puedes editar tu perfil, ver el directorio y acceder a los perks.`;
  }
  return "La hackathon no está en marcha. Puedes editar tu perfil, ver el directorio y acceder a los perks.";
}

/**
 * Throws `EVENT_CLOSED` for participants outside the scheduled window. Admins
 * are never gated. Wired into the onboarded participant ladder in
 * customFunctions.ts. Judging uses requireJudge without a window check so
 * scoring can continue after submit closes.
 */
export async function requireEventOpen(
  ctx: Ctx,
  user: Pick<Doc<"users">, "admin" | "role">
): Promise<void> {
  if (user.admin === true || user.role === "admin") {
    return;
  }
  const window = await getEventWindow(ctx);
  const phase = eventPhase(window, Date.now());
  if (!eventIsOpen(phase)) {
    fail("EVENT_CLOSED", closedMessage(phase, window));
  }
}
