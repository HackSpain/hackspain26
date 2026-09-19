import { v } from "convex/values";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import { fail } from "./lib/errors";
import {
  eventPhase,
  eventPhaseValidator,
  getEventWindow,
  HACKATHON_SETTINGS_KEY,
  settingsDoc,
} from "./lib/eventWindow";

/**
 * Hackathon-wide switches edited on /admin/evento. The submission window
 * (`submissionsOpen`) lives next to these in tracks.ts.
 */
export const adminEventWindow = adminQuery({
  args: {},
  handler: async (ctx) => {
    const window = await getEventWindow(ctx);
    return {
      endsAt: window.endsAt,
      phase: eventPhase(window, Date.now()),
      startsAt: window.startsAt,
    };
  },
  returns: v.object({
    endsAt: v.optional(v.number()),
    phase: eventPhaseValidator,
    startsAt: v.optional(v.number()),
  }),
});

/** Both bounds, or none to lift the restriction. */
export const adminSetEventWindow = adminMutation({
  args: {
    endsAt: v.optional(v.number()),
    startsAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hasStart = args.startsAt !== undefined;
    const hasEnd = args.endsAt !== undefined;
    if (hasStart !== hasEnd) {
      fail("VALIDATION", "Indica el inicio y el fin, o deja los dos vacíos.");
    }
    if (
      args.startsAt !== undefined &&
      args.endsAt !== undefined &&
      args.startsAt >= args.endsAt
    ) {
      fail("VALIDATION", "El fin debe ser posterior al inicio.");
    }
    const patch = { eventEndsAt: args.endsAt, eventStartsAt: args.startsAt };
    const row = await settingsDoc(ctx);
    if (row) {
      await ctx.db.patch(row._id, patch);
    } else {
      await ctx.db.insert("settings", {
        key: HACKATHON_SETTINGS_KEY,
        submissionsOpen: false,
        ...patch,
      });
    }
    return null;
  },
  returns: v.null(),
});
