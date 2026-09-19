import { v } from "convex/values";
import { getSignupForUser, isAdmin } from "./lib/auth";
import { onboardedMutation, onboardedQuery } from "./lib/customFunctions";
import { fail } from "./lib/errors";
import {
  MAX_COMMENT_TEXT,
  MAX_REACTION_KINDS,
  mentionValidator,
  mentionsInText,
  normalizeEmoji,
} from "./lib/feedSocial";
import type { Mention } from "./lib/feedSocial";
import { avatarThumbnailFor } from "./lib/photo";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/** Reactions, comments and mentions on feed posts: people's posts, GitHub pushes and memes alike. */

async function socialFor(ctx: QueryCtx | MutationCtx, postId: Id<"posts">) {
  return await ctx.db
    .query("postSocial")
    .withIndex("by_post", (q) => q.eq("postId", postId))
    .unique();
}

async function requirePost(ctx: MutationCtx, postId: Id<"posts">) {
  const post = await ctx.db.get(postId);
  if (!post) {
    fail("NOT_FOUND", "Publicación no encontrada");
  }
  return post;
}

/**
 * Mentions as the server trusts them: the person exists, and the text still
 * says `@name`. The name stays as written so old text keeps rendering.
 */
export async function checkedMentions(
  ctx: MutationCtx,
  text: string,
  mentions: Mention[] | undefined
): Promise<Mention[] | undefined> {
  const kept = [];
  for (const mention of mentionsInText(text, mentions ?? [])) {
    if (await ctx.db.get(mention.userId)) {
      kept.push({ name: mention.name, userId: mention.userId });
    }
  }
  return kept.length > 0 ? kept : undefined;
}

/** Everything hanging off a post goes with it. */
export async function removePostSocial(ctx: MutationCtx, postId: Id<"posts">) {
  const social = await socialFor(ctx, postId);
  if (social) {
    await ctx.db.delete(social._id);
  }
  const comments = await ctx.db
    .query("postComments")
    .withIndex("by_post", (q) => q.eq("postId", postId))
    .collect();
  for (const comment of comments) {
    await ctx.db.delete(comment._id);
  }
}

/**
 * What one card shows under the post. One document per post, so a reaction
 * reruns this for that post alone. Counts only: who reacted stays on the server.
 */
export const forPost = onboardedQuery({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const social = await socialFor(ctx, args.postId);
    return {
      commentCount: social?.commentCount ?? 0,
      reactions: (social?.reactions ?? []).map((reaction) => ({
        count: reaction.userIds.length,
        emoji: reaction.emoji,
        mine: reaction.userIds.includes(ctx.user._id),
      })),
    };
  },
  returns: v.object({
    commentCount: v.number(),
    reactions: v.array(
      v.object({ count: v.number(), emoji: v.string(), mine: v.boolean() })
    ),
  }),
});

/** Adds the viewer's reaction, or takes it back if it was already there. */
export const toggleReaction = onboardedMutation({
  args: { emoji: v.string(), postId: v.id("posts") },
  handler: async (ctx, args) => {
    const emoji = normalizeEmoji(args.emoji);
    if (!emoji) {
      fail("VALIDATION", "Reacciona con un solo emoji");
    }
    await requirePost(ctx, args.postId);
    const social = await socialFor(ctx, args.postId);
    const reactions = social?.reactions ?? [];
    const current = reactions.find((reaction) => reaction.emoji === emoji);
    let next;
    if (current?.userIds.includes(ctx.user._id)) {
      next = reactions
        .map((reaction) =>
          reaction === current
            ? { emoji, userIds: current.userIds.filter((id) => id !== ctx.user._id) }
            : reaction
        )
        .filter((reaction) => reaction.userIds.length > 0);
    } else if (current) {
      next = reactions.map((reaction) =>
        reaction === current
          ? { emoji, userIds: [...current.userIds, ctx.user._id] }
          : reaction
      );
    } else {
      if (reactions.length >= MAX_REACTION_KINDS) {
        fail("VALIDATION", "Esta publicación ya tiene muchas reacciones distintas. Suma la tuya a una de ellas.");
      }
      next = [...reactions, { emoji, userIds: [ctx.user._id] }];
    }
    if (social) {
      await ctx.db.patch(social._id, { reactions: next });
    } else {
      await ctx.db.insert("postSocial", {
        commentCount: 0,
        postId: args.postId,
        reactions: next,
      });
    }
    return null;
  },
  returns: v.null(),
});

