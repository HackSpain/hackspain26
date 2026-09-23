import { v } from "convex/values";
import { getSignupForUser, isOnboarded } from "./lib/auth";
import {
  authedQuery,
  onboardedMutation,
  onboardedQuery,
} from "./lib/customFunctions";
import { fail } from "./lib/errors";
import { checkedMentions, removePostSocial } from "./feedSocial";
import { mentionValidator } from "./lib/feedSocial";
import { feedTabValidator, hasMemeTag } from "./lib/feedTabs";
import { imagePathFor } from "./lib/files";
import { membershipForUser, teamLogoUrlFor } from "./lib/team";
import { avatarUrlFor } from "./users";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

export const MAX_TEXT = 500;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const postReturn = v.object({
  _id: v.id("posts"),
  /** Echo of the composer's nonce; lets the dashboard keep one card across the optimistic swap. */
  clientId: v.optional(v.string()),
  author: v.optional(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      /** /api/files/<id> for an uploaded picture, else the GitHub avatar. */
      avatarUrl: v.optional(v.string()),
      /** CRM user type label (Mentor, Jurado…); absent for plain hackers. */
      userType: v.optional(v.string()),
    })
  ),
  createdAt: v.number(),
  github: v.optional(
    v.object({
      repo: v.string(),
      event: v.string(),
      url: v.string(),
      actor: v.optional(v.string()),
    })
  ),
  /** Same-origin path (/api/files/<id>) served by the dashboard; never a storage URL. */
  imagePath: v.optional(v.string()),
  kind: v.union(v.literal("post"), v.literal("github")),
  /** People tagged in the text as `@name`; absent when there are none. */
  mentions: v.optional(v.array(mentionValidator)),
  mine: v.boolean(),
  /** The team's project, when it has one: name plus the challenges it entered. */
  project: v.optional(
    v.object({
      challenges: v.array(v.string()),
      name: v.string(),
      status: v.union(v.literal("draft"), v.literal("submitted")),
    })
  ),
  /** /api/files/<id> when the team has a logo. */
  teamLogoUrl: v.optional(v.string()),
  teamName: v.optional(v.string()),
  text: v.string(),
});

async function projectForTeam(
  ctx: QueryCtx | MutationCtx,
  teamId: Id<"teams">
) {
  const submission = await ctx.db
    .query("submissions")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .first();
  if (!submission) {
    return;
  }
  const challenges = [];
  for (const trackId of submission.challengeIds) {
    const track = await ctx.db.get(trackId);
    if (track) {
      challenges.push(track.label);
    }
  }
  return { challenges, name: submission.name, status: submission.status };
}

/**
 * Posts remember the team at posting time; when there was none (or the team
 * was dissolved) fall back to the author's current membership so the feed
 * still says who they build with.
 */
async function teamForPost(
  ctx: QueryCtx | MutationCtx,
  post: Doc<"posts">,
  author: Doc<"users"> | null
): Promise<Doc<"teams"> | null> {
  const stored = post.teamId ? await ctx.db.get(post.teamId) : null;
  if (stored || !author) {
    return stored;
  }
  const membership = await membershipForUser(ctx, author._id);
  return membership ? await ctx.db.get(membership.teamId) : null;
}

async function hydrate(
  ctx: QueryCtx | MutationCtx,
  post: Doc<"posts">,
  viewerId: Doc<"users">["_id"]
) {
  const author = post.authorId ? await ctx.db.get(post.authorId) : null;
  const signup = author ? await getSignupForUser(ctx, author) : null;
  const type = author?.userTypeId ? await ctx.db.get(author.userTypeId) : null;
  const team = await teamForPost(ctx, post, author);
  return {
    _id: post._id,
    clientId: post.clientId,
    author: author
      ? {
          _id: author._id,
          name: author.name ?? signup?.fullName,
          avatarUrl: avatarUrlFor(author),
          userType: type?.label,
        }
      : undefined,
    createdAt: post.createdAt,
    github: post.github,
    imagePath: post.imageId ? imagePathFor(post.imageId) : undefined,
    kind: post.kind,
    mentions: post.mentions,
    mine: post.authorId === viewerId,
    project: team ? await projectForTeam(ctx, team._id) : undefined,
    teamLogoUrl: teamLogoUrlFor(team),
    teamName: team?.name,
    text: post.text,
  };
}

/**
 * Newest first. `before` pages backwards; `after` fetches only newer posts
 * (watcher). Without `tab` it is the whole feed, which is what the CLI reads.
 */
