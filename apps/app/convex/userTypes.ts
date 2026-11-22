import { v } from "convex/values";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import {
  defaultUserType,
  normalizeSections,
  PARTICIPANT_SECTIONS,
  sectionsValidator,
  slugify,
  typeOpenForApplications,
  typeRequiresConfirmed,
  userTypeSummaryValidator,
} from "./lib/userTypes";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const MAX_LABEL = 40;
const MAX_DESCRIPTION = 200;

function summary(row: Doc<"userTypes">) {
  return {
    _id: row._id,
    description: row.description,
    isDefault: row.isDefault,
    label: row.label,
    openForApplications: typeOpenForApplications(row),
    requiresConfirmed: typeRequiresConfirmed(row),
    sections: normalizeSections(row.sections),
    slug: row.slug,
    sortOrder: row.sortOrder,
  };
}

async function allTypes(ctx: QueryCtx | MutationCtx) {
  return await ctx.db.query("userTypes").withIndex("by_sort").collect();
}

function parseLabel(raw: string): string {
  const label = raw.trim().replaceAll(/\s+/g, " ");
  if (label.length < 2 || label.length > MAX_LABEL) {
    throw new Error(`El nombre debe tener entre 2 y ${MAX_LABEL} caracteres`);
  }
  return label;
}

function parseDescription(raw: string | undefined): string | undefined {
  const description = raw?.trim();
  if (!description) {
    return undefined;
  }
  if (description.length > MAX_DESCRIPTION) {
    throw new Error(
      `La descripción no puede superar ${MAX_DESCRIPTION} caracteres`
    );
  }
  return description;
}

async function uniqueSlug(
  ctx: MutationCtx,
  label: string,
  keep?: Id<"userTypes">
): Promise<string> {
  const base = slugify(label) || "tipo";
  const taken = new Set(
    (await ctx.db.query("userTypes").collect())
      .filter((row) => row._id !== keep)
      .map((row) => row.slug)
  );
  if (!taken.has(base)) {
    return base;
  }
  let n = 2;
  while (taken.has(`${base}-${n}`)) {
    n += 1;
  }
  return `${base}-${n}`;
}

async function clearDefault(ctx: MutationCtx, except?: Id<"userTypes">) {
  const rows = await ctx.db
    .query("userTypes")
    .withIndex("by_default", (q) => q.eq("isDefault", true))
    .collect();
  for (const row of rows) {
    if (row._id !== except) {
      await ctx.db.patch(row._id, { isDefault: false });
    }
  }
}

async function seedType(
  ctx: MutationCtx,
  adminId: Id<"users">,
  fields: Pick<
    Doc<"userTypes">,
    | "label"
    | "description"
    | "sections"
    | "isDefault"
    | "openForApplications"
    | "requiresConfirmed"
  >
): Promise<Id<"userTypes">> {
  const slug = slugify(fields.label);
  const existing = await ctx.db
    .query("userTypes")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (existing) {
    const patch: Partial<Doc<"userTypes">> = {};
    if (existing.requiresConfirmed === undefined) {
      patch.requiresConfirmed = fields.requiresConfirmed;
    }
    if (existing.openForApplications === undefined) {
      patch.openForApplications = fields.openForApplications;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(existing._id, { ...patch, updatedAt: Date.now() });
    }
    return existing._id;
  }
  const rows = await allTypes(ctx);
  const now = Date.now();
  return await ctx.db.insert("userTypes", {
    ...fields,
    createdAt: now,
    createdBy: adminId,
    slug,
    sortOrder: (rows.at(-1)?.sortOrder ?? -1) + 1,
    updatedAt: now,
  });
}

/**
 * Idempotent bootstrap: seeds "Hacker" (default) and "Jurado" the first time,
 * and moves anyone still carrying the legacy `judge` role onto "Jurado".
 * Admin pages call it on load, so it also serves as the migration.
 */
export const ensureDefaults = adminMutation({
  args: {},
  handler: async (ctx) => {
    const before = await allTypes(ctx);
    if (before.length === 0) {
      await seedType(ctx, ctx.user._id, {
        description: "Participa en la hackathon.",
        isDefault: true,
        label: "Hacker",
        openForApplications: true,
        requiresConfirmed: true,
        sections: PARTICIPANT_SECTIONS,
      });
    }
    const legacyJudges = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "judge"))
      .collect();
    if (before.length === 0 || legacyJudges.length > 0) {
      await seedType(ctx, ctx.user._id, {
        description: "Puntúa proyectos en el panel del jurado.",
        isDefault: false,
        label: "Jurado",
        openForApplications: false,
        requiresConfirmed: false,
        sections: ["judging", "judgingSponsors", "participantes"],
      });
      for (const user of legacyJudges) {
        await ctx.db.patch(user._id, { role: "user" });
      }
    }
    await seedType(ctx, ctx.user._id, {
      description: "Partner del evento: ve las entregas.",
      isDefault: false,
      label: "Sponsor",
      openForApplications: true,
      requiresConfirmed: false,
      sections: ["judgingSponsors", "participantes"],
    });
    await seedType(ctx, ctx.user._id, {
      description: "Acompaña a los equipos durante el evento.",
      isDefault: false,
      label: "Mentor",
      openForApplications: true,
      requiresConfirmed: false,
      sections: ["tracks", "participantes"],
    });
    const now = Date.now();
    for (const row of await allTypes(ctx)) {
      if (
        row.requiresConfirmed !== undefined &&
        row.openForApplications !== undefined
      ) {
        continue;
      }
      await ctx.db.patch(row._id, {
        openForApplications: row.openForApplications ?? !row.isDefault,
        requiresConfirmed: row.requiresConfirmed ?? row.isDefault,
        updatedAt: now,
      });
    }
    return { migratedJudges: legacyJudges.length };
  },
  returns: v.object({ migratedJudges: v.number() }),
});

