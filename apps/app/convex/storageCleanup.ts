import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 24;

/** These are all four persisted references to _storage in schema.ts. */
async function isReferenced(ctx: MutationCtx, imageId: Id<"_storage">) {
  return Boolean(
    (await ctx.db
      .query("posts")
      .withIndex("by_image", (q) => q.eq("imageId", imageId))
      .first()) ??
      (await ctx.db
        .query("users")
        .withIndex("by_avatar", (q) => q.eq("avatarId", imageId))
        .first()) ??
      (await ctx.db
        .query("users")
        .withIndex("by_avatar_thumb", (q) => q.eq("avatarThumbId", imageId))
        .first()) ??
      (await ctx.db
        .query("teams")
        .withIndex("by_logo", (q) => q.eq("logoId", imageId))
        .first())
  );
}

/**
 * Uploads can be abandoned between the HTTP POST and the mutation that stores
 * their ID. A failed mutation cannot delete them because its writes roll back.
 * Scan the storage system table in small batches, deleting only old files with
 * no persisted reference. A fresh file remains available for a pending attach.
 */
export const sweep = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - GRACE_PERIOD_MS;
    const page = await ctx.db.system
      .query("_storage")
      .order("asc")
      .paginate({ cursor: args.cursor ?? null, numItems: PAGE_SIZE });

    for (const file of page.page) {
      if (file._creationTime >= cutoff) {
        // Storage is ordered by creation time, so all later files are fresh.
        return null;
      }
      if (!(await isReferenced(ctx, file._id))) {
        await ctx.storage.delete(file._id);
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.storageCleanup.sweep, {
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});
