import type { FunctionReturnType } from "convex/server";
import { api, type Session } from "./api";
import { authError, CliError, EXIT } from "./errors";

export type Me = NonNullable<FunctionReturnType<typeof api.users.me>>;

export type GateState =
  | "admin"
  | "ready"
  | "onboarding"
  | "pending"
  | "unregistered";

export type Gate = { state: GateState; message: string; hint?: string };

/** Mirrors the ladder in convex/lib/auth.ts and src/components/auth-gate.tsx. */
export function describeGate(me: Me): Gate {
  if (me.role === "admin") {
    return { state: "admin", message: "Organiser account" };
  }
  if (!me.isRegistered) {
    return {
      state: "unregistered",
      message: "No HackSpain signup for this email.",
      hint: "Log in with the email you applied with, or sign up at https://hackspain.com/signup.",
    };
  }
  if (!me.accepted) {
    return {
      state: "pending",
      message: "Application received, not accepted yet.",
      hint: "You will get an email when it is.",
    };
  }
  if (!me.onboardingComplete) {
    return {
      state: "onboarding",
      message:
        "Accepted. Confirm your details to unlock teams and submissions.",
      hint: "Finish onboarding in the dashboard, then retry.",
    };
  }
  return { state: "ready", message: "Accepted and onboarded" };
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
export async function requireOnboarded(session: Session): Promise<Me> {
  const me = await fetchMe(session);
  if (!me) {
    throw authError();
  }
  const gate = describeGate(me);
  if (gate.state === "admin" || gate.state === "ready") {
    return me;
  }
  throw new CliError(gate.message, {
    code: `NOT_${gate.state.toUpperCase()}`,
    hint: gate.hint,
    exitCode: EXIT.INELIGIBLE,
  });
}
