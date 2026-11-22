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
  userId: Id<"users">,
  editionId?: Id<"editions">
): Promise<Doc<"teamMembers"> | null> {
  const rows = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (editionId === undefined) {
    return rows[0] ?? null;
  }
  for (const row of rows) {
    if (row.editionId === editionId) {
      return row;
    }
    const team = await ctx.db.get(row.teamId);
    if (team?.editionId === editionId) {
      return row;
    }
  }
  return null;
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
  userId: Id<"users">,
  editionId?: Id<"editions">
): Promise<Doc<"submissions"> | null> {
  const membership = await membershipForUser(ctx, userId, editionId);
  if (membership) {
    const byTeam = await findTeamSubmission(ctx, membership.teamId);
    if (byTeam && (editionId === undefined || byTeam.editionId === editionId)) {
      return byTeam;
    }
  }
  const owned = await ctx.db
    .query("submissions")
    .withIndex("by_user", (q) => q.eq("submittedBy", userId))
    .collect();
  const match = owned.find(
    (row) =>
      !row.teamId && (editionId === undefined || row.editionId === editionId)
  );
  return match ?? null;
}
