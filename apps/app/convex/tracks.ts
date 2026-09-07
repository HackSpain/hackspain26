import { v } from "convex/values";
import {
  adminMutation,
  adminQuery,
  onboardedMutation,
  onboardedQuery,
} from "./lib/customFunctions";
import { internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const HACKATHON_SETTINGS_KEY = "hackathon";

const DEFAULT_TRACKS = [
  {
    body: "Construye «Digital Workers»: agentes de IA auditables que automatizan procesos completos en banca, seguros e industria. Cerró 25M$ liderados por Creandum y Forgepoint para atacar el 95% de proyectos de IA empresarial que fracasan.",
    label: "Maisa",
    note: "Agentes de IA con trazabilidad para la empresa",
    slug: "maisa",
    sortOrder: 0,
  },
  {
    body: "Agentes de IA que ejecutan operaciones completas por voz, email, chat y sistemas empresariales. Con más de 150 grandes clientes y un crecimiento de 5× desde su Serie B, levantó una Serie C de 150M$ que la valora en 1.200M$.",
    label: "HappyRobot",
    note: "El sistema operativo de IA de la economía real",
    slug: "happyrobot",
    sortOrder: 1,
  },
  {
    body: "Automatiza de punta a punta el recorrido del paciente en clínicas de EE. UU.: citas, verificación de seguros y facturación. Gestiona flujos de más de 150.000 médicos y levantó 30M$ liderados por a16z.",
    label: "Prosper AI",
    note: "IA para las operaciones sanitarias",
    slug: "prosper-ai",
    sortOrder: 2,
  },
  {
    body: "Tesorería en tiempo real con IA para equipos financieros de medianas y grandes empresas. Automatiza hasta el 80% del trabajo manual, con 400 clientes en Europa y una Serie B de 30M€ liderada por Cathay Innovation.",
    label: "Embat",
    note: "El sistema operativo de la tesorería europea",
    slug: "embat",
    sortOrder: 3,
  },
  {
    body: "Robots industriales reconfigurables, entrenados con IA para no especializarse en una sola tarea. Desde Barcelona, con la mayor Serie A de robótica de Europa: más de 100M$ liderados por CRV, con Samsung, LVMH e Inditex dentro.",
    label: "THEKER Robotics",
    note: "Robótica de propósito general made in Spain",
    slug: "theker",
    sortOrder: 4,
  },
] as const;

const RETIRED_SLUGS = ["ml", "non-tech"] as const;

const trackReturn = v.object({
  _id: v.id("tracks"),
  active: v.boolean(),
  body: v.string(),
  label: v.string(),
  note: v.string(),
  slug: v.string(),
  sortOrder: v.number(),
});

function trackFields(track: Doc<"tracks">) {
  return {
    _id: track._id,
    active: track.active,
    body: track.body,
    label: track.label,
    note: track.note,
    slug: track.slug,
    sortOrder: track.sortOrder,
  };
}

async function settingsDoc(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", HACKATHON_SETTINGS_KEY))
    .unique();
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
        note: track.note,
        sortOrder: track.sortOrder,
      });
      continue;
    }
    await ctx.db.insert("tracks", {
      active: true,
      body: track.body,
      label: track.label,
      note: track.note,
      slug: track.slug,
      sortOrder: track.sortOrder,
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

export const list = onboardedQuery({
  args: {},
  handler: async (ctx) => {
    const tracks = await ctx.db
      .query("tracks")
      .withIndex("by_active_and_sort", (q) => q.eq("active", true))
      .collect();
    return tracks
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map(trackFields);
  },
  returns: v.array(trackReturn),
});

export const settings = onboardedQuery({
  args: {},
  handler: async (ctx) => ({
    submissionsOpen: await submissionsAreOpen(ctx),
  }),
  returns: v.object({ submissionsOpen: v.boolean() }),
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
  }),
  returns: v.object({ submissionsOpen: v.boolean() }),
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
    note: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    trackId: v.id("tracks"),
  },
  handler: async (ctx, args) => {
    const track = await ctx.db.get(args.trackId);
    if (!track) {
      throw new Error("Reto no encontrado");
    }
    const patch: {
      label?: string;
      body?: string;
      note?: string;
      active?: boolean;
      sortOrder?: number;
    } = {};
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
