import { v } from "convex/values";
import { adminMutation, onboardedQuery } from "./lib/customFunctions";
import { getSignupForUser } from "./lib/auth";

const SETTINGS_KEY = "main";

export const eventPhaseValidator = v.union(
  v.literal("pre_event"),
  v.literal("live"),
  v.literal("ended"),
);

export const status = onboardedQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("eventSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();
    const phase = settings?.phase ?? "pre_event";
    if (ctx.user.role === "admin") {
      return {
        checkedInAt: undefined,
        phase,
        unlocked: true,
      };
    }
    const signup = await getSignupForUser(ctx, ctx.user);
    const pass =
      (signup
        ? await ctx.db
            .query("eventPasses")
            .withIndex("by_signup", (q) => q.eq("signupId", signup._id))
            .unique()
        : null) ??
      (await ctx.db
        .query("eventPasses")
        .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
        .unique());
    const checkedInAt = pass?.status === "active" ? pass.checkedInAt : undefined;
    return {
      checkedInAt,
      phase,
      unlocked: phase !== "pre_event" && checkedInAt !== undefined,
    };
  },
  returns: v.object({
    checkedInAt: v.optional(v.number()),
    phase: eventPhaseValidator,
    unlocked: v.boolean(),
  }),
});

export const setPhase = adminMutation({
  args: { phase: eventPhaseValidator },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("eventSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();
    const value = {
      phase: args.phase,
      updatedAt: Date.now(),
      updatedBy: ctx.user._id,
    };
    if (existing) {
      await ctx.db.patch(existing._id, value);
    } else {
      await ctx.db.insert("eventSettings", { key: SETTINGS_KEY, ...value });
    }
    return null;
  },
  returns: v.null(),
});
