import { v } from "convex/values";
import { query } from "./_generated/server";

const TOP_EMOJIS = 6;
const FEED_HOURS = 24;

/**
 * Event totals for the closing slides, next to what `tvPlayback.insightsBase`
 * already gives. Counts only: no names, no scores, nothing about judging.
 */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const [passes, teams, memberships, submissions, tracks, posts, social, milestones] =
      await Promise.all([
        ctx.db.query("eventPasses").collect(),
        ctx.db.query("teams").collect(),
        ctx.db.query("teamMembers").collect(),
        ctx.db
          .query("submissions")
          .withIndex("by_status", (q) => q.eq("status", "submitted"))
          .collect(),
        ctx.db.query("tracks").collect(),
        ctx.db
          .query("posts")
          .withIndex("by_kind_created", (q) => q.eq("kind", "post"))
          .collect(),
        ctx.db.query("postSocial").collect(),
        ctx.db.query("milestones").collect(),
      ]);

    const members = memberships.filter((row) => row.status === "member");
    const teamsWithMembers = new Set(members.map((row) => row.teamId));

    const perTrack = new Map<string, number>();
    for (const submission of submissions) {
      for (const trackId of submission.challengeIds) {
        perTrack.set(trackId, (perTrack.get(trackId) ?? 0) + 1);
      }
    }

    const emojis = new Map<string, number>();
    let reactions = 0;
    let comments = 0;
    for (const row of social) {
      comments += row.commentCount;
      for (const reaction of row.reactions) {
        reactions += reaction.userIds.length;
        emojis.set(
          reaction.emoji,
          (emojis.get(reaction.emoji) ?? 0) + reaction.userIds.length
        );
      }
    }

    // Hour of day in Madrid (UTC+2 all September), to find when the feed was loudest.
    const byHour = Array.from({ length: FEED_HOURS }, () => 0);
    for (const post of posts) {
      const hour = new Date(post.createdAt + 2 * 3_600_000).getUTCHours();
      byHour[hour] = (byHour[hour] ?? 0) + 1;
    }

    return {
      feed: {
        authors: new Set(posts.map((post) => post.authorId).filter(Boolean)).size,
        byHour,
        comments,
        emojis: [...emojis]
          .toSorted((a, b) => b[1] - a[1])
          .slice(0, TOP_EMOJIS)
          .map(([emoji, count]) => ({ count, emoji })),
        images: posts.filter((post) => post.imageId).length,
        memes: posts.filter((post) => post.meme).length,
        posts: posts.length,
        reactions,
      },
      milestones: milestones.length,
      people: {
        checkedIn: passes.filter((pass) => pass.checkedInAt !== undefined).length,
        inTeams: members.length,
      },
      submissions: {
        byTrack: tracks
          .filter((track) => track.active)
          .toSorted((a, b) => a.sortOrder - b.sortOrder)
          .map((track) => ({
            count: perTrack.get(track._id) ?? 0,
            label: track.label,
          })),
        total: submissions.length,
      },
      teams: teams.filter((team) => teamsWithMembers.has(team._id)).length,
    };
  },
  returns: v.object({
    feed: v.object({
      authors: v.number(),
      byHour: v.array(v.number()),
      comments: v.number(),
      emojis: v.array(v.object({ count: v.number(), emoji: v.string() })),
      images: v.number(),
      memes: v.number(),
      posts: v.number(),
      reactions: v.number(),
    }),
    milestones: v.number(),
    people: v.object({ checkedIn: v.number(), inTeams: v.number() }),
    submissions: v.object({
      byTrack: v.array(v.object({ count: v.number(), label: v.string() })),
      total: v.number(),
    }),
    teams: v.number(),
  }),
});
