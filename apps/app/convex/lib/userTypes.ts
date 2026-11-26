import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getCurrentParticipation } from "./participationLookup";

/**
 * Dashboard sections a user type can switch on. The feed (home), the profile
 * and the venue TV are always visible. Order here is the order of the tabs.
 */
export const SECTION_KEYS = [
  "teams",
  "tracks",
  "perks",
  "participantes",
  "judging",
  "judgingSponsors",
  "cli",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const sectionKeyValidator = v.union(
  ...SECTION_KEYS.map((key) => v.literal(key))
);

export const sectionsValidator = v.array(sectionKeyValidator);

export type Sections = Infer<typeof sectionsValidator>;

export const userTypeSummaryValidator = v.object({
  _id: v.id("userTypes"),
  description: v.optional(v.string()),
  isDefault: v.boolean(),
  label: v.string(),
  openForApplications: v.boolean(),
  requiresConfirmed: v.boolean(),
  sections: sectionsValidator,
  slug: v.string(),
  sortOrder: v.number(),
});

/** Header and CRM checkboxes. `cli` stays in stored arrays but is not a nav section. */
export const NAV_SECTION_KEYS = SECTION_KEYS.filter(
  (key): key is Exclude<SectionKey, "cli"> => key !== "cli"
);

/** Fallback when no type is assigned and none is marked as default. */
export const PARTICIPANT_SECTIONS: Sections = ["teams", "tracks", "perks"];

export const ALL_SECTIONS: Sections = [...SECTION_KEYS];

export function normalizeSections(input: readonly string[]): Sections {
  const wanted = new Set(input);
  return SECTION_KEYS.filter((key) => wanted.has(key));
}

export function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replaceAll(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 40);
}

type Ctx = QueryCtx | MutationCtx;

export async function defaultUserType(
  ctx: Ctx
): Promise<Doc<"userTypes"> | null> {
  return await ctx.db
    .query("userTypes")
    .withIndex("by_default", (q) => q.eq("isDefault", true))
    .first();
}

/**
 * The type that applies to a user: the one assigned in the CRM, else the type
 * marked as default, else none (legacy role-based visibility).
 */
export async function userTypeFor(
  ctx: Ctx,
  user: Pick<Doc<"users">, "_id" | "email">
): Promise<Doc<"userTypes"> | null> {
  try {
    const row = await getCurrentParticipation(ctx, user);
    if (row?.roleId) {
      const assigned = await ctx.db.get(row.roleId);
      if (assigned) {
        return assigned;
      }
    }
  } catch {
    // Editions table missing in tests that still seed only users.
  }
  return await defaultUserType(ctx);
}

function catalogAdmin(
  user: Pick<Doc<"users">, "role"> & { admin?: boolean }
): boolean {
  return user.admin === true || user.role === "admin";
}

function navSections(sections: Sections): Sections {
  return normalizeSections(sections.filter((key) => key !== "cli"));
}

/**
 * Sections this user may open. Admins see every nav section. Checkboxes on
 * the catalog row are the grant — no slug/label force or strip.
 */
export function effectiveSections(
  user: Pick<Doc<"users">, "role"> & { admin?: boolean },
  type: Doc<"userTypes"> | null
): Sections {
  if (catalogAdmin(user)) {
    return navSections(ALL_SECTIONS);
  }
  return navSections(
    type ? normalizeSections(type.sections) : PARTICIPANT_SECTIONS
  );
}

export function grantsJudging(
  user: Pick<Doc<"users">, "role"> & { admin?: boolean },
  type: Doc<"userTypes"> | null
): boolean {
  return effectiveSections(user, type).includes("judging");
}

export function grantsSponsorCatalog(
  user: Pick<Doc<"users">, "role"> & { admin?: boolean },
  type: Doc<"userTypes"> | null
): boolean {
  return effectiveSections(user, type).includes("judgingSponsors");
}

export function grantsDirectory(
  user: Pick<Doc<"users">, "role"> & { admin?: boolean },
  type: Doc<"userTypes"> | null
): boolean {
  return effectiveSections(user, type).includes("participantes");
}

export function typeRequiresConfirmed(
  type: Pick<Doc<"userTypes">, "requiresConfirmed"> | null | undefined
): boolean {
  return type?.requiresConfirmed !== false;
}

export function typeOpenForApplications(
  type: Pick<Doc<"userTypes">, "openForApplications"> | null | undefined
): boolean {
  return type?.openForApplications === true;
}

/** Async form for the gates: looks the type up when the user has one. */
export async function canJudge(
  ctx: Ctx,
  user: Pick<Doc<"users">, "_id" | "admin" | "email" | "role">
): Promise<boolean> {
  if (catalogAdmin(user)) {
    return true;
  }
  return grantsJudging(user, await userTypeFor(ctx, user));
}

export async function canBrowseSponsorCatalog(
  ctx: Ctx,
  user: Pick<Doc<"users">, "_id" | "admin" | "email" | "role">
): Promise<boolean> {
  if (catalogAdmin(user)) {
    return true;
  }
  return grantsSponsorCatalog(user, await userTypeFor(ctx, user));
}

export async function canBrowseDirectory(
  ctx: Ctx,
  user: Pick<Doc<"users">, "_id" | "admin" | "email" | "role">
): Promise<boolean> {
  if (catalogAdmin(user)) {
    return true;
  }
  return grantsDirectory(user, await userTypeFor(ctx, user));
}
