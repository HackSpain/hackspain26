import type { Infer } from "convex/values";
import { v } from "convex/values";
import { urlsValidator } from "./urls";

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

export const perkTypeValidator = v.union(v.literal("email"), v.literal("code"));

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
  dietaryDetails: v.optional(v.string()),
  dietaryRestrictions: v.optional(v.string()),
  email: v.optional(v.string()),
  githubCanReadRepos: v.boolean(),
  githubLinked: v.boolean(),
  githubUsername: v.optional(v.string()),
  isRegistered: v.boolean(),
  name: v.optional(v.string()),
  notificationConsent: v.boolean(),
  notificationConsentAt: v.optional(v.number()),
  onboardingComplete: v.boolean(),
  phone: v.optional(v.string()),
  phoneConfirmed: v.boolean(),
  role: roleValidator,
  signupId: v.optional(v.id("signups")),
  travelOrigin: v.optional(v.string()),
});
