import { v } from "convex/values";

export const LINKEDIN_PROFILE_FRESH_MS = 24 * 60 * 60 * 1000;

export const linkedinExperienceValidator = v.object({
  current: v.boolean(),
  name: v.string(),
  title: v.optional(v.string()),
});

export const linkedinEducationValidator = v.object({
  detail: v.optional(v.string()),
  name: v.string(),
});

/**
 * `about`, `education` and `skills` are not filled by `profileFromNyne` yet.
 * Production accepts them since 2026-09-21 (a directory import deployed
 * straight to production wrote `about` and `education` into 201 rows), and
 * the schema push rejects every deploy from master until the table validator
 * accepts them. Keep them optional.
 */
export const linkedinProfileFields = {
  about: v.optional(v.string()),
  company: v.optional(v.string()),
  education: v.optional(v.array(linkedinEducationValidator)),
  experience: v.array(linkedinExperienceValidator),
  fetchedAt: v.number(),
  followers: v.optional(v.number()),
  headline: v.optional(v.string()),
  location: v.optional(v.string()),
  missing: v.boolean(),
  name: v.optional(v.string()),
  skills: v.optional(v.array(v.string())),
  slug: v.string(),
  url: v.string(),
  years: v.optional(v.number()),
};

export const linkedinProfileValidator = v.object(linkedinProfileFields);

export type LinkedinExperience = {
  current: boolean;
  name: string;
  title?: string;
};

export type LinkedinEducation = {
  detail?: string;
  name: string;
};

export type LinkedinProfile = {
  about?: string;
  company?: string;
  education?: LinkedinEducation[];
  experience: LinkedinExperience[];
  fetchedAt: number;
  followers?: number;
  headline?: string;
  location?: string;
  missing: boolean;
  name?: string;
  skills?: string[];
  slug: string;
  url: string;
  years?: number;
};

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function hasNyneAuth(): boolean {
  return Boolean(process.env.NYNE_API_KEY && process.env.NYNE_API_SECRET);
}

export function nyneHeaders(): Record<string, string> | null {
  const key = process.env.NYNE_API_KEY;
  const secret = process.env.NYNE_API_SECRET;
  if (!key || !secret) {
    return null;
  }
  return {
    accept: "application/json",
    "content-type": "application/json",
    "user-agent": "hackspain-directory",
    "x-api-key": key,
    "x-api-secret": secret,
  };
}

export function normalizeLinkedinSlug(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  let path = trimmed.replace(/^@/, "");
  if (!/linkedin\.com/i.test(path) && !path.includes("/")) {
    const slug = path.toLowerCase();
    return /^[a-z0-9](?:[a-z0-9_-]{1,98}[a-z0-9])?$/.test(slug) ? slug : null;
  }
  try {
    const parsed = new URL(
      /^https?:\/\//i.test(path) ? path : `https://${path}`,
    );
    if (!/(^|\.)linkedin\.com$/i.test(parsed.hostname)) {
      return null;
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0]?.toLowerCase() !== "in" || !parts[1]) {
      return null;
    }
    path = parts[1];
  } catch {
    if (path.includes("/") || path.includes(" ")) {
      return null;
    }
  }
  const slug = decodeURIComponent(path).replace(/\/+$/, "").toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9_-]{1,98}[a-z0-9])?$/.test(slug)) {
    return null;
  }
  return slug;
}

export function linkedinUrlFor(slug: string): string {
  return `https://www.linkedin.com/in/${slug}`;
}

export function linkedinProfileIsStale(
  profile: { fetchedAt: number } | null,
  now: number,
): boolean {
  if (!profile) {
    return true;
  }
  return now - profile.fetchedAt >= LINKEDIN_PROFILE_FRESH_MS;
}

export function missingLinkedinProfile(
  slug: string,
  fetchedAt: number,
): LinkedinProfile {
  return {
    experience: [],
    fetchedAt,
    missing: true,
    slug,
    url: linkedinUrlFor(slug),
  };
}

function experienceFrom(value: unknown): LinkedinExperience[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }
    const org = row as { is_current?: unknown; name?: unknown; title?: unknown };
    const name = optionalString(org.name);
    if (!name) {
      return [];
    }
    return [
      {
        current: org.is_current === true,
        name,
        title: optionalString(org.title),
      },
    ];
  }).slice(0, 8);
}

export function profileFromNyne(
  result: Record<string, unknown>,
  slug: string,
  fetchedAt: number,
): LinkedinProfile {
  const socials =
    result.social_profiles && typeof result.social_profiles === "object"
      ? (result.social_profiles as Record<string, unknown>)
      : undefined;
  const linkedin =
    socials?.linkedin && typeof socials.linkedin === "object"
      ? (socials.linkedin as Record<string, unknown>)
      : undefined;
  const experience = experienceFrom(result.organizations);
  const current = experience.find((row) => row.current) ?? experience[0];
  const name =
    optionalString(result.displayname) ??
    [optionalString(result.firstname), optionalString(result.lastname)]
      .filter(Boolean)
      .join(" ");
  const followers =
    typeof linkedin?.followers === "number" ? linkedin.followers : undefined;
  const years =
    typeof result.total_experience_years === "number"
      ? result.total_experience_years
      : undefined;
  if (!name && !current && followers === undefined) {
    return missingLinkedinProfile(slug, fetchedAt);
  }
  return {
    company: current?.name,
    experience,
    fetchedAt,
    followers,
    headline: optionalString(result.headline),
    location: optionalString(result.location),
    missing: false,
    name: name || undefined,
    slug,
    url: optionalString(linkedin?.url) ?? linkedinUrlFor(slug),
    years,
  };
}
