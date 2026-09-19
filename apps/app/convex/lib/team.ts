import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { imagePathFor } from "./files";

/** Same-origin path for the team logo, if the owner uploaded one. */
export function teamLogoUrlFor(
  team: Pick<Doc<"teams">, "logoId"> | null | undefined
): string | undefined {
  return team?.logoId ? imagePathFor(team.logoId) : undefined;
}

export async function membershipForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Doc<"teamMembers"> | null> {
  return await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

export async function findTeamSubmission(
  ctx: QueryCtx | MutationCtx,
  teamId: Id<"teams">
): Promise<Doc<"submissions"> | null> {
  return await ctx.db
    .query("submissions")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .first();
}

export async function findOwnedSubmission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Doc<"submissions"> | null> {
  const membership = await membershipForUser(ctx, userId);
  if (membership) {
    const byTeam = await findTeamSubmission(ctx, membership.teamId);
    if (byTeam) {
      return byTeam;
    }
  }
  return await ctx.db
    .query("submissions")
    .withIndex("by_user", (q) => q.eq("submittedBy", userId))
    .first();
}
