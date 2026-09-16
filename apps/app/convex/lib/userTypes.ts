import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

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
  "cli",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const sectionKeyValidator = v.union(
  v.literal("teams"),
  v.literal("tracks"),
  v.literal("perks"),
  v.literal("participantes"),
  v.literal("judging"),
  v.literal("cli")
);

export const sectionsValidator = v.array(sectionKeyValidator);

export type Sections = Infer<typeof sectionsValidator>;

export const userTypeSummaryValidator = v.object({
  _id: v.id("userTypes"),
  description: v.optional(v.string()),
  isDefault: v.boolean(),
  label: v.string(),
  sections: sectionsValidator,
  slug: v.string(),
  sortOrder: v.number(),
});

/** Fallback when no type is assigned and none is marked as default. */
export const PARTICIPANT_SECTIONS: Sections = [
  "teams",
  "tracks",
  "perks",
  "participantes",
  "cli",
];

export const ALL_SECTIONS: Sections = [...SECTION_KEYS];

export function isSectionKey(value: string): value is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(value);
}

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
  user: Pick<Doc<"users">, "userTypeId">
): Promise<Doc<"userTypes"> | null> {
  if (user.userTypeId) {
    const assigned = await ctx.db.get(user.userTypeId);
    if (assigned) {
      return assigned;
    }
  }
  return await defaultUserType(ctx);
}

/**
 * Sections this user may open. Admins see everything; everyone else sees
 * exactly what their type says. Roles play no part beyond admin.
 */
export function effectiveSections(
  user: Pick<Doc<"users">, "role">,
  type: Doc<"userTypes"> | null
): Sections {
  if (user.role === "admin") {
    return ALL_SECTIONS;
  }
  return type ? normalizeSections(type.sections) : PARTICIPANT_SECTIONS;
}

export function grantsJudging(
  user: Pick<Doc<"users">, "role">,
  type: Doc<"userTypes"> | null
): boolean {
  return effectiveSections(user, type).includes("judging");
}

/** Async form for the gates: looks the type up when the user has one. */
export async function canJudge(
  ctx: Ctx,
  user: Pick<Doc<"users">, "role" | "userTypeId">
): Promise<boolean> {
  if (user.role === "admin") {
    return true;
  }
  return grantsJudging(user, await userTypeFor(ctx, user));
}
