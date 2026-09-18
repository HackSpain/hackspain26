import { v } from "convex/values";
import type { Infer } from "convex/values";
import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import { messageReturn, widgetReturn } from "./tv";
import { screenConfig, screenConfigValidator, screenKey, screenPresetValidator } from "./lib/tvScreens";

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
