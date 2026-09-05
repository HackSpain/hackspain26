import { v } from "convex/values";
import { onboardedMutation, onboardedQuery } from "./lib/customFunctions";
import { fail } from "./lib/errors";
import { membershipForUser } from "./lib/team";
import { milestoneKindValidator } from "./lib/validators";

const MAX_LABEL_LENGTH = 120;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const milestoneReturn = v.object({
  _id: v.id("milestones"),
  teamId: v.id("teams"),
  teamName: v.string(),
  kind: milestoneKindValidator,
  label: v.optional(v.string()),
  at: v.number(),
  byEmail: v.optional(v.string()),
});

export const add = onboardedMutation({
  args: {
    kind: milestoneKindValidator,
    label: v.optional(v.string()),
    at: v.optional(v.number()),
  },
  returns: v.id("milestones"),
  handler: async (ctx, args) => {
    const membership = await membershipForUser(ctx, ctx.user._id);
    if (!membership) fail("NO_TEAM", "Necesitas un equipo para registrar hitos");

    const label = args.label?.trim();
    if (args.kind === "custom" && !label) {
      fail("VALIDATION", "Un hito personalizado necesita una descripción");
    }
    if (label && label.length > MAX_LABEL_LENGTH) {
      fail("VALIDATION", `La descripción no puede superar ${MAX_LABEL_LENGTH} caracteres`);
    }

    const now = Date.now();
    const at = args.at ?? now;
    if (!Number.isFinite(at) || at > now + FUTURE_TOLERANCE_MS) {
      fail("VALIDATION", "La fecha del hito no puede estar en el futuro");
    }

    if (args.kind !== "custom") {
      const existing = await ctx.db
        .query("milestones")
        .withIndex("by_team", (q) => q.eq("teamId", membership.teamId))
        .collect();
      if (existing.some((row) => row.kind === args.kind)) {
        fail("VALIDATION", "Ese hito ya está registrado para tu equipo");
      }
    }

    return await ctx.db.insert("milestones", {
      teamId: membership.teamId,
      userId: ctx.user._id,
      kind: args.kind,
      label: label || undefined,
      at,
      createdAt: now,
    });
  },
});

export const mine = onboardedQuery({
  args: {},
  returns: v.array(milestoneReturn),
  handler: async (ctx) => {
    const membership = await membershipForUser(ctx, ctx.user._id);
    if (!membership) return [];
    const team = await ctx.db.get(membership.teamId);
    if (!team) return [];
    const rows = await ctx.db
      .query("milestones")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();
    const result = [];
    for (const row of rows.sort((a, b) => a.at - b.at)) {
      const user = await ctx.db.get(row.userId);
      result.push({
        _id: row._id,
        teamId: row.teamId,
        teamName: team.name,
        kind: row.kind,
        label: row.label,
        at: row.at,
        byEmail: user?.email,
      });
    }
    return result;
  },
});

export const list = onboardedQuery({
  args: {},
  returns: v.array(milestoneReturn),
  handler: async (ctx) => {
    const rows = await ctx.db.query("milestones").withIndex("by_at").collect();
    const teamNames = new Map<string, string>();
    const result = [];
    for (const row of rows) {
      let teamName = teamNames.get(row.teamId);
      if (teamName === undefined) {
        const team = await ctx.db.get(row.teamId);
        teamName = team?.name ?? "";
        teamNames.set(row.teamId, teamName);
      }
      const user = await ctx.db.get(row.userId);
      result.push({
        _id: row._id,
        teamId: row.teamId,
        teamName,
        kind: row.kind,
        label: row.label,
        at: row.at,
        byEmail: user?.email,
      });
    }
    return result;
  },
});