export const list = onboardedQuery({
  args: {
    after: v.optional(v.number()),
    before: v.optional(v.number()),
    limit: v.optional(v.number()),
    tab: v.optional(feedTabValidator),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(MAX_LIMIT, Math.max(1, args.limit ?? DEFAULT_LIMIT));
    const { tab } = args;
    const after = args.after ?? 0;
    const before = args.before ?? Number.MAX_SAFE_INTEGER;
    let indexed;
    if (tab === "meme") {
      indexed = ctx.db
        .query("posts")
        .withIndex("by_meme_created", (q) =>
          q.eq("meme", true).gt("createdAt", after).lt("createdAt", before)
        );
    } else if (tab) {
      const kind = tab === "github" ? "github" : "post";
      indexed = ctx.db
        .query("posts")
        .withIndex("by_kind_created", (q) =>
          q.eq("kind", kind).gt("createdAt", after).lt("createdAt", before)
        );
    } else {
      indexed = ctx.db
        .query("posts")
        .withIndex("by_created", (q) =>
          q.gt("createdAt", after).lt("createdAt", before)
        );
    }
    const rows = await indexed.order("desc").take(limit);
    const out = [];
    for (const row of rows) {
      out.push(await hydrate(ctx, row, ctx.user._id));
    }
    return out;
  },
  returns: v.array(postReturn),
});

export const post = onboardedMutation({
  args: {
    /** Optional nonce from the dashboard composer (≤ 64 chars); stored verbatim. */
    clientId: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    /** People picked from the `@` list; ones the text no longer names are dropped. */
    mentions: v.optional(v.array(mentionValidator)),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const text = args.text.trim();
    if (args.clientId !== undefined && args.clientId.length > 64) {
      fail("VALIDATION", "clientId demasiado largo");
    }
    if (!text && !args.imageId) {
      fail("VALIDATION", "Escribe algo o adjunta una imagen");
    }
    if (text.length > MAX_TEXT) {
      fail("VALIDATION", `Máximo ${MAX_TEXT} caracteres`);
    }
    if (args.imageId) {
      const meta = await ctx.db.system.get(args.imageId);
      if (!meta) {
        fail("NOT_FOUND", "La imagen no se ha subido");
      }
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
      clientId: args.clientId,
      meme: hasMemeTag(text) || undefined,
      mentions: await checkedMentions(ctx, text, args.mentions),
      createdAt: Date.now(),
    });
  },
  returns: v.id("posts"),
});

/**
 * Storage URL behind /api/files/<id>. Only images attached to a post, set as
 * someone's profile picture or used as a team logo resolve, and only for
 * signed-in users.
 */
export const imageUrl = authedQuery({
  args: { imageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const storedPost = await ctx.db
      .query("posts")
      .withIndex("by_image", (q) => q.eq("imageId", args.imageId))
      .first();
    if (storedPost) {
      // Feed images stay behind the participant gate, like the feed itself.
      if (!(await isOnboarded(ctx, ctx.user))) {
        return null;
      }
      return await ctx.storage.getUrl(args.imageId);
    }
    const avatarOwner =
      (await ctx.db
        .query("users")
        .withIndex("by_avatar", (q) => q.eq("avatarId", args.imageId))
        .first()) ??
      (await ctx.db
        .query("users")
        .withIndex("by_avatar_thumb", (q) =>
          q.eq("avatarThumbId", args.imageId)
        )
        .first());
    const logoTeam = avatarOwner
      ? null
      : await ctx.db
          .query("teams")
          .withIndex("by_logo", (q) => q.eq("logoId", args.imageId))
          .first();
    if (!avatarOwner && !logoTeam) {
      return null;
    }
    return await ctx.storage.getUrl(args.imageId);
  },
  returns: v.union(v.string(), v.null()),
});

/** Upload target for images. The client POSTs the file there and gets a storageId back. */
export const generateUploadUrl = onboardedMutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
  returns: v.string(),
});

export const remove = onboardedMutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.postId);
    if (!row) {
      fail("NOT_FOUND", "Publicación no encontrada");
    }
    if (row.authorId !== ctx.user._id && ctx.user.role !== "admin") {
      fail("NOT_OWNER", "Solo puedes borrar tus publicaciones");
    }
    if (row.imageId) {
      await ctx.storage.delete(row.imageId);
    }
    await removePostSocial(ctx, row._id);
    await ctx.db.delete(row._id);
    return null;
  },
  returns: v.null(),
});
