import { v } from "convex/values";
import type { Infer } from "convex/values";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getSignupForUser } from "./lib/auth";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import { getEventWindow } from "./lib/eventWindow";
import { GITHUB_FEED_EVENTS } from "./lib/github";
import { externalThumbnail } from "./lib/photo";
import { histogramReturn, stackHistogram } from "./stack";
import { messageReturn, widgetReturn } from "./tv";
import { SCREEN_OFFLINE_MS, screenConfig, screenConfigValidator, screenKey, screenPresetValidator } from "./lib/tvScreens";

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


// Only configuration changes invalidate this subscription; presence is a separate table.
export const screenConfiguration = query({
  args: { key: v.string() },
  returns: v.union(screenConfigValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.query("tvScreens").withIndex("by_key", (q) => q.eq("key", screenKey(args.key))).unique();
    return row ? screenConfig(row) : null;
  },
});

// Public kiosks can announce their presence, but cannot change an existing screen's commands.
export const heartbeat = mutation({
  args: {
    key: v.string(), clientId: v.string(), url: v.string(), initialPreset: screenPresetValidator,
    width: v.number(), height: v.number(), receivedRevision: v.number(), receivedReloadVersion: v.number(),
  },
  returns: screenConfigValidator,
  handler: async (ctx, args) => {
    const key = screenKey(args.key);
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(args.clientId)) { throw new Error("Identificador no válido"); }
    const url = new URL(args.url);
    if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/tv" || args.url.length > 1000) {
      throw new Error("URL de pantalla no válida");
    }
    // Only retain display parameters, never auth tokens or other query strings.
    const safeUrl = new URL("/tv", url.origin);
    safeUrl.searchParams.set("screen", key);
    if (url.searchParams.has("view")) { safeUrl.searchParams.set("view", args.initialPreset); }
    for (const value of [args.width, args.height, args.receivedRevision, args.receivedReloadVersion]) {
      if (!Number.isSafeInteger(value) || value < 0) { throw new Error("Estado de pantalla no válido"); }
    }
    if (args.width > 32_768 || args.height > 32_768) { throw new Error("Resolución no válida"); }
    let screen = await ctx.db.query("tvScreens").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (!screen) {
      const id = await ctx.db.insert("tvScreens", {
        key, preset: args.initialPreset, message: "", revision: 0, reloadVersion: 0,
      });
      screen = await ctx.db.get(id);
    }
    if (!screen) { throw new Error("Pantalla no disponible"); }
    const connection = await ctx.db.query("tvScreenConnections")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId)).unique();
    const fields = {
      screenId: screen._id, clientId: args.clientId, url: safeUrl.toString(),
      width: args.width, height: args.height, lastSeenAt: Date.now(),
      receivedRevision: args.receivedRevision, receivedReloadVersion: args.receivedReloadVersion,
    };
    if (connection) { await ctx.db.patch(connection._id, fields); }
    else { await ctx.db.insert("tvScreenConnections", fields); }
    // Each named screen keeps recent connections, including duplicate open tabs.
    const old = await ctx.db.query("tvScreenConnections").withIndex("by_screen", (q) => q.eq("screenId", screen._id)).collect();
    for (const row of old) {
      if (row.lastSeenAt < Date.now() - 86_400_000) { await ctx.db.delete(row._id); }
    }
    return screenConfig(screen);
  },
});

export const screens = adminQuery({
  args: {},
  handler: async (ctx) => {
    const [rows, connections] = await Promise.all([
      ctx.db.query("tvScreens").collect(), ctx.db.query("tvScreenConnections").collect(),
    ]);
    return {
      serverTime: Date.now(),
      screens: rows.toSorted((a, b) => a.key.localeCompare(b.key)).map((screen) => ({
        ...screen,
        connections: connections.filter((connection) => connection.screenId === screen._id)
          .toSorted((a, b) => b.lastSeenAt - a.lastSeenAt),
      })),
    };
  },
});

export const setScreen = adminMutation({
  args: { key: v.string(), preset: screenPresetValidator, message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = screenKey(args.key);
    const message = args.message.trim();
    if (message.length > 500) { throw new Error("El aviso admite hasta 500 caracteres"); }
    const screen = await ctx.db.query("tvScreens").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (screen) {
      await ctx.db.patch(screen._id, { preset: args.preset, message, revision: screen.revision + 1 });
    } else {
      await ctx.db.insert("tvScreens", { key, preset: args.preset, message, revision: 0, reloadVersion: 0 });
    }
    return null;
  },
});

export const reloadScreen = adminMutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const screen = await ctx.db.query("tvScreens").withIndex("by_key", (q) => q.eq("key", screenKey(args.key))).unique();
    if (!screen) { throw new Error("Pantalla no encontrada"); }
    await ctx.db.patch(screen._id, { reloadVersion: screen.reloadVersion + 1 });
    return null;
  },
});

