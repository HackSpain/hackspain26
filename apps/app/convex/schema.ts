import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { urlEntryValidator } from "./lib/urls";
import { milestoneKindValidator } from "./lib/validators";

const authTablesWithoutUsers = Object.fromEntries(
  Object.entries(authTables).filter(([name]) => name !== "users"),
) as Omit<typeof authTables, "users">;

export default defineSchema({
  ...authTablesWithoutUsers,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.union(v.literal("user"), v.literal("admin")),
    signupId: v.optional(v.id("signups")),
    phoneConfirmed: v.boolean(),
    notificationConsent: v.boolean(),
    notificationConsentAt: v.optional(v.number()),
    termsAcceptedAt: v.optional(v.number()),
    attendanceStatus: v.union(
      v.literal("attending"),
      v.literal("cancelled"),
      v.literal("undecided"),
    ),
    dietaryRestrictions: v.optional(v.string()),
    dietaryDetails: v.optional(v.string()),
    travelOrigin: v.optional(v.string()),
    onboardingComplete: v.boolean(),
    adminNotes: v.optional(v.string()),
    githubId: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    githubLinkedAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_signup", ["signupId"])
    .index("by_role", ["role"])
    .index("by_attendance", ["attendanceStatus"])
    .index("by_github_id", ["githubId"])
    .index("by_github", ["githubUsername"]),

  githubLinkStates: defineTable({
    userId: v.id("users"),
    state: v.string(),
    expiresAt: v.number(),
  })
    .index("by_state", ["state"])
    .index("by_user", ["userId"]),

  signups: defineTable({
    email: v.string(),
    fullName: v.string(),
    urls: v.array(urlEntryValidator),
    githubUsername: v.optional(v.string()),
    twitterHandle: v.optional(v.string()),
    achievements: v.optional(v.string()),
    freeTime: v.optional(v.string()),
    wantsAmbassador: v.boolean(),
    ambassadorMotivation: v.optional(v.string()),
    ambassadorStudyWhere: v.optional(v.string()),
    accepted: v.optional(v.boolean()),
    dietaryRestrictions: v.optional(v.string()),
    dietaryDetails: v.optional(v.string()),
    createdAt: v.number(),
    neonId: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_github", ["githubUsername"])
    .index("by_twitter", ["twitterHandle"])
    .index("by_accepted", ["accepted"]),

  ambassadorApplications: defineTable({
    email: v.string(),
    fullName: v.string(),
    institution: v.string(),
    cityRegion: v.string(),
    urls: v.array(urlEntryValidator),
    motivation: v.string(),
    outreachPlan: v.string(),
    createdAt: v.number(),
    neonId: v.optional(v.string()),
  }).index("by_email", ["email"]),

  teams: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    joinCode: v.optional(v.string()),
    repoUrl: v.optional(v.string()),
    techStack: v.optional(v.array(v.string())),
    // GitHub feed polling: ETag for conditional requests, last poll time.
    githubEtag: v.optional(v.string()),
    githubPolledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_join_code", ["joinCode"]),

  posts: defineTable({
    kind: v.union(v.literal("post"), v.literal("github")),
    authorId: v.optional(v.id("users")),
    teamId: v.optional(v.id("teams")),
    text: v.string(),
    imageId: v.optional(v.id("_storage")),
    github: v.optional(
      v.object({
        repo: v.string(),
        event: v.string(),
        url: v.string(),
        actor: v.optional(v.string()),
      }),
    ),
    /** GitHub event id, so polling never inserts the same event twice. */
    externalId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_external", ["externalId"])
    .index("by_image", ["imageId"])
    .index("by_team", ["teamId"]),

  milestones: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    kind: milestoneKindValidator,
    label: v.optional(v.string()),
    at: v.number(),
    createdAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_at", ["at"]),

  teamMembers: defineTable({
    teamId: v.id("teams"),
    userId: v.optional(v.id("users")),
    signupId: v.optional(v.id("signups")),
    identifierType: v.union(
      v.literal("email"),
      v.literal("github"),
      v.literal("twitter"),
    ),
    identifier: v.string(),
    status: v.union(v.literal("member"), v.literal("pending")),
    addedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"])
    .index("by_signup", ["signupId"])
    .index("by_identifier", ["identifierType", "identifier"]),

  perks: defineTable({
    company: v.string(),
    title: v.string(),
    value: v.string(),
    description: v.string(),
    type: v.union(v.literal("email"), v.literal("code")),
    active: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_active", ["active"])
    .index("by_company", ["company"]),

  perkCodes: defineTable({
    perkId: v.id("perks"),
    code: v.string(),
    available: v.boolean(),
    assignedTo: v.optional(v.id("users")),
    assignedAt: v.optional(v.number()),
  })
    .index("by_perk", ["perkId"])
    .index("by_perk_available", ["perkId", "available"])
    .index("by_user", ["assignedTo"]),

  perkClaims: defineTable({
    perkId: v.id("perks"),
    userId: v.id("users"),
    type: v.union(v.literal("email"), v.literal("code")),
    status: v.union(
      v.literal("pending"),
      v.literal("added"),
      v.literal("rejected"),
      v.literal("assigned"),
    ),
    codeId: v.optional(v.id("perkCodes")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_perk", ["perkId"])
    .index("by_user", ["userId"])
    .index("by_perk_and_user", ["perkId", "userId"])
    .index("by_status", ["status"]),

  tracks: defineTable({
    slug: v.string(),
    label: v.string(),
    body: v.string(),
    note: v.string(),
    sortOrder: v.number(),
    active: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_active_and_sort", ["active", "sortOrder"]),

  settings: defineTable({
    key: v.string(),
    submissionsOpen: v.boolean(),
  }).index("by_key", ["key"]),

  submissions: defineTable({
    teamId: v.optional(v.id("teams")),
    submittedBy: v.id("users"),
    name: v.string(),
    description: v.string(),
    urls: v.array(urlEntryValidator),
    challengeIds: v.array(v.id("tracks")),
    perkIds: v.array(v.id("perks")),
    status: v.union(v.literal("draft"), v.literal("submitted")),
    createdAt: v.number(),
    updatedAt: v.number(),
    submittedAt: v.optional(v.number()),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["submittedBy"])
    .index("by_status", ["status"]),

  devOtpCodes: defineTable({
    email: v.string(),
    code: v.string(),
    expiresAt: v.number(),
  }).index("by_email", ["email"]),

  phoneChallenges: defineTable({
    userId: v.id("users"),
    phone: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
  }).index("by_user", ["userId"]),

  notifications: defineTable({
    subject: v.string(),
    body: v.string(),
    audience: v.union(
      v.literal("all"),
      v.literal("accepted"),
      v.literal("attending"),
      v.literal("user"),
    ),
    recipientUserId: v.optional(v.id("users")),
    sentBy: v.id("users"),
    sentAt: v.number(),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    recipientCount: v.number(),
    sentCount: v.number(),
    failures: v.array(v.object({ email: v.string(), error: v.string() })),
  }).index("by_sent_at", ["sentAt"]),
});
