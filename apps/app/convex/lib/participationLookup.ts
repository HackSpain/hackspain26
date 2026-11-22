import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { currentEdition } from "./editions";

type Ctx = QueryCtx | MutationCtx;

export async function participationByEditionEmail(
  ctx: Ctx,
  editionId: Id<"editions">,
  email: string
): Promise<Doc<"participations"> | null> {
  return await ctx.db
    .query("participations")
    .withIndex("by_edition_email", (q) =>
      q.eq("editionId", editionId).eq("email", email)
    )
    .unique();
}

export async function participationByEditionUser(
  ctx: Ctx,
  editionId: Id<"editions">,
  userId: Id<"users">
): Promise<Doc<"participations"> | null> {
  return await ctx.db
    .query("participations")
    .withIndex("by_edition_user", (q) =>
      q.eq("editionId", editionId).eq("userId", userId)
    )
    .unique();
}

export async function getCurrentParticipation(
  ctx: Ctx,
  user: Pick<Doc<"users">, "_id" | "email">
): Promise<Doc<"participations"> | null> {
  const edition = await currentEdition(ctx);
  const byUser = await participationByEditionUser(ctx, edition._id, user._id);
  if (byUser) {
    return byUser;
  }
  if (!user.email) {
    return null;
  }
  return await participationByEditionEmail(ctx, edition._id, user.email);
}
