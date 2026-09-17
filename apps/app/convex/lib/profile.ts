import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { isDirectoryComplete } from "./directory";

/**
 * What every signed-in account must have before using the dashboard: a
 * name, a photo (uploaded or the GitHub avatar) and a complete directory
 * card. The presence of these fields on `users` is the whole rule; there is
 * no flag. `AuthGate` sends anyone with a missing field to /onboarding, and
 * the wizard shows only the steps that fill what is missing. Phone, terms
 * and consent live on `users.onboardingComplete` instead.
 */
export const PROFILE_FIELDS = ["name", "photo", "directory"] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];

export const profileFieldValidator = v.union(
  v.literal("name"),
  v.literal("photo"),
  v.literal("directory")
);

export type ProfileUser = Pick<
  Doc<"users">,
  "avatarId" | "directory" | "image" | "name"
>;

export function missingProfileFields(user: ProfileUser): ProfileField[] {
  const missing: ProfileField[] = [];
  if (!user.name?.trim()) {
    missing.push("name");
  }
  if (!user.avatarId && !user.image?.trim()) {
    missing.push("photo");
  }
  if (!isDirectoryComplete(user.directory)) {
    missing.push("directory");
  }
  return missing;
}

export function isProfileComplete(user: ProfileUser): boolean {
  return missingProfileFields(user).length === 0;
}
