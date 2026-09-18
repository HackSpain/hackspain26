import type { Infer } from "convex/values";
import { v } from "convex/values";
import { eventWindowValidator } from "./eventWindow";
import { profileFieldValidator } from "./profile";
import { urlsValidator } from "./urls";
import { sectionsValidator } from "./userTypes";

/**
 * Access level. "judge" is legacy: judging now comes from user types
 * (convex/lib/userTypes.ts) and `userTypes.ensureDefaults` migrates it.
 */
export const roleValidator = v.union(
  v.literal("user"),
  v.literal("judge"),
  v.literal("admin")
);

export type Role = Infer<typeof roleValidator>;

export const submissionStatusValidator = v.union(
  v.literal("draft"),
  v.literal("submitted")
);

export const judgingContextValidator = v.union(
  v.object({
    group: v.number(),
    kind: v.literal("general"),
  }),
  v.object({
    kind: v.literal("track"),
    trackId: v.id("tracks"),
  })
);

export type JudgingContext = Infer<typeof judgingContextValidator>;

export const attendanceValidator = v.union(
  v.literal("attending"),
  v.literal("cancelled"),
  v.literal("undecided")
);

/** In-app claim (`email` / `code`) or a partner-site link (`external`). */
export const perkTypeValidator = v.union(
  v.literal("email"),
  v.literal("code"),
  v.literal("external"),
);

export type PerkType = Infer<typeof perkTypeValidator>;

/** Claims are only created for in-app perks. */
export const claimTypeValidator = v.union(v.literal("email"), v.literal("code"));

export type ClaimType = Infer<typeof claimTypeValidator>;

export const claimStatusValidator = v.union(
  v.literal("pending"),
  v.literal("added"),
  v.literal("rejected"),
  v.literal("assigned")
);

export const perkInputTypeValidator = v.union(
  v.literal("text"),
  v.literal("email"),
  v.literal("url"),
  v.literal("select"),
);

/** A field the participant fills in when claiming a perk. */
export const perkInputValidator = v.object({
  key: v.string(),
  label: v.string(),
  type: perkInputTypeValidator,
  required: v.boolean(),
  options: v.optional(v.array(v.string())),
});

export const perkAnswerValidator = v.object({
  key: v.string(),
  value: v.string(),
});

export const teamMemberStatusValidator = v.union(
  v.literal("member"),
  v.literal("pending")
);

export const milestoneKindValidator = v.union(
  v.literal("firstCommit"),
  v.literal("firstBuild"),
  v.literal("firstDemo"),
  v.literal("custom")
);

export const identifierTypeValidator = v.union(
  v.literal("email"),
  v.literal("github"),
  v.literal("twitter")
);

export const signupPublicValidator = v.object({
  achievements: v.optional(v.string()),
  email: v.string(),
  freeTime: v.optional(v.string()),
  fullName: v.string(),
  urls: urlsValidator,
  wantsAmbassador: v.boolean(),
});

export const signupFieldsValidator = v.object({
  ...signupPublicValidator.fields,
  accepted: v.optional(v.boolean()),
  ambassadorMotivation: v.optional(v.string()),
  ambassadorStudyWhere: v.optional(v.string()),
  createdAt: v.number(),
  dietaryDetails: v.optional(v.string()),
  dietaryRestrictionIds: v.optional(v.array(v.string())),
  neonId: v.optional(v.string()),
});

export const ambassadorFieldsValidator = v.object({
  cityRegion: v.string(),
  createdAt: v.number(),
  email: v.string(),
  fullName: v.string(),
  institution: v.string(),
  motivation: v.string(),
  neonId: v.optional(v.string()),
  outreachPlan: v.string(),
  urls: urlsValidator,
});

export const meValidator = v.object({
  _id: v.id("users"),
  accepted: v.boolean(),
  attendanceStatus: attendanceValidator,
  /** Same-origin path for an uploaded picture, else the GitHub avatar URL. */
  avatarUrl: v.optional(v.string()),
  /** Judging access: admin, judge role, or a user type that grants it. */
  canJudge: v.boolean(),
  /** An uploaded picture can go only while the GitHub avatar stays as the photo. */
  canRemoveAvatar: v.boolean(),
  dietaryDetails: v.optional(v.string()),
  dietaryRestrictions: v.optional(v.string()),
  email: v.optional(v.string()),
  /** Hackathon window as seen by this user; `open` is always true for admins. */
  event: eventWindowValidator,
  githubCanReadRepos: v.boolean(),
  githubLinked: v.boolean(),
  githubUsername: v.optional(v.string()),
  isRegistered: v.boolean(),
  name: v.optional(v.string()),
  notificationConsent: v.boolean(),
  notificationConsentAt: v.optional(v.number()),
  onboardingComplete: v.boolean(),
  /** Contact number for the venue (E.164), never verified. */
  phone: v.optional(v.string()),
  /** `profileMissing` is empty. Every role must reach this before the dashboard opens. */
  profileComplete: v.boolean(),
  /** Identity fields still empty on `users`; see convex/lib/profile.ts. */
  profileMissing: v.array(profileFieldValidator),
  role: roleValidator,
  /** Dashboard sections this user may open. Feed and profile are always on. */
  sections: sectionsValidator,
  signupId: v.optional(v.id("signups")),
  /** Prefill for the X handle: the stored one, else what the signup carried. */
  suggestedTwitterHandle: v.optional(v.string()),
  travelOrigin: v.optional(v.string()),
  /** X handle as stored on `users`, without the @. */
  twitterHandle: v.optional(v.string()),
  userType: v.optional(v.object({ label: v.string(), slug: v.string() })),
});
