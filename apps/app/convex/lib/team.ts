import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function membershipForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Doc<"teamMembers"> | null> {
  return await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

export async function findOwnedSubmission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Doc<"submissions"> | null> {
  const membership = await membershipForUser(ctx, userId);
  if (membership) {
    const byTeam = await ctx.db
      .query("submissions")
      .withIndex("by_team", (q) => q.eq("teamId", membership.teamId))
      .first();
    if (byTeam) {
      return byTeam;
    }
  }
  return await ctx.db
    .query("submissions")
    .withIndex("by_user", (q) => q.eq("submittedBy", userId))
    .first();
}
