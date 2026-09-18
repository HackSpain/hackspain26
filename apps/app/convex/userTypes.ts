import { v } from "convex/values";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import {
  isHackerType,
  JURADO_SECTIONS,
  MENTOR_SECTIONS,
  normalizeSections,
  PARTICIPANT_SECTIONS,
  sectionsValidator,
  slugify,
  SPONSOR_SECTIONS,
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
    throw new Error(`La descripción no puede superar ${MAX_DESCRIPTION} caracteres`);
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
  fields: Pick<Doc<"userTypes">, "label" | "description" | "sections" | "isDefault">
): Promise<Id<"userTypes">> {
  const slug = slugify(fields.label);
  const existing = await ctx.db
    .query("userTypes")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (existing) {
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
 * Idempotent bootstrap: seeds Hacker / Jurado / Mentor / Sponsor the first
 * time, strips the directory from an existing Hacker type (hackers browse
 * via staff), and moves anyone still carrying the legacy `judge` role onto
 * "Jurado". Admin pages call it on load, so it also serves as the migration.
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
        sections: PARTICIPANT_SECTIONS,
      });
    }
    const legacyJudges = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "judge"))
      .collect();
    const juradoId = await seedType(ctx, ctx.user._id, {
      description: "Puntúa proyectos en el panel del jurado.",
      isDefault: false,
      label: "Jurado",
      sections: JURADO_SECTIONS,
    });
    await seedType(ctx, ctx.user._id, {
      description: "Acompaña a los equipos durante el evento.",
      isDefault: false,
      label: "Mentor",
      sections: MENTOR_SECTIONS,
    });
    await seedType(ctx, ctx.user._id, {
      description: "Partner del evento: retos y perks.",
      isDefault: false,
      label: "Sponsor",
      sections: SPONSOR_SECTIONS,
    });
    if (legacyJudges.length > 0) {
      for (const user of legacyJudges) {
        await ctx.db.patch(user._id, {
          role: "user",
          userTypeId: user.userTypeId ?? juradoId,
        });
      }
    }
    const now = Date.now();
    for (const row of await allTypes(ctx)) {
      if (!isHackerType(row) || !row.sections.includes("participantes")) {
        continue;
      }
      await ctx.db.patch(row._id, {
        sections: normalizeSections(
          row.sections.filter((section) => section !== "participantes")
        ),
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
      const users = await ctx.db
        .query("users")
        .withIndex("by_user_type", (q) => q.eq("userTypeId", row._id))
        .collect();
      out.push({ ...summary(row), userCount: users.length });
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
  args: { direction: v.union(v.literal("up"), v.literal("down")), typeId: v.id("userTypes") },
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
    const users = await ctx.db
      .query("users")
      .withIndex("by_user_type", (q) => q.eq("userTypeId", row._id))
      .collect();
    for (const user of users) {
      await ctx.db.patch(user._id, { userTypeId: undefined });
    }
    await ctx.db.delete(row._id);
    return null;
  },
  returns: v.null(),
});
