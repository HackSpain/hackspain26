import { v } from "convex/values";
import { getSignupForUser } from "./lib/auth";
import { onboardedMutation, onboardedQuery } from "./lib/customFunctions";
import { fail } from "./lib/errors";
import { membershipForUser } from "./lib/team";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

export const MAX_TEXT = 500;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const postReturn = v.object({
  _id: v.id("posts"),
  kind: v.union(v.literal("post"), v.literal("github")),
  text: v.string(),
  createdAt: v.number(),
  author: v.optional(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
  ),
  teamName: v.optional(v.string()),
  /** Same-origin path (/api/files/<id>) served by the dashboard; never a storage URL. */
  imagePath: v.optional(v.string()),
  github: v.optional(
    v.object({
      repo: v.string(),
      event: v.string(),
      url: v.string(),
      actor: v.optional(v.string()),
    }),
  ),
  mine: v.boolean(),
});

/** Images are served through the dashboard so links carry our domain, not Convex's. */
export function imagePathFor(
  imageId: Doc<"posts">["imageId"] & string,
): string {
  return `/api/files/${imageId}`;
}

async function hydrate(
  ctx: QueryCtx | MutationCtx,
  post: Doc<"posts">,
  viewerId: Doc<"users">["_id"],
) {
  const author = post.authorId ? await ctx.db.get(post.authorId) : null;
  const signup = author ? await getSignupForUser(ctx, author) : null;
  const team = post.teamId ? await ctx.db.get(post.teamId) : null;
  return {
    _id: post._id,
    kind: post.kind,
    text: post.text,
    createdAt: post.createdAt,
    author: author
      ? {
          _id: author._id,
          name: author.name ?? signup?.fullName,
          email: author.email,
        }
      : undefined,
    teamName: team?.name,
    imagePath: post.imageId ? imagePathFor(post.imageId) : undefined,
    github: post.github,
    mine: post.authorId === viewerId,
  };
}

/** Newest first. `before` pages backwards; `after` fetches only newer posts (watcher). */
export const list = onboardedQuery({
  args: {
    limit: v.optional(v.number()),
    before: v.optional(v.number()),
    after: v.optional(v.number()),
  },
  returns: v.array(postReturn),
  handler: async (ctx, args) => {
    const limit = Math.min(MAX_LIMIT, Math.max(1, args.limit ?? DEFAULT_LIMIT));
    const { after, before } = args;
    const indexed =
      after !== undefined
        ? ctx.db
            .query("posts")
            .withIndex("by_created", (q) => q.gt("createdAt", after))
        : before !== undefined
          ? ctx.db
              .query("posts")
              .withIndex("by_created", (q) => q.lt("createdAt", before))
          : ctx.db.query("posts").withIndex("by_created");
    const rows = await indexed.order("desc").take(limit);
    const out = [];
    for (const row of rows) {
      out.push(await hydrate(ctx, row, ctx.user._id));
    }
    return out;
  },
});

export const post = onboardedMutation({
  args: { text: v.string(), imageId: v.optional(v.id("_storage")) },
  returns: v.id("posts"),
  handler: async (ctx, args) => {
    const text = args.text.trim();
    if (!text && !args.imageId) {
      fail("VALIDATION", "Escribe algo o adjunta una imagen");
    }
    if (text.length > MAX_TEXT) {
      fail("VALIDATION", `Máximo ${MAX_TEXT} caracteres`);
    }
    if (args.imageId) {
      const meta = await ctx.db.system.get(args.imageId);
      if (!meta) fail("NOT_FOUND", "La imagen no se ha subido");
      if (!meta.contentType?.startsWith("image/")) {
        fail("VALIDATION", "Solo se admiten imágenes");
      }
    }
    const membership = await membershipForUser(ctx, ctx.user._id);
    return await ctx.db.insert("posts", {
      kind: "post",
      authorId: ctx.user._id,
      teamId: membership?.teamId,
      text,
      imageId: args.imageId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Storage URL behind /api/files/<id>. Only images attached to a post resolve,
 * and only for onboarded participants, like the feed itself.
 */
export const imageUrl = onboardedQuery({
  args: { imageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("posts")
      .withIndex("by_image", (q) => q.eq("imageId", args.imageId))
      .first();
    if (!post) return null;
    return await ctx.storage.getUrl(args.imageId);
  },
});

/** Upload target for images. The client POSTs the file there and gets a storageId back. */
export const generateUploadUrl = onboardedMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const remove = onboardedMutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.postId);
    if (!row) fail("NOT_FOUND", "Publicación no encontrada");
    if (row.authorId !== ctx.user._id && ctx.user.role !== "admin") {
      fail("NOT_OWNER", "Solo puedes borrar tus publicaciones");
    }
    if (row.imageId) {
      await ctx.storage.delete(row.imageId);
    }
    await ctx.db.delete(row._id);
    return null;
  },
});
