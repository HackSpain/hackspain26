import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { fail } from "./errors";

type Ctx = QueryCtx | MutationCtx;

/** Key of the singleton `settings` row that holds hackathon-wide switches. */
export const HACKATHON_SETTINGS_KEY = "hackathon";

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

export async function settingsDoc(ctx: Ctx): Promise<Doc<"settings"> | null> {
  return await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", HACKATHON_SETTINGS_KEY))
    .unique();
}

export async function getEventWindow(ctx: Ctx): Promise<EventWindow> {
  const row = await settingsDoc(ctx);
  return { endsAt: row?.eventEndsAt, startsAt: row?.eventStartsAt };
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
 * are never gated. Wired into the onboarded and judge ladders in
 * customFunctions.ts, which is what the CLI's rpc route runs.
 */
export async function requireEventOpen(
  ctx: Ctx,
  user: Pick<Doc<"users">, "role">
): Promise<void> {
  if (user.role === "admin") {
    return;
  }
  const window = await getEventWindow(ctx);
  const phase = eventPhase(window, Date.now());
  if (!eventIsOpen(phase)) {
    fail("EVENT_CLOSED", closedMessage(phase, window));
  }
}
