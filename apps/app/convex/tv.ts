import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { currentEditionId, ofEdition } from "./lib/editions";
import { isDirectoryComplete } from "./lib/directory";
import { externalThumbnail } from "./lib/photo";
import { tvFeedSourceValidator } from "./lib/tvValidators";

const tvFeedPostReturn = v.object({
  _id: v.string(),
  kind: v.union(v.literal("post"), v.literal("github")),
  authorName: v.string(),
  teamName: v.string(),
  text: v.string(),
  hasImage: v.boolean(),
  createdAt: v.number(),
  repo: v.optional(v.string()),
  sha: v.optional(v.string()),
});

async function toTvFeedPost(ctx: QueryCtx, post: Doc<"posts">) {
  const author = post.authorId ? await ctx.db.get(post.authorId) : null;
  const team = post.teamId ? await ctx.db.get(post.teamId) : null;
  const authorName =
    post.kind === "github"
      ? post.github?.actor || team?.name || "GitHub"
      : author?.name || "Alguien";
  return {
    _id: post._id,
    kind: post.kind,
    authorName,
    teamName: team?.name ?? "",
    text: post.text,
    hasImage: Boolean(post.imageId),
    createdAt: post.createdAt,
    ...(post.kind === "github"
      ? {
          repo: post.github?.repo ?? "",
          sha: (post.externalId ?? post._id).slice(-7),
        }
      : {}),
  };
}

/**
 * Public venue feed. Display names and copy only — no emails, no storage URLs.
 */
export const listFeed = query({
  args: {
    source: v.optional(tvFeedSourceValidator),
  },
  returns: v.array(tvFeedPostReturn),
  handler: async (ctx, args) => {
    const source = args.source ?? "participants";
    const editionId = await currentEditionId(ctx);
    // One kind is read from further back: a burst of commits must not empty the posts view.
    const rows = ofEdition(
      await ctx.db
        .query("posts")
        .withIndex("by_created")
        .order("desc")
        .take(source === "all" ? 80 : 400),
      editionId
    );
    const filtered = rows.filter((row) => {
      if (source === "participants") {
        return row.kind === "post";
      }
      if (source === "github") {
        return row.kind === "github";
      }
      return true;
    });
    const out = [];
    for (const row of filtered.slice(0, 16)) {
      out.push(await toTvFeedPost(ctx, row));
    }
    return out;
  },
});

/**
 * The meme screen: the latest posts flagged as memes, newest first. Public
 * like the rest of the venue screens, so the picture is a storage URL rather
 * than the app's session-bound file route. Reads the meme index and each
 * meme's reactions row, so ordinary posts and commits do not rerun it.
 * Reactions are emoji and counts, never who reacted.
 */
export const listMemes = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.string(),
      authorName: v.string(),
      teamName: v.string(),
      text: v.string(),
      imageUrl: v.optional(v.string()),
      createdAt: v.number(),
      /** Most used first. */
      reactions: v.array(v.object({ emoji: v.string(), count: v.number() })),
      commentCount: v.number(),
    })
  ),
  handler: async (ctx) => {
    const editionId = await currentEditionId(ctx);
    const rows = ofEdition(
      await ctx.db
        .query("posts")
        .withIndex("by_meme_created", (q) => q.eq("meme", true))
        .order("desc")
        .take(24),
      editionId
    ).slice(0, 12);
    return await Promise.all(
      rows.map(async (row) => {
        const [post, imageUrl, social] = await Promise.all([
          toTvFeedPost(ctx, row),
          row.imageId ? ctx.storage.getUrl(row.imageId) : null,
          ctx.db
            .query("postSocial")
            .withIndex("by_post", (q) => q.eq("postId", row._id))
            .unique(),
        ]);
        return {
          _id: post._id,
          authorName: post.authorName,
          teamName: post.teamName,
          text: post.text,
          imageUrl: imageUrl ?? undefined,
          createdAt: post.createdAt,
          reactions: (social?.reactions ?? [])
            .map((reaction) => ({
              emoji: reaction.emoji,
              count: reaction.userIds.length,
            }))
            .toSorted((a, b) => b.count - a.count),
          commentCount: social?.commentCount ?? 0,
        };
      })
    );
  },
});

/**
 * The team-formation screen: who is here and which team each person is in,
 * and nothing else from their card. Public like the rest of the venue
 * screens, so photos are storage URLs rather than the app's session-bound
 * file route, and a missing name never falls back to an email.
 */
export const teamFormation = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      photoUrl: v.optional(v.string()),
      team: v.optional(v.object({ id: v.string(), name: v.string() })),
    })
  ),
  handler: async (ctx) => {
    const editionId = await currentEditionId(ctx);
    const [users, teams, memberships] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db
        .query("teams")
        .withIndex("by_edition", (q) => q.eq("editionId", editionId))
        .collect(),
      ofEdition(await ctx.db.query("teamMembers").collect(), editionId),
    ]);
    const teamsById = new Map(teams.map((team) => [team._id, team]));
    // Same row as membershipForUser: the earliest membership, whatever its status.
    const membershipByUser = new Map<string, (typeof memberships)[number]>();
    for (const membership of memberships) {
      if (membership.userId && !membershipByUser.has(membership.userId)) {
        membershipByUser.set(membership.userId, membership);
      }
    }
    const people = await Promise.all(
      users.map(async (user) => {
        const membership = membershipByUser.get(user._id);
        const team =
          membership?.status === "member"
            ? teamsById.get(membership.teamId)
            : undefined;
        // The people on the participants map, plus anyone already in a team.
        if (!team && !(user.directory && isDirectoryComplete(user.directory))) {
          return null;
        }
        const photoId = user.avatarThumbId ?? user.avatarId;
        let photoUrl = user.image ? externalThumbnail(user.image) : undefined;
        if (photoId) {
          photoUrl = (await ctx.storage.getUrl(photoId)) ?? undefined;
        }
        return {
          id: user._id as string,
          name: user.name || "Participante",
          photoUrl,
          team: team ? { id: team._id as string, name: team.name } : undefined,
        };
      })
    );
    return people
      .filter((person) => person !== null)
      .toSorted((a, b) => a.id.localeCompare(b.id));
  },
});

export const listGithubActivity = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.string(),
      repo: v.string(),
      actor: v.string(),
      text: v.string(),
      sha: v.string(),
    })
  ),
  handler: async (ctx) => {
    const editionId = await currentEditionId(ctx);
    const rows = ofEdition(
      await ctx.db
        .query("posts")
        .withIndex("by_created")
        .order("desc")
        .take(80),
      editionId
    );
    return rows
      .filter((row) => row.kind === "github")
      .slice(0, 16)
      .map((row) => ({
        _id: row._id,
        repo: row.github?.repo ?? "",
        actor: row.github?.actor ?? "",
        text: row.text,
        sha: (row.externalId ?? row._id).slice(-7),
      }));
  },
});
