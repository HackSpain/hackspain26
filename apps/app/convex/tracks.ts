import { v } from "convex/values";
import {
  adminMutation,
  adminQuery,
  onboardedMutation,
  tracksQuery,
} from "./lib/customFunctions";
import { internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { HACKATHON_SETTINGS_KEY, settingsDoc } from "./lib/eventWindow";

const DEFAULT_TRACKS = [
  {
    body: "Construye «Digital Workers»: agentes de IA auditables que automatizan procesos completos en banca, seguros e industria. Cerró 25M$ liderados por Creandum y Forgepoint para atacar el 95% de proyectos de IA empresarial que fracasan.",
    label: "Maisa",
    note: "Agentes de IA con trazabilidad para la empresa",
    logoUrl: "/tracks/maisa.png",
    slug: "maisa",
    sortOrder: 0,
    website: "https://maisa.ai",
  },
  {
    body: "Agentes de IA que ejecutan operaciones completas por voz, email, chat y sistemas empresariales. Con más de 150 grandes clientes y un crecimiento de 5× desde su Serie B, levantó una Serie C de 150M$ que la valora en 1.200M$.",
    label: "HappyRobot",
    note: "El sistema operativo de IA de la economía real",
    logoUrl: "/tracks/happyrobot.png",
    slug: "happyrobot",
    sortOrder: 1,
    website: "https://www.happyrobot.ai",
  },
  {
    body: "Automatiza de punta a punta el recorrido del paciente en clínicas de EE. UU.: citas, verificación de seguros y facturación. Gestiona flujos de más de 150.000 médicos y levantó 30M$ liderados por a16z.",
    label: "Prosper AI",
    note: "IA para las operaciones sanitarias",
    logoUrl: "/tracks/prosper-ai.svg",
    slug: "prosper-ai",
    sortOrder: 2,
    website: "https://www.getprosper.ai",
  },
  {
    body: "Tesorería en tiempo real con IA para equipos financieros de medianas y grandes empresas. Automatiza hasta el 80% del trabajo manual, con 400 clientes en Europa y una Serie B de 30M€ liderada por Cathay Innovation.",
    label: "Embat",
    note: "El sistema operativo de la tesorería europea",
    logoUrl: "/tracks/embat.png",
    slug: "embat",
    sortOrder: 3,
    website: "https://www.embat.io",
  },
  {
    body: "Robots industriales reconfigurables, entrenados con IA para no especializarse en una sola tarea. Desde Barcelona, con la mayor Serie A de robótica de Europa: más de 100M$ liderados por CRV, con Samsung, LVMH e Inditex dentro.",
    label: "THEKER Robotics",
    note: "Robótica de propósito general made in Spain",
    logoUrl: "/tracks/theker.svg",
    slug: "theker",
    sortOrder: 4,
    website: "https://www.theker.ai",
  },
] as const;

const RETIRED_SLUGS = ["ml", "non-tech"] as const;
const THEKER_SLUG = "theker";

/** A project may enter one track, or THEKER together with one other track. */
export function isTrackCombinationAllowed(
  tracks: readonly { slug: string }[]
): boolean {
  return (
    tracks.length <= 1 ||
    (tracks.length === 2 &&
      tracks.filter((track) => track.slug === THEKER_SLUG).length === 1)
  );
}

/** Projects (team or solo, draft or submitted) one track takes. */
export const MAX_TEAMS_PER_TRACK = 15;

/** Absolute http(s) URL or a site-relative path; empty clears the field. */
function parseBrandUrl(raw: string, what: string): string | undefined {
  const value = raw.trim();
  if (!value) {
    return undefined;
  }
  if (value.startsWith("/") || /^https?:\/\//.test(value)) {
    return value;
  }
  throw new Error(`${what} debe ser una URL https:// o una ruta que empiece por /`);
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

/** How many projects have entered each track. */
export async function trackEntryCounts(
  ctx: QueryCtx | MutationCtx,
  exceptSubmissionId?: Id<"submissions">
): Promise<Map<Id<"tracks">, number>> {
  const counts = new Map<Id<"tracks">, number>();
  for (const submission of await ctx.db.query("submissions").collect()) {
    if (submission._id === exceptSubmissionId) {
      continue;
    }
    for (const trackId of new Set(submission.challengeIds)) {
      counts.set(trackId, (counts.get(trackId) ?? 0) + 1);
    }
  }
  return counts;
}

export async function submissionsAreOpen(
  ctx: QueryCtx | MutationCtx
): Promise<boolean> {
  const row = await settingsDoc(ctx);
  return row?.submissionsOpen ?? false;
}

export async function seedDefaults(ctx: MutationCtx): Promise<void> {
  for (const track of DEFAULT_TRACKS) {
    const existing = await ctx.db
      .query("tracks")
      .withIndex("by_slug", (q) => q.eq("slug", track.slug))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        active: true,
        body: track.body,
        label: track.label,
        // Branding only fills in when missing, so an admin-set logo survives.
        logoUrl: existing.logoUrl ?? track.logoUrl,
        note: track.note,
        sortOrder: track.sortOrder,
        website: existing.website ?? track.website,
      });
      continue;
    }
    await ctx.db.insert("tracks", {
      active: true,
      body: track.body,
      label: track.label,
      logoUrl: track.logoUrl,
      note: track.note,
      slug: track.slug,
      sortOrder: track.sortOrder,
      website: track.website,
    });
  }

  for (const slug of RETIRED_SLUGS) {
    const leftover = await ctx.db
      .query("tracks")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (leftover?.active) {
      await ctx.db.patch(leftover._id, { active: false });
    }
  }

  const settings = await settingsDoc(ctx);
  if (!settings) {
    await ctx.db.insert("settings", {
      key: HACKATHON_SETTINGS_KEY,
      submissionsOpen: false,
    });
  }
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
    return tracks
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
    const track = await ctx.db
      .query("tracks")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
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
  args: {},
  handler: async (ctx) => {
    const tracks = await ctx.db.query("tracks").collect();
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

export const ensureCatalog = onboardedMutation({
  args: {},
  handler: async (ctx) => {
    await seedDefaults(ctx);
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

export const adminSetSubmissionsOpen = adminMutation({
  args: { submissionsOpen: v.boolean() },
  handler: async (ctx, args) => {
    const row = await settingsDoc(ctx);
    if (row) {
      await ctx.db.patch(row._id, { submissionsOpen: args.submissionsOpen });
    } else {
      await ctx.db.insert("settings", {
        key: HACKATHON_SETTINGS_KEY,
        submissionsOpen: args.submissionsOpen,
      });
    }
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
