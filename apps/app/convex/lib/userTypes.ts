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
  sections: sectionsValidator,
  slug: v.string(),
  sortOrder: v.number(),
});

/** Fallback when no type is assigned and none is marked as default. */
export const PARTICIPANT_SECTIONS: Sections = [
  "teams",
  "tracks",
  "perks",
  "cli",
];

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
 * Sections this user may open. Admins see everything. The directory is
 * forced on for judges, sponsors and mentors and stripped from everyone
 * else, even if the CRM type still has the checkbox.
 */
export function effectiveSections(
  user: Pick<Doc<"users">, "role">,
  type: Doc<"userTypes"> | null
): Sections {
  if (user.role === "admin") {
    return ALL_SECTIONS;
  }
  const sections = type ? normalizeSections(type.sections) : PARTICIPANT_SECTIONS;
  let next = sections;
  if (isSponsorType(type)) {
    next = withSponsorCatalog(sections);
  } else if (sections.includes("judging")) {
    next = normalizeSections([...sections, "judgingSponsors"]);
  }
  if (grantsDirectory(user, type)) {
    return normalizeSections([...next, "participantes"]);
  }
  return normalizeSections(next.filter((key) => key !== "participantes"));
}

export function grantsJudging(
  user: Pick<Doc<"users">, "role">,
  type: Doc<"userTypes"> | null
): boolean {
  return effectiveSections(user, type).includes("judging");
}

export function grantsSponsorCatalog(
  user: Pick<Doc<"users">, "role">,
  type: Doc<"userTypes"> | null
): boolean {
  return effectiveSections(user, type).includes("judgingSponsors");
}

/** Directory graph: admins, judges, sponsors and mentors. Never hackers. */
export function grantsDirectory(
  user: Pick<Doc<"users">, "role">,
  type: Doc<"userTypes"> | null
): boolean {
  if (user.role === "admin") {
    return true;
  }
  if (isSponsorType(type) || isMentorType(type)) {
    return true;
  }
  const sections = type ? normalizeSections(type.sections) : PARTICIPANT_SECTIONS;
  return sections.includes("judging") || sections.includes("judgingSponsors");
}

/** CRM type "Sponsor": browses deliveries, never scores in the general pool. */
export function isSponsorType(
  type: Pick<Doc<"userTypes">, "slug" | "label"> | null | undefined
): boolean {
  return typeNamed(type, "sponsor");
}

/** CRM type "Mentor": staff on the floor, not a hacker. */
export function isMentorType(
  type: Pick<Doc<"userTypes">, "slug" | "label"> | null | undefined
): boolean {
  return typeNamed(type, "mentor");
}

function typeNamed(
  type: Pick<Doc<"userTypes">, "slug" | "label"> | null | undefined,
  name: string
): boolean {
  if (!type) {
    return false;
  }
  return type.slug === name || type.label.trim().toLowerCase() === name;
}

export function withSponsorCatalog(sections: readonly string[]): Sections {
  return normalizeSections([
    ...sections.filter((key) => key !== "judging"),
    "judgingSponsors",
  ]);
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

export async function canBrowseSponsorCatalog(
  ctx: Ctx,
  user: Pick<Doc<"users">, "role" | "userTypeId">
): Promise<boolean> {
  if (user.role === "admin") {
    return true;
  }
  return grantsSponsorCatalog(user, await userTypeFor(ctx, user));
}

export async function canBrowseDirectory(
  ctx: Ctx,
  user: Pick<Doc<"users">, "role" | "userTypeId">
): Promise<boolean> {
  if (user.role === "admin") {
    return true;
  }
  return grantsDirectory(user, await userTypeFor(ctx, user));
}
