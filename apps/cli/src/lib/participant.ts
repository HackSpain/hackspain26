import type { FunctionReturnType } from "convex/server";
import type { api, Session } from "./api";
import { openSession } from "./api";
import type { CliContext } from "./context";
import type { Me } from "./me";
import { requireOnboarded } from "./me";

export type Participant = { session: Session; me: Me };

export type Team = NonNullable<FunctionReturnType<typeof api.teams.mine>>;
export type TeamSummary = FunctionReturnType<typeof api.teams.list>[number];
export type Track = FunctionReturnType<typeof api.tracks.list>[number];
export type Submission = NonNullable<
  FunctionReturnType<typeof api.submissions.mine>
>;
export type PublicSubmission = FunctionReturnType<
  typeof api.submissions.listPublic
>[number];
export type PerkEntry = FunctionReturnType<
  typeof api.perks.listCatalog
>[number];
export type Milestone = FunctionReturnType<typeof api.milestones.mine>[number];

/**
 * Logged-in, accepted, onboarded (or admin), and inside the hackathon window.
 * Fails fast otherwise; the server enforces the same gates.
 */
export async function openParticipant(
  ctx: CliContext,
  options: { allowClosed?: boolean } = {}
): Promise<Participant> {
  const session = await openSession(ctx, { requireAuth: true });
  const me = await requireOnboarded(session, options);
  return { me, session };
}

/** Same participant ladder without the event-window restriction. */
export async function openAnytimeParticipant(
  ctx: CliContext
): Promise<Participant> {
  return await openParticipant(ctx, { allowClosed: true });
}

/** Same ladder minus the window: `hackspain profile` works while closed. */
export const openProfile = openAnytimeParticipant;
