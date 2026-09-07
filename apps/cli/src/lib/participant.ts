import type { FunctionReturnType } from "convex/server";
import { type api, openSession, type Session } from "./api";
import type { CliContext } from "./context";
import { type Me, requireOnboarded } from "./me";

export type Participant = { session: Session; me: Me };

export type Team = NonNullable<FunctionReturnType<typeof api.teams.mine>>;
export type TeamSummary = FunctionReturnType<typeof api.teams.list>[number];
export type Track = FunctionReturnType<typeof api.tracks.list>[number];
export type Submission = NonNullable<
  FunctionReturnType<typeof api.submissions.mine>
>;
export type PublicProject = FunctionReturnType<
  typeof api.submissions.listPublic
>[number];
export type PerkEntry = FunctionReturnType<
  typeof api.perks.listCatalog
>[number];
export type Milestone = FunctionReturnType<typeof api.milestones.mine>[number];

/** Logged-in, accepted, onboarded (or admin). Fails fast otherwise. */
export async function openParticipant(ctx: CliContext): Promise<Participant> {
  const session = await openSession(ctx, { requireAuth: true });
  const me = await requireOnboarded(session);
  return { session, me };
}