const commentReturn = v.object({
  _id: v.id("postComments"),
  author: v.object({
    _id: v.id("users"),
    avatarUrl: v.optional(v.string()),
    name: v.optional(v.string()),
  }),
  /** The viewer wrote it, or is an admin. */
  canRemove: v.boolean(),
  createdAt: v.number(),
  mentions: v.array(mentionValidator),
  text: v.string(),
});

async function hydrateComment(
  ctx: QueryCtx,
  comment: Doc<"postComments">,
  viewer: Doc<"users">
) {
  const author = await ctx.db.get(comment.authorId);
  const signup = author && !author.name ? await getSignupForUser(ctx, author) : null;
  return {
    _id: comment._id,
    author: {
      _id: comment.authorId,
      avatarUrl: author ? avatarThumbnailFor(author) : undefined,
      name: author?.name ?? signup?.fullName,
    },
    canRemove: comment.authorId === viewer._id || isAdmin(viewer),
    createdAt: comment.createdAt,
    mentions: comment.mentions ?? [],
    text: comment.text,
  };
}

const COMMENTS_LIMIT = 100;

/** A post's thread, oldest first. Only subscribed while the thread is open. */
export const comments = onboardedQuery({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    // The latest hundred, shown in the order they were written.
    const rows = await ctx.db
      .query("postComments")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .order("desc")
      .take(COMMENTS_LIMIT);
    const out = [];
    for (const row of rows.toReversed()) {
      out.push(await hydrateComment(ctx, row, ctx.user));
    }
    return out;
  },
  returns: v.array(commentReturn),
});

export const addComment = onboardedMutation({
  args: {
    mentions: v.optional(v.array(mentionValidator)),
    postId: v.id("posts"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const text = args.text.trim();
    if (!text) {
      fail("VALIDATION", "Escribe algo");
    }
    if (text.length > MAX_COMMENT_TEXT) {
      fail("VALIDATION", `Máximo ${MAX_COMMENT_TEXT} caracteres`);
    }
    await requirePost(ctx, args.postId);
    const id = await ctx.db.insert("postComments", {
      authorId: ctx.user._id,
      createdAt: Date.now(),
      mentions: await checkedMentions(ctx, text, args.mentions),
      postId: args.postId,
      text,
    });
    const social = await socialFor(ctx, args.postId);
    if (social) {
      await ctx.db.patch(social._id, { commentCount: social.commentCount + 1 });
    } else {
      await ctx.db.insert("postSocial", {
        commentCount: 1,
        postId: args.postId,
        reactions: [],
      });
    }
    return id;
  },
  returns: v.id("postComments"),
});

export const removeComment = onboardedMutation({
  args: { commentId: v.id("postComments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      fail("NOT_FOUND", "Comentario no encontrado");
    }
    if (comment.authorId !== ctx.user._id && !isAdmin(ctx.user)) {
      fail("NOT_OWNER", "Solo puedes borrar tus comentarios");
    }
    await ctx.db.delete(comment._id);
    const social = await socialFor(ctx, comment.postId);
    if (social) {
      await ctx.db.patch(social._id, {
        commentCount: Math.max(0, social.commentCount - 1),
      });
    }
    return null;
  },
  returns: v.null(),
});

/**
 * Who can be tagged: everyone through onboarding, by the name they go by. Never
 * an email. Fetched once when someone types `@`, not subscribed, because any
 * profile edit would rerun it.
 */
export const mentionable = onboardedQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const out = [];
    for (const user of users) {
      const name = user.name?.trim();
      if (!name || !(user.onboardingComplete || isAdmin(user))) {
        continue;
      }
      out.push({
        _id: user._id,
        avatarUrl: avatarThumbnailFor(user),
        name,
      });
    }
    return out.toSorted((a, b) => a.name.localeCompare(b.name, "es"));
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      avatarUrl: v.optional(v.string()),
      name: v.string(),
    })
  ),
});