export const removeScreen = adminMutation({
  args: { key: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const screen = await ctx.db.query("tvScreens").withIndex("by_key", (q) => q.eq("key", screenKey(args.key))).unique();
    if (!screen) { return null; }
    const connections = await ctx.db.query("tvScreenConnections").withIndex("by_screen", (q) => q.eq("screenId", screen._id)).collect();
    if (connections.some((connection) => Date.now() - connection.lastSeenAt < SCREEN_OFFLINE_MS)) {
      throw new Error("Desconecta la pantalla antes de borrarla");
    }
    for (const connection of connections) { await ctx.db.delete(connection._id); }
    await ctx.db.delete(screen._id);
    return null;
  },
});

/** The TV charts split the hackathon into this many equal buckets. */
export const INSIGHT_BUCKETS = 24;

export function githubActivityKind(
  event: string
): typeof GITHUB_FEED_EVENTS.push | typeof GITHUB_FEED_EVENTS.pullRequest | null {
  if (event === GITHUB_FEED_EVENTS.push) {
    return GITHUB_FEED_EVENTS.push;
  }
  if (event === GITHUB_FEED_EVENTS.pullRequest) {
    return GITHUB_FEED_EVENTS.pullRequest;
  }
  return null;
}

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
        // A storage URL, not /api/files: the screens have no session.
        const logoUrl = team.logoId
          ? await ctx.storage.getUrl(team.logoId)
          : null;
        return {
          id: team._id,
          ...(logoUrl ? { logoUrl } : {}),
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
    const actors = new Map<
      string,
      { login: string; teamId: string; pushes: number; pullRequests: number }
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
        const event = githubActivityKind(post.github.event);
        if (!event) {
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
        row.pushes += event === GITHUB_FEED_EVENTS.push ? 1 : 0;
        row.pullRequests += event === GITHUB_FEED_EVENTS.pullRequest ? 1 : 0;
        activity.set(key, row);
        // `users.githubUsername` is stored lowercase; GitHub logins are not.
        const login = post.github.actor?.toLowerCase();
        if (!login) {
          continue;
        }
        const actor = actors.get(login) ?? {
          login,
          pullRequests: 0,
          pushes: 0,
          teamId: post.teamId,
        };
        actor.pushes += event === GITHUB_FEED_EVENTS.push ? 1 : 0;
        actor.pullRequests += event === GITHUB_FEED_EVENTS.pullRequest ? 1 : 0;
        actors.set(login, actor);
      }
    }
    return {
      activity: [...activity.values()],
      actors: [...actors.values()],
      stacks: await stackHistogram(ctx),
      teams: rows,
      window,
    };
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
    /** GitHub activity per login over the window, as the feed already names it. */
    actors: v.array(
      v.object({
        login: v.string(),
        pullRequests: v.number(),
        pushes: v.number(),
        teamId: v.string(),
      })
    ),
    stacks: histogramReturn,
    teams: v.array(
      v.object({
        id: v.string(),
        logoUrl: v.optional(v.string()),
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

/** How many people the TV's individual ranking shows per metric. */
export const INSIGHT_PEOPLE = 8;

/**
 * Names for the individual ranking: the people /api/tv/insights picked by
 * tokens (user ids from telemetry) and by GitHub activity (logins from the
 * feed). Display name, photo, team and login only, like the feed and the team map.
 */
export const insightsPeople = query({
  args: { userIds: v.array(v.string()), logins: v.array(v.string()) },
  handler: async (ctx, args) => {
    const found = new Map<string, Doc<"users">>();
    for (const value of args.userIds.slice(0, INSIGHT_PEOPLE)) {
      const id = ctx.db.normalizeId("users", value);
      const user = id ? await ctx.db.get(id) : null;
      if (user) {
        found.set(user._id, user);
      }
    }
    for (const value of args.logins.slice(0, INSIGHT_PEOPLE)) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_github", (q) => q.eq("githubUsername", value.toLowerCase()))
        .first();
      if (user) {
        found.set(user._id, user);
      }
    }
    return await Promise.all(
      [...found.values()].map(async (user) => {
        const [signup, membership] = await Promise.all([
          getSignupForUser(ctx, user),
          ctx.db
            .query("teamMembers")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .first(),
        ]);
        const team =
          membership?.status === "member"
            ? await ctx.db.get(membership.teamId)
            : null;
        // Same photo as the team map: a storage URL, since the screens have no session.
        const photoId = user.avatarThumbId ?? user.avatarId;
        const photoUrl =
          (photoId ? await ctx.storage.getUrl(photoId) : null) ??
          (user.image ? externalThumbnail(user.image) : null);
        return {
          id: user._id as string,
          name: user.name || signup?.fullName || "Participante",
          ...(photoUrl ? { photoUrl } : {}),
          team: team?.name ?? "",
          ...(user.githubUsername ? { login: user.githubUsername } : {}),
        };
      })
    );
  },
  returns: v.array(
    v.object({
      id: v.string(),
      login: v.optional(v.string()),
      name: v.string(),
      photoUrl: v.optional(v.string()),
      team: v.string(),
    })
  ),
});
