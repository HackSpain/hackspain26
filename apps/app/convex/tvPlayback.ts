import { v } from "convex/values";
import type { Infer } from "convex/values";
import { api } from "./_generated/api";
import { query } from "./_generated/server";
import { adminMutation } from "./lib/customFunctions";
import { getEventWindow } from "./lib/eventWindow";
import { messageReturn, widgetReturn } from "./tv";

export const snapshotValidator = v.object({
  widgets: v.array(widgetReturn),
  messages: v.array(messageReturn),
  reloadVersion: v.number(),
});
export type TvSnapshot = Infer<typeof snapshotValidator>;

// Reuse Leo's public projections and publishing semantics, not another layout model.
export const snapshot = query({
  args: {},
  returns: snapshotValidator,
  handler: async (ctx): Promise<TvSnapshot> => {
    const [widgets, messages, control] = await Promise.all([
      ctx.runQuery(api.tv.listWidgets, {}),
      ctx.runQuery(api.tv.list, {}),
      ctx.db
        .query("tvPlaybackControl")
        .withIndex("by_key", (q) => q.eq("key", "main"))
        .unique(),
    ]);
    return { widgets, messages, reloadVersion: control?.reloadVersion ?? 0 };
  },
});

export const reload = adminMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("tvPlaybackControl")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    if (row) {
      await ctx.db.patch(row._id, { reloadVersion: row.reloadVersion + 1 });
    } else {
      await ctx.db.insert("tvPlaybackControl", {
        key: "main",
        reloadVersion: 1,
      });
    }
    return null;
  },
});

/** The TV charts split the hackathon into this many equal buckets. */
export const INSIGHT_BUCKETS = 24;

/**
 * What the TV's insight boxes need from Convex, next to the AI usage that
 * /api/tv/insights reads from RawTree: the hackathon window, the teams as
 * the leaderboard names them, and GitHub activity per team and bucket.
 * Public like the rest of the TV: only what the screens already show.
 */
export const insightsBase = query({
  args: {},
  handler: async (ctx) => {
    const window = await getEventWindow(ctx);
    const teams = await ctx.db.query("teams").collect();
    const rows = await Promise.all(
      teams.map(async (team) => {
        const [submission, members] = await Promise.all([
          ctx.db
            .query("submissions")
            .withIndex("by_team", (q) => q.eq("teamId", team._id))
            .first(),
          ctx.db
            .query("teamMembers")
            .withIndex("by_team", (q) => q.eq("teamId", team._id))
            .collect(),
        ]);
        return {
          id: team._id,
          members: members.filter((member) => member.status === "member")
            .length,
          name: team.name,
          project: submission?.name ?? "",
        };
      })
    );

    const activity = new Map<
      string,
      { teamId: string; bucket: number; pushes: number; pullRequests: number }
    >();
    const { startsAt, endsAt } = window;
    if (startsAt !== undefined && endsAt !== undefined && endsAt > startsAt) {
      const bucketMs = (endsAt - startsAt) / INSIGHT_BUCKETS;
      const posts = await ctx.db
        .query("posts")
        .withIndex("by_created", (q) =>
          q.gte("createdAt", startsAt).lt("createdAt", endsAt)
        )
        .collect();
      for (const post of posts) {
        if (post.kind !== "github" || !post.teamId || !post.github) {
          continue;
        }
        const push = post.github.event === "PushEvent";
        const pullRequest = post.github.event === "PullRequestEvent";
        if (!(push || pullRequest)) {
          continue;
        }
        const bucket = Math.floor((post.createdAt - startsAt) / bucketMs);
        const key = `${post.teamId}:${bucket}`;
        const row = activity.get(key) ?? {
          bucket,
          pullRequests: 0,
          pushes: 0,
          teamId: post.teamId,
        };
        row.pushes += push ? 1 : 0;
        row.pullRequests += pullRequest ? 1 : 0;
        activity.set(key, row);
      }
    }
    return { activity: [...activity.values()], teams: rows, window };
  },
  returns: v.object({
    activity: v.array(
      v.object({
        bucket: v.number(),
        pullRequests: v.number(),
        pushes: v.number(),
        teamId: v.string(),
      })
    ),
    teams: v.array(
      v.object({
        id: v.string(),
        members: v.number(),
        name: v.string(),
        project: v.string(),
      })
    ),
    window: v.object({
      endsAt: v.optional(v.number()),
      startsAt: v.optional(v.number()),
    }),
  }),
});
