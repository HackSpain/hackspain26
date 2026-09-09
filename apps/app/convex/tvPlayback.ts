import { v } from "convex/values";
import type { Infer } from "convex/values";
import { api } from "./_generated/api";
import { query } from "./_generated/server";
import { adminMutation } from "./lib/customFunctions";
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