/** Every type with how many users carry it, in display order. */
export const list = adminQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await allTypes(ctx);
    const out = [];
    for (const row of rows) {
      const assigned = await ctx.db
        .query("participations")
        .withIndex("by_role", (q) => q.eq("roleId", row._id))
        .collect();
      out.push({ ...summary(row), userCount: assigned.length });
    }
    return out;
  },
  returns: v.array(
    v.object({ ...userTypeSummaryValidator.fields, userCount: v.number() })
  ),
});

export const create = adminMutation({
  args: {
    description: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    label: v.string(),
    openForApplications: v.optional(v.boolean()),
    requiresConfirmed: v.optional(v.boolean()),
    sections: sectionsValidator,
  },
  handler: async (ctx, args) => {
    const label = parseLabel(args.label);
    const existing = await allTypes(ctx);
    const isDefault = args.isDefault === true;
    if (isDefault) {
      await clearDefault(ctx);
    }
    const now = Date.now();
    return await ctx.db.insert("userTypes", {
      createdAt: now,
      createdBy: ctx.user._id,
      description: parseDescription(args.description),
      isDefault,
      label,
      openForApplications: args.openForApplications === true,
      requiresConfirmed: args.requiresConfirmed !== false,
      sections: normalizeSections(args.sections),
      slug: await uniqueSlug(ctx, label),
      sortOrder: (existing.at(-1)?.sortOrder ?? -1) + 1,
      updatedAt: now,
    });
  },
  returns: v.id("userTypes"),
});

export const update = adminMutation({
  args: {
    description: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    label: v.optional(v.string()),
    openForApplications: v.optional(v.boolean()),
    requiresConfirmed: v.optional(v.boolean()),
    sections: v.optional(sectionsValidator),
    typeId: v.id("userTypes"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.typeId);
    if (!row) {
      throw new Error("Tipo no encontrado");
    }
    const patch: Partial<Doc<"userTypes">> = { updatedAt: Date.now() };
    if (args.label !== undefined) {
      patch.label = parseLabel(args.label);
      patch.slug = await uniqueSlug(ctx, patch.label, row._id);
    }
    if (args.description !== undefined) {
      patch.description = parseDescription(args.description);
    }
    if (args.sections !== undefined) {
      patch.sections = normalizeSections(args.sections);
    }
    if (args.openForApplications !== undefined) {
      patch.openForApplications = args.openForApplications;
    }
    if (args.requiresConfirmed !== undefined) {
      patch.requiresConfirmed = args.requiresConfirmed;
    }
    if (args.isDefault !== undefined) {
      patch.isDefault = args.isDefault;
      if (args.isDefault) {
        await clearDefault(ctx, row._id);
      }
    }
    await ctx.db.patch(row._id, patch);
    return null;
  },
  returns: v.null(),
});

export const move = adminMutation({
  args: {
    direction: v.union(v.literal("up"), v.literal("down")),
    typeId: v.id("userTypes"),
  },
  handler: async (ctx, args) => {
    const rows = await allTypes(ctx);
    const index = rows.findIndex((row) => row._id === args.typeId);
    if (index === -1) {
      throw new Error("Tipo no encontrado");
    }
    const target = args.direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= rows.length) {
      return null;
    }
    const ordered = [...rows];
    const moving = ordered[index];
    const other = ordered[target];
    if (!moving || !other) {
      return null;
    }
    ordered[index] = other;
    ordered[target] = moving;
    for (const [position, row] of ordered.entries()) {
      if (row.sortOrder !== position) {
        await ctx.db.patch(row._id, { sortOrder: position });
      }
    }
    return null;
  },
  returns: v.null(),
});

/** Deleting a type sends its users back to the default type (or role-based visibility). */
export const remove = adminMutation({
  args: { typeId: v.id("userTypes") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.typeId);
    if (!row) {
      return null;
    }
    const hacker =
      (await ctx.db
        .query("userTypes")
        .withIndex("by_slug", (q) => q.eq("slug", "hacker"))
        .unique()) ?? (await defaultUserType(ctx));
    if (!hacker || hacker._id === row._id) {
      throw new Error("No se puede borrar el rol por defecto");
    }
    const assigned = await ctx.db
      .query("participations")
      .withIndex("by_role", (q) => q.eq("roleId", row._id))
      .collect();
    for (const participation of assigned) {
      await ctx.db.patch(participation._id, { roleId: hacker._id });
    }
    await ctx.db.delete(row._id);
    return null;
  },
  returns: v.null(),
});
