import type { FunctionReturnType } from "convex/server";
import type { Session } from "./api";
import { api } from "./api";
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
      hint: "Finish onboarding in the dashboard, then retry.",
      message:
        "Accepted. Confirm your details to unlock teams and submissions.",
      state: "onboarding",
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
    exitCode: EXIT.INELIGIBLE,
    hint: gate.hint,
  });
}
