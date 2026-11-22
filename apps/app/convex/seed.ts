/**
 * Development seed API. Implementation lives in `lib/seed.ts`.
 * Requires SEED_ALLOWED=true on the deployment; never run against production.
 */
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import {
  assertNotProduction,
  clearSeed,
  ORG_EMAIL,
  runSeed,
  seededUserIds,
} from "./lib/seed";

export const run = internalMutation({
  args: { reset: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    assertNotProduction();
    const cleared = args.reset ? await clearSeed(ctx) : {};
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", ORG_EMAIL))
      .unique();
    if (existing) {
      throw new Error(
        'The seed is already loaded. Run seed:run with {"reset":true} to reload it, or seed:clear to remove it.'
      );
    }
    const { created, incompleteProfiles } = await runSeed(ctx);
    await ctx.scheduler.runAfter(0, internal.seed.logos, {});
    return { cleared, created, incompleteProfiles };
  },
  returns: v.object({
    cleared: v.record(v.string(), v.number()),
    created: v.record(v.string(), v.number()),
    /** Seeded logins that still owe the onboarding wizard a step. */
    incompleteProfiles: v.array(v.string()),
  }),
});

export const clear = internalMutation({
  args: {},
  handler: async (ctx) => {
    assertNotProduction();
    return await clearSeed(ctx);
  },
  returns: v.record(v.string(), v.number()),
});

// ---------- team logos (storage needs an action) ----------

/** Seeded teams without a logo yet, or all of them when `force` is set. */
export const teamsForLogos = internalQuery({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const userIds = await seededUserIds(ctx);
    const teams = await ctx.db.query("teams").collect();
    return teams
      .filter((team) => userIds.has(team.ownerId))
      .filter((team) => args.force === true || team.logoId === undefined)
      .map((team) => ({ _id: team._id, name: team.name }));
  },
  returns: v.array(v.object({ _id: v.id("teams"), name: v.string() })),
});

export const attachLogo = internalMutation({
  args: { logoId: v.id("_storage"), teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      await ctx.storage.delete(args.logoId);
      return null;
    }
    const previous = team.logoId;
    await ctx.db.patch(team._id, {
      logoId: args.logoId,
      updatedAt: Date.now(),
    });
    if (previous && previous !== args.logoId) {
      await ctx.storage.delete(previous);
    }
    return null;
  },
  returns: v.null(),
});

/**
 * Downloads a generated PNG per seeded team (DiceBear "shapes", keyed by the
 * team name so it is stable) and stores it as the team logo. Runs after
 * `seed:run`; call it by hand with `{"force":true}` to regenerate.
 */
export const logos = internalAction({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    assertNotProduction();
    const teams = await ctx.runQuery(internal.seed.teamsForLogos, {
      force: args.force,
    });
    let stored = 0;
    const failed: string[] = [];
    for (const team of teams) {
      const url = `https://api.dicebear.com/9.x/shapes/png?size=256&seed=${encodeURIComponent(team.name)}`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          failed.push(`${team.name}: ${response.status}`);
          continue;
        }
        const blob = await response.blob();
        const logoId = await ctx.storage.store(
          new Blob([await blob.arrayBuffer()], { type: "image/png" })
        );
        await ctx.runMutation(internal.seed.attachLogo, {
          logoId,
          teamId: team._id,
        });
        stored += 1;
      } catch (caughtError: unknown) {
        failed.push(
          `${team.name}: ${caughtError instanceof Error ? caughtError.message : "error"}`
        );
      }
    }
    return { failed, stored };
  },
  returns: v.object({ failed: v.array(v.string()), stored: v.number() }),
});
