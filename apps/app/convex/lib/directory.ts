import { v } from "convex/values";
import type { Infer } from "convex/values";
import {
  canonicalOrText,
  canonicalTags,
  CITY_OPTIONS,
  DEGREE_OPTIONS,
  INTEREST_OPTIONS,
  ROLE_OPTIONS,
  SKILL_OPTIONS,
  UNIVERSITY_OPTIONS,
} from "./directoryOptions";

/**
 * The participant directory card. These are the data points the connection
 * graph draws edges from (city, university, company, degree, skills,
 * interests) plus what the profile panel shows (role, bio). Stored on
 * `users.directory`; onboarding asks for it before the dashboard opens, and
 * only complete cards (see `missingDirectoryFields`) appear in the graph.
 */
export const directoryValidator = v.object({
  bio: v.optional(v.string()),
  city: v.string(),
  company: v.optional(v.string()),
  degree: v.optional(v.string()),
  interests: v.array(v.string()),
  role: v.string(),
  skills: v.array(v.string()),
  university: v.optional(v.string()),
  updatedAt: v.number(),
});

export type DirectoryCard = Infer<typeof directoryValidator>;

export const DIRECTORY_FIELDS = [
  "role",
  "city",
  "affiliation",
  "skills",
  "interests",
] as const;

export type DirectoryField = (typeof DIRECTORY_FIELDS)[number];

export const directoryFieldValidator = v.union(
  v.literal("role"),
  v.literal("city"),
  v.literal("affiliation"),
  v.literal("skills"),
  v.literal("interests")
);

export const MAX_TAGS = 12;
export const MAX_TAG_LENGTH = 32;
export const MAX_TEXT = 80;
export const MAX_BIO = 240;

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim().replaceAll(/\s+/g, " ");
  return text || undefined;
}

/** Comma or newline separated free text into unique, trimmed tags. */
export function parseTags(raw: string | readonly string[]): string[] {
  const parts = typeof raw === "string" ? raw.split(/[,\n]/) : raw;
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of parts) {
    const tag = part.trim().replaceAll(/\s+/g, " ");
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) {
      continue;
    }
    seen.add(key);
    tags.push(tag.slice(0, MAX_TAG_LENGTH));
  }
  return tags.slice(0, MAX_TAGS);
}

/**
 * Required data points that are still empty. `affiliation` means neither a
 * university nor a company was given; one of the two is enough.
 */
export function missingDirectoryFields(
  card: Partial<DirectoryCard> | null | undefined
): DirectoryField[] {
  const missing: DirectoryField[] = [];
  if (!cleanText(card?.role)) {
    missing.push("role");
  }
  if (!cleanText(card?.city)) {
    missing.push("city");
  }
  if (!cleanText(card?.university) && !cleanText(card?.company)) {
    missing.push("affiliation");
  }
  if (!card?.skills?.length) {
    missing.push("skills");
  }
  if (!card?.interests?.length) {
    missing.push("interests");
  }
  return missing;
}

export function isDirectoryComplete(
  card: Partial<DirectoryCard> | null | undefined
): boolean {
  return missingDirectoryFields(card).length === 0;
}

/**
 * Normalises a submitted card and throws (Spanish, user-facing) when invalid.
 * Every value the graph groups by is folded onto the curated vocabularies in
 * directoryOptions.ts ("UPM" and "Technical University of Madrid" both become
 * "Universidad Politécnica de Madrid"); unknown free text is kept as typed.
 */
export function parseDirectoryCard(input: {
  bio?: string;
  city: string;
  company?: string;
  degree?: string;
  interests: string | readonly string[];
  role: string;
  skills: string | readonly string[];
  university?: string;
}): DirectoryCard {
  const card: DirectoryCard = {
    bio: cleanText(input.bio),
    city: canonicalOrText(CITY_OPTIONS, input.city) ?? "",
    company: cleanText(input.company),
    degree: canonicalOrText(DEGREE_OPTIONS, input.degree),
    interests: canonicalTags(INTEREST_OPTIONS, parseTags(input.interests)),
    role: canonicalOrText(ROLE_OPTIONS, input.role) ?? "",
    skills: canonicalTags(SKILL_OPTIONS, parseTags(input.skills)),
    university: canonicalOrText(UNIVERSITY_OPTIONS, input.university),
    updatedAt: Date.now(),
  };
  const missing = missingDirectoryFields(card);
  if (missing.length > 0) {
    throw new Error(
      {
        affiliation: "Dinos tu universidad o tu empresa",
        city: "Dinos tu ciudad",
        interests: "Añade al menos un interés",
        role: "Dinos tu rol",
        skills: "Añade al menos una habilidad",
      }[missing[0] ?? "role"]
    );
  }
  for (const [label, value] of [
    ["El rol", card.role],
    ["La ciudad", card.city],
    ["La universidad", card.university],
    ["La empresa", card.company],
    ["La titulación", card.degree],
  ] as const) {
    if (value && value.length > MAX_TEXT) {
      throw new Error(`${label} no puede superar ${MAX_TEXT} caracteres`);
    }
  }
  if (card.bio && card.bio.length > MAX_BIO) {
    throw new Error(`La bio no puede superar ${MAX_BIO} caracteres`);
  }
  return card;
}
