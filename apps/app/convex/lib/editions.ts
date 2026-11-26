import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { fail } from "./errors";

type Ctx = QueryCtx | MutationCtx;

export const EDITION_2026_SLUG = "2026";
export const EDITION_2027_SLUG = "2027";

export async function editionBySlug(
  ctx: Ctx,
  slug: string
): Promise<Doc<"editions"> | null> {
  return await ctx.db
    .query("editions")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

export async function currentEdition(ctx: Ctx): Promise<Doc<"editions">> {
  const row = await ctx.db
    .query("editions")
    .withIndex("by_current", (q) => q.eq("current", true))
    .unique();
  if (!row) {
    throw new Error("No hay una edición en curso");
  }
  return row;
}

export async function currentEditionId(ctx: Ctx): Promise<Id<"editions">> {
  return (await currentEdition(ctx))._id;
}

/**
 * Admin lists pass the switcher's edition. Missing or unknown falls back to
 * the current edition. Participant and CLI paths must keep using
 * `currentEdition` instead.
 */
export async function resolveEdition(
  ctx: Ctx,
  editionId?: Id<"editions">
): Promise<Doc<"editions">> {
  if (editionId) {
    const edition = await ctx.db.get(editionId);
    if (edition) {
      return edition;
    }
  }
  return await currentEdition(ctx);
}

export async function resolveEditionId(
  ctx: Ctx,
  editionId?: Id<"editions">
): Promise<Id<"editions">> {
  return (await resolveEdition(ctx, editionId))._id;
}

/** Creates (people, tracks, perks, teams) only on the current edition. */
export async function requireCurrentEdition(
  ctx: Ctx,
  editionId?: Id<"editions">
): Promise<Doc<"editions">> {
  const edition = await resolveEdition(ctx, editionId);
  const current = await currentEdition(ctx);
  if (edition._id !== current._id) {
    fail("VALIDATION", "Solo la edición en curso admite altas.");
  }
  return edition;
}

export function belongsToEdition(
  row: { editionId?: Id<"editions"> },
  editionId: Id<"editions">
): boolean {
  return row.editionId === editionId;
}

export function ofEdition<T extends { editionId?: Id<"editions"> }>(
  rows: T[],
  editionId: Id<"editions">
): T[] {
  return rows.filter((row) => belongsToEdition(row, editionId));
}

async function ensureEdition(
  ctx: MutationCtx,
  fields: {
    current: boolean;
    label: string;
    slug: string;
    submissionsOpen: boolean;
  }
): Promise<Doc<"editions">> {
  const existing = await editionBySlug(ctx, fields.slug);
  if (existing) {
    return existing;
  }
  const id = await ctx.db.insert("editions", fields);
  const created = await ctx.db.get(id);
  if (!created) {
    throw new Error(`No se pudo crear la edición ${fields.slug}`);
  }
  return created;
}

/**
 * Idempotent: 2026 current with the live settings window, 2027 closed and
 * not current. Safe to run again.
 */
export async function seedEditions(ctx: MutationCtx): Promise<{
  edition2026: Id<"editions">;
  edition2027: Id<"editions">;
}> {
  const edition2026 = await ensureEdition(ctx, {
    current: true,
    label: "HackSpain 2026",
    slug: EDITION_2026_SLUG,
    submissionsOpen: false,
  });
  const edition2027 = await ensureEdition(ctx, {
    current: false,
    label: "HackSpain 2027",
    slug: EDITION_2027_SLUG,
    submissionsOpen: false,
  });

  if (edition2026.current && edition2027.current) {
    await ctx.db.patch(edition2027._id, { current: false });
  }

  return { edition2026: edition2026._id, edition2027: edition2027._id };
}
