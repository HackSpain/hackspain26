import { v } from "convex/values";
import {
  adminMutation,
  adminQuery,
  onboardedMutation,
  tracksQuery,
} from "./lib/customFunctions";
import { internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { currentEditionId, ofEdition, resolveEditionId } from "./lib/editions";
import {
  MAX_TEAMS_PER_TRACK,
  seedDefaults,
  submissionsAreOpen,
  trackEntryCounts,
} from "./lib/tracks";

/** Absolute http(s) URL or a site-relative path; empty clears the field. */
function parseBrandUrl(raw: string, what: string): string | undefined {
  const value = raw.trim();
  if (!value) {
    return undefined;
  }
  if (value.startsWith("/") || /^https?:\/\//.test(value)) {
    return value;
  }
  throw new Error(
    `${what} debe ser una URL https:// o una ruta que empiece por /`
  );
}

const trackReturn = v.object({
  _id: v.id("tracks"),
  active: v.boolean(),
  body: v.string(),
  label: v.string(),
  logoUrl: v.optional(v.string()),
  markdown: v.optional(v.string()),
  note: v.string(),
  slug: v.string(),
  sortOrder: v.number(),
  website: v.optional(v.string()),
});

function trackFields(track: Doc<"tracks">) {
  return {
    _id: track._id,
    active: track.active,
    body: track.body,
    label: track.label,
    logoUrl: track.logoUrl,
    markdown: track.markdown,
    note: track.note,
    slug: track.slug,
    sortOrder: track.sortOrder,
    website: track.website,
  };
}

export const list = tracksQuery({
  args: {},
  handler: async (ctx) => {
    const [tracks, counts] = await Promise.all([
      ctx.db
        .query("tracks")
        .withIndex("by_active_and_sort", (q) => q.eq("active", true))
        .collect(),
      trackEntryCounts(ctx),
    ]);
    const editionId = await currentEditionId(ctx);
    return ofEdition(tracks, editionId)
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map((track) => ({
        ...trackFields(track),
        teamCount: counts.get(track._id) ?? 0,
        teamLimit: MAX_TEAMS_PER_TRACK,
      }));
  },
  returns: v.array(
    v.object({
      ...trackReturn.fields,
      teamCount: v.number(),
      teamLimit: v.number(),
    })
  ),
});

export const get = tracksQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const editionId = await currentEditionId(ctx);
    const track = await ctx.db
      .query("tracks")
      .withIndex("by_edition_slug", (q) =>
        q.eq("editionId", editionId).eq("slug", args.slug)
      )
      .unique();
    if (!track?.active) {
      return null;
    }
    return trackFields(track);
  },
  returns: v.union(trackReturn, v.null()),
});

const settingsReturn = v.object({
  submissionsOpen: v.boolean(),
  teamLimit: v.number(),
});

export const settings = tracksQuery({
  args: {},
  handler: async (ctx) => ({
    submissionsOpen: await submissionsAreOpen(ctx),
    teamLimit: MAX_TEAMS_PER_TRACK,
  }),
  returns: settingsReturn,
});

export const adminList = adminQuery({
  args: { editionId: v.optional(v.id("editions")) },
  handler: async (ctx, args) => {
    const editionId = await resolveEditionId(ctx, args.editionId);
    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_edition", (q) => q.eq("editionId", editionId))
      .collect();
    return tracks
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map(trackFields);
  },
  returns: v.array(trackReturn),
});

export const adminSettings = adminQuery({
  args: {},
  handler: async (ctx) => ({
    submissionsOpen: await submissionsAreOpen(ctx),
    teamLimit: MAX_TEAMS_PER_TRACK,
  }),
  returns: settingsReturn,
});

export const adminEnsureDefaults = adminMutation({
  args: {},
  handler: async (ctx) => {
    await seedDefaults(ctx);
    return null;
  },
  returns: v.null(),
});

// Self-heal for an empty or placeholder catalog from the tracks page. Fill
// only: a participant must never reset what an admin changed.
export const ensureCatalog = onboardedMutation({
  args: {},
  handler: async (ctx) => {
    await seedDefaults(ctx, "fill");
    return null;
  },
  returns: v.null(),
});

export const syncOfficialTracks = internalMutation({
  args: {},
  handler: async (ctx) => {
    await seedDefaults(ctx);
    return null;
  },
  returns: v.null(),
});

export const adminUpdate = adminMutation({
  args: {
    active: v.optional(v.boolean()),
    body: v.optional(v.string()),
    label: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    markdown: v.optional(v.string()),
    note: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    trackId: v.id("tracks"),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const track = await ctx.db.get(args.trackId);
    if (!track) {
      throw new Error("Reto no encontrado");
    }
    const patch: {
      label?: string;
      body?: string;
      markdown?: string;
      note?: string;
      active?: boolean;
      sortOrder?: number;
      logoUrl?: string;
      website?: string;
    } = {};
    if (args.logoUrl !== undefined) {
      patch.logoUrl = parseBrandUrl(args.logoUrl, "El logo");
    }
    if (args.website !== undefined) {
      patch.website = parseBrandUrl(args.website, "La web");
    }
    if (args.label !== undefined) {
      const label = args.label.trim();
      if (!label) {
        throw new Error("El nombre es obligatorio");
      }
      patch.label = label;
    }
    if (args.body !== undefined) {
      patch.body = args.body.trim();
    }
    if (args.markdown !== undefined) {
      patch.markdown = args.markdown.trim();
    }
    if (args.note !== undefined) {
      patch.note = args.note.trim();
    }
    if (args.active !== undefined) {
      patch.active = args.active;
    }
    if (args.sortOrder !== undefined) {
      patch.sortOrder = args.sortOrder;
    }
    await ctx.db.patch(track._id, patch);
    return null;
  },
  returns: v.null(),
});
