import { v } from "convex/values";
import { urlsValidator } from "./urls";

export const roleValidator = v.union(v.literal("user"), v.literal("admin"));

export const submissionStatusValidator = v.union(
  v.literal("draft"),
  v.literal("submitted"),
);

export const attendanceValidator = v.union(
  v.literal("attending"),
  v.literal("cancelled"),
  v.literal("undecided"),
);

export const perkTypeValidator = v.union(v.literal("email"), v.literal("code"));

export const claimStatusValidator = v.union(
  v.literal("pending"),
  v.literal("added"),
  v.literal("rejected"),
  v.literal("assigned"),
);

export const teamMemberStatusValidator = v.union(
  v.literal("member"),
  v.literal("pending"),
);

export const milestoneKindValidator = v.union(
  v.literal("firstCommit"),
  v.literal("firstBuild"),
  v.literal("firstDemo"),
  v.literal("custom"),
);

export const identifierTypeValidator = v.union(
  v.literal("email"),
  v.literal("github"),
  v.literal("twitter"),
);

export const signupPublicValidator = v.object({
  fullName: v.string(),
  email: v.string(),
  urls: urlsValidator,
  achievements: v.optional(v.string()),
  freeTime: v.optional(v.string()),
  wantsAmbassador: v.boolean(),
});

export const signupFieldsValidator = v.object({
  ...signupPublicValidator.fields,
  ambassadorMotivation: v.optional(v.string()),
  ambassadorStudyWhere: v.optional(v.string()),
  createdAt: v.number(),
  neonId: v.optional(v.string()),
  accepted: v.optional(v.boolean()),
  dietaryRestrictionIds: v.optional(v.array(v.string())),
  dietaryDetails: v.optional(v.string()),
});

export const ambassadorFieldsValidator = v.object({
  email: v.string(),
  fullName: v.string(),
  institution: v.string(),
  cityRegion: v.string(),
  urls: urlsValidator,
  motivation: v.string(),
  outreachPlan: v.string(),
  createdAt: v.number(),
  neonId: v.optional(v.string()),
});

export const meValidator = v.object({
  _id: v.id("users"),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  role: roleValidator,
  phone: v.optional(v.string()),
  phoneConfirmed: v.boolean(),
  notificationConsent: v.boolean(),
  notificationConsentAt: v.optional(v.number()),
  attendanceStatus: attendanceValidator,
  dietaryRestrictions: v.optional(v.string()),
  dietaryDetails: v.optional(v.string()),
  travelOrigin: v.optional(v.string()),
  onboardingComplete: v.boolean(),
  isRegistered: v.boolean(),
  accepted: v.boolean(),
  signupId: v.optional(v.id("signups")),
  githubUsername: v.optional(v.string()),
  githubLinked: v.boolean(),
});
