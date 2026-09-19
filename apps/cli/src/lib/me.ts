import type { FunctionReturnType } from "convex/server";
import type { Session } from "./api";
import { api } from "./api";
import {
  authError,
  CliError,
  EVENT_CLOSED_HINT,
  EXIT,
  ONBOARDING_HINT,
} from "./errors";

export type Me = NonNullable<FunctionReturnType<typeof api.users.me>>;

export type GateState =
  | "admin"
  | "ready"
  | "closed"
  | "onboarding"
  | "pending"
  | "unregistered";

const GATE_CODE: Record<Exclude<GateState, "admin" | "ready">, string> = {
  closed: "EVENT_CLOSED",
  onboarding: "NOT_ONBOARDING",
  pending: "NOT_PENDING",
  unregistered: "NOT_UNREGISTERED",
};

const EVENT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "Europe/Madrid",
  weekday: "short",
});

/**
 * "Sat 3 Oct, 10:00 (Madrid)" — the window is set by organisers in Spain.
 * Built from parts: the literal between date and time ("," or " at ")
 * depends on the runtime's ICU version.
 */
export function formatEventDate(ms: number): string {
  const parts = new Map(
    EVENT_DATE.formatToParts(new Date(ms)).map((part) => [
      part.type,
      part.value,
    ])
  );
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.get(type) ?? "";
  return `${get("weekday")} ${get("day")} ${get("month")}, ${get("hour")}:${get("minute")} (Madrid)`;
}

/** English copy for a closed window; the server sends the Spanish version by code. */
export function closedEventMessage(event: Me["event"]): string {
  if (event.phase === "before" && event.startsAt !== undefined) {
    return `The hackathon has not started yet. It opens on ${formatEventDate(event.startsAt)}.`;
  }
  if (event.phase === "after" && event.endsAt !== undefined) {
    return `The hackathon ended on ${formatEventDate(event.endsAt)}.`;
  }
  return "The hackathon is not running right now.";
}

export type Gate = { state: GateState; message: string; hint?: string };

/** Mirrors the ladder in convex/lib/auth.ts and src/components/auth-gate.tsx. */
export function describeGate(me: Me): Gate {
  if (me.role === "admin") {
    return { message: "Organiser account", state: "admin" };
  }
  if (!me.isRegistered) {
    return {
      hint: "Log in with the email you applied with, or sign up at https://hackspain.com/signup.",
      message: "No HackSpain signup for this email.",
      state: "unregistered",
    };
  }
  if (!me.accepted) {
    return {
      hint: "You will get an email when it is.",
      message: "Application received, not accepted yet.",
      state: "pending",
    };
  }
  if (!me.onboardingComplete) {
    return {
      hint: ONBOARDING_HINT,
      message:
        "Accepted. Confirm your details to unlock teams and submissions.",
      state: "onboarding",
    };
  }
  if (!me.event.open) {
    return {
      hint: EVENT_CLOSED_HINT,
      message: closedEventMessage(me.event),
      state: "closed",
    };
  }
  return { message: "Accepted and onboarded", state: "ready" };
}

export async function fetchMe(session: Session): Promise<Me | null> {
  if (!session.authenticated) {
    return null;
  }
  return await session.client.query(api.users.me, {});
}

/**
 * Fetch the current user and fail fast with a clear message when they cannot
 * use participant features yet. The server enforces the same gates; this only
 * makes the error arrive before the prompts do.
 */
export async function requireOnboarded(
  session: Session,
  options: { allowClosed?: boolean } = {}
): Promise<Me> {
  const me = await fetchMe(session);
  if (!me) {
    throw authError();
  }
  const gate = describeGate(me);
  if (gate.state === "admin" || gate.state === "ready") {
    return me;
  }
  // Selected participant features keep working outside the hackathon window.
  if (gate.state === "closed" && options.allowClosed) {
    return me;
  }
  throw new CliError(gate.message, {
    code: GATE_CODE[gate.state],
    exitCode: EXIT.INELIGIBLE,
    hint: gate.hint,
  });
}
