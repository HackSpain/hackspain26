import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { adminQuery } from "./lib/customFunctions";
import {
  EDITION_2026_SLUG,
  EDITION_2027_SLUG,
  currentEdition,
  editionBySlug,
  seedEditions,
} from "./lib/editions";
import { prepareEditionNarrow } from "./lib/unreadTables";

const PARENT_TABLES = [
  "assessmentAssignments",
  "assessments",
  "eventPasses",
  "finalists",
  "judgingConflicts",
  "judgingRounds",
  "judgingSettings",
  "milestones",
  "notifications",
  "perkClaims",
  "perks",
  "posts",
  "submissions",
  "teamMembers",
  "teams",
  "tracks",
] as const;

function assertMigrationSecret(secret: string): void {
  const expected = process.env.MIGRATION_SECRET;
  if (!expected) {
    throw new Error("MIGRATION_SECRET is not set on the Convex deployment");
  }
  if (secret !== expected) {
    throw new Error("Unauthorized");
  }
}

function assertDevelopmentDeployment(): void {
  if (process.env.SEED_ALLOWED !== "true") {
    throw new Error(
      "Edition writes run only on a development deployment (SEED_ALLOWED=true)"
    );
  }
}

async function countParents(
  ctx: MutationCtx,
  editionId: Id<"editions">
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of PARENT_TABLES) {
    const rows = await ctx.db.query(table).collect();
    counts[table] = rows.filter((row) => row.editionId === editionId).length;
  }
  return counts;
}

const editionSummary = v.object({
  _id: v.id("editions"),
  current: v.boolean(),
  label: v.string(),
  slug: v.string(),
});

export const list = adminQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("editions").collect();
    return rows
      .toSorted((a, b) => a.slug.localeCompare(b.slug))
      .map((row) => ({
        _id: row._id,
        current: row.current,
        label: row.label,
        slug: row.slug,
      }));
  },
  returns: v.array(editionSummary),
});

/** Public label for chrome that renders before login. */
export const currentLabel = query({
  args: {},
  handler: async (ctx) => {
    try {
      const edition = await currentEdition(ctx);
      return {
        eventEndsAt: edition.eventEndsAt,
        eventStartsAt: edition.eventStartsAt,
        label: edition.label,
        slug: edition.slug,
      };
    } catch {
      return null;
    }
  },
  returns: v.union(
    v.object({
      eventEndsAt: v.optional(v.number()),
      eventStartsAt: v.optional(v.number()),
      label: v.string(),
      slug: v.string(),
    }),
    v.null()
  ),
});

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => await seedEditions(ctx),
  returns: v.object({
    edition2026: v.id("editions"),
    edition2027: v.id("editions"),
  }),
});

export const backfill = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const { edition2026, edition2027 } = await seedEditions(ctx);
    const stamped = await countParents(ctx, edition2026);
    const conflicts = {
      emailMismatch: [] as string[],
      missingSignup: [] as string[],
      skippedNoRole: [] as string[],
    };
    const inserted2026 = 0;
    const inserted2027 = 0;
    const updated2026 = 0;
    const updated2027 = 0;

    const missingEdition: Record<string, number> = {};
    const untyped = (await ctx.db.query("participations").collect()).filter(
      (row) => !row.roleId
    ).length;

    return {
      conflicts,
      edition2026,
      edition2027,
      inserted2026,
      inserted2027,
      missingEdition,
      participationsWithoutRole: untyped,
      stamped,
      updated2026,
      updated2027,
    };
  },
  returns: v.object({
    conflicts: v.object({
      emailMismatch: v.array(v.string()),
      missingSignup: v.array(v.string()),
      skippedNoRole: v.array(v.string()),
    }),
    edition2026: v.id("editions"),
    edition2027: v.id("editions"),
    inserted2026: v.number(),
    inserted2027: v.number(),
    missingEdition: v.record(v.string(), v.number()),
    participationsWithoutRole: v.number(),
    stamped: v.record(v.string(), v.number()),
    updated2026: v.number(),
    updated2027: v.number(),
  }),
});

export const counts = query({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const editions = await ctx.db.query("editions").collect();
    const participations = await ctx.db.query("participations").collect();
    const emails2027 = participations.filter((row) => {
      const edition = editions.find((item) => item._id === row.editionId);
      return edition?.slug === EDITION_2027_SLUG && row.status === "interested";
    });
    const byEdition: Record<
      string,
      { current: boolean; participations: number; slug: string }
    > = {};
    for (const edition of editions) {
      byEdition[edition.slug] = {
        current: edition.current,
        participations: participations.filter(
          (row) => row.editionId === edition._id
        ).length,
        slug: edition.slug,
      };
    }
    const missingRole = participations.filter((row) => !row.roleId).length;
    const missingEditionParents: Record<string, number> = {};
    return {
      byEdition,
      emails2027: emails2027.length,
      missingEditionParents,
      missingRole,
      signups: participations.filter((row) => {
        const edition = editions.find((item) => item._id === row.editionId);
        return edition?.slug === EDITION_2026_SLUG;
      }).length,
    };
  },
  returns: v.object({
    byEdition: v.record(
      v.string(),
      v.object({
        current: v.boolean(),
        participations: v.number(),
        slug: v.string(),
      })
    ),
    emails2027: v.number(),
    missingEditionParents: v.record(v.string(), v.number()),
    missingRole: v.number(),
    signups: v.number(),
  }),
});

export const convexSignupSnapshot = query({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const edition2026 = await editionBySlug(ctx, EDITION_2026_SLUG);
    if (!edition2026) {
      return [];
    }
    const rows = await ctx.db
      .query("participations")
      .withIndex("by_edition", (q) => q.eq("editionId", edition2026._id))
      .collect();
    return rows.map((row) => ({
      accepted:
        row.status === "accepted" ||
        row.status === "confirmed" ||
        row.status === "cancelled",
      email: row.email,
      neonId: row.neonId,
    }));
  },
  returns: v.array(
    v.object({
      accepted: v.boolean(),
      email: v.string(),
      neonId: v.optional(v.string()),
    })
  ),
});

export const prepareNarrow = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    return await prepareEditionNarrow(ctx);
  },
  returns: v.object({
    deleted: v.record(v.string(), v.number()),
    stripped: v.record(v.string(), v.number()),
  }),
});

/**
 * Makes `slug` the only current edition. Refuses unless this Convex
 * deployment has SEED_ALLOWED=true (development).
 */
export const makeCurrent = mutation({
  args: { secret: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    assertDevelopmentDeployment();
    const target = await editionBySlug(ctx, args.slug);
    if (!target) {
      throw new Error(`No existe la edición ${args.slug}`);
    }
    for (const edition of await ctx.db.query("editions").collect()) {
      const current = edition._id === target._id;
      if (edition.current !== current) {
        await ctx.db.patch(edition._id, { current });
      }
    }
    return { current: args.slug };
  },
  returns: v.object({ current: v.string() }),
});
