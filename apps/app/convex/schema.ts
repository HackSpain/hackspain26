import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { urlEntryValidator } from "./lib/urls";
import { directoryValidator } from "./lib/directory";
import { sectionsValidator } from "./lib/userTypes";
import { screenPresetValidator } from "./lib/tvScreens";
import { tvWidgetFields, tvWidgetValidator } from "./lib/tvValidators";
import {
  claimTypeValidator,
  milestoneKindValidator,
  perkAnswerValidator,
  perkInputValidator,
  perkTypeValidator,
  roleValidator,
} from "./lib/validators";

export default defineSchema({
  tvPlaybackControl: defineTable({ key: v.string(), reloadVersion: v.number() }).index("by_key", ["key"]),
  tvScreens: defineTable({
    key: v.string(), preset: screenPresetValidator, message: v.string(),
    revision: v.number(), reloadVersion: v.number(),
  }).index("by_key", ["key"]),
  tvScreenConnections: defineTable({
    screenId: v.id("tvScreens"), clientId: v.string(), url: v.string(),
    width: v.number(), height: v.number(), lastSeenAt: v.number(),
    receivedRevision: v.number(), receivedReloadVersion: v.number(),
  }).index("by_client", ["clientId"]).index("by_screen", ["screenId"]),
  ...authTables,
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

  devOtpCodes: defineTable({
    email: v.string(),
    code: v.string(),
    expiresAt: v.number(),
  }).index("by_email", ["email"]),

  eventPasses: defineTable({
    userId: v.optional(v.id("users")),
    signupId: v.optional(v.id("signups")),
    code: v.string(),
    status: v.union(v.literal("active"), v.literal("revoked")),
    codeSentAt: v.optional(v.number()),
    checkedInAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_signup", ["signupId"])
    .index("by_code", ["code"]),

  eventSettings: defineTable({
    key: v.string(),
    phase: v.union(
      v.literal("pre_event"),
      v.literal("live"),
      v.literal("ended")
    ),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }).index("by_key", ["key"]),

  githubLinkStates: defineTable({
    userId: v.id("users"),
    state: v.string(),
    expiresAt: v.number(),
    /** Same-origin path the callback sends the browser back to; `/` when unset. */
    returnTo: v.optional(v.string()),
  })
    .index("by_state", ["state"])
    .index("by_user", ["userId"]),

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

  notifications: defineTable({
    subject: v.string(),
    body: v.string(),
    audience: v.union(
      v.literal("all"),
      v.literal("accepted"),
      v.literal("attending"),
      v.literal("user")
    ),
    recipientUserId: v.optional(v.id("users")),
    sentBy: v.id("users"),
    sentAt: v.number(),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("failed")
    ),
    recipientCount: v.number(),
    sentCount: v.number(),
    failures: v.array(v.object({ email: v.string(), error: v.string() })),
  }).index("by_sent_at", ["sentAt"]),

  perkClaims: defineTable({
    perkId: v.id("perks"),
    userId: v.id("users"),
    type: claimTypeValidator,
    status: v.union(
      v.literal("pending"),
      v.literal("added"),
      v.literal("rejected"),
      v.literal("assigned")
    ),
    codeId: v.optional(v.id("perkCodes")),
    answers: v.optional(v.array(perkAnswerValidator)),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_perk", ["perkId"])
    .index("by_user", ["userId"])
    .index("by_perk_and_user", ["perkId", "userId"])
    .index("by_status", ["status"]),

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

  perks: defineTable({
    company: v.string(),
    title: v.string(),
    value: v.string(),
    description: v.string(),
    type: perkTypeValidator,
    sponsorUrl: v.optional(v.string()),
    /** How to claim on the partner site. Required when type is `external`. */
    instructions: v.optional(v.string()),
    inputs: v.optional(v.array(perkInputValidator)),
    active: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_active", ["active"])
    .index("by_company", ["company"]),

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
      })
    ),
    /** GitHub event id, so polling never inserts the same event twice. */
    externalId: v.optional(v.string()),
    /** Client nonce so an optimistic row and its server row share one React key. */
    clientId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_external", ["externalId"])
    .index("by_image", ["imageId"])
    .index("by_team", ["teamId"]),

  settings: defineTable({
    key: v.string(),
    submissionsOpen: v.boolean(),
    /** Hackathon window (epoch ms). Both unset means no restriction. */
    eventStartsAt: v.optional(v.number()),
    eventEndsAt: v.optional(v.number()),
  }).index("by_key", ["key"]),

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
    generalGroup: v.optional(v.number()),
    techStack: v.optional(v.array(v.string())),
    techStackAt: v.optional(v.number()),
    techStackSource: v.optional(v.literal("repo")),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["submittedBy"])
    .index("by_status", ["status"])
    .index("by_status_and_general_group", ["status", "generalGroup"]),

  teamMembers: defineTable({
    teamId: v.id("teams"),
    userId: v.optional(v.id("users")),
    signupId: v.optional(v.id("signups")),
    identifierType: v.union(
      v.literal("email"),
      v.literal("github"),
      v.literal("twitter")
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

  teams: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    joinCode: v.optional(v.string()),
    repoUrl: v.optional(v.string()),
    repoUrls: v.optional(v.array(v.string())),
    /** Team logo uploaded by the owner, served as /api/files/<id>. */
    logoId: v.optional(v.id("_storage")),
    techStack: v.optional(v.array(v.string())),
    techStackAt: v.optional(v.number()),
    techStackSource: v.optional(v.literal("repo")),
    // GitHub feed polling: ETag for conditional requests, last poll time.
    githubEtag: v.optional(v.string()),
    githubPolledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_join_code", ["joinCode"])
    .index("by_logo", ["logoId"]),

  tracks: defineTable({
    slug: v.string(),
    label: v.string(),
    body: v.string(),
    note: v.string(),
    /** Challenge brief: markdown on /tracks/<slug>, or a lone http(s) URL opened in a new tab. */
    markdown: v.optional(v.string()),
    /** Sponsor logo: a path under /public (e.g. /tracks/maisa.png) or an absolute URL. */
    logoUrl: v.optional(v.string()),
    /** Sponsor website. */
    website: v.optional(v.string()),
    sortOrder: v.number(),
    active: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_active_and_sort", ["active", "sortOrder"]),

  /** Admin-defined participant categories; `sections` drives the tabs. See convex/lib/userTypes.ts. */
  userTypes: defineTable({
    slug: v.string(),
    label: v.string(),
    description: v.optional(v.string()),
    sections: sectionsValidator,
    isDefault: v.boolean(),
    sortOrder: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_default", ["isDefault"])
    .index("by_sort", ["sortOrder"]),

  users: defineTable({
    name: v.optional(v.string()),
    /**
     * External avatar URL (GitHub). An uploaded picture wins: `avatarBlobUrl`
     * first, then the legacy Convex `avatarId`.
     */
    image: v.optional(v.string()),
    /** Public Vercel Blob URL for an uploaded profile picture. */
    avatarBlobUrl: v.optional(v.string()),
    /** Small square copy of `avatarBlobUrl` for the participants map and lists. */
    avatarThumbBlobUrl: v.optional(v.string()),
    /**
     * Legacy Convex storage id, served as /api/files/<id>. Kept so photos
     * uploaded before Vercel Blob still resolve.
     */
    avatarId: v.optional(v.id("_storage")),
    /** Legacy small square copy of `avatarId` (convex/lib/photo.ts). */
    avatarThumbId: v.optional(v.id("_storage")),
    userTypeId: v.optional(v.id("userTypes")),
    /** Participant directory card; drives the connections graph. See convex/lib/directory.ts. */
    directory: v.optional(directoryValidator),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: roleValidator,
    signupId: v.optional(v.id("signups")),
    /** Contact number for the venue, E.164. Stored as typed (normalised), never verified. */
    phone: v.optional(v.string()),
    /**
     * Legacy SMS verification (removed). Kept optional so existing rows still
     * validate; `migrations.dropPhoneVerification` clears them, after which
     * these two lines can go.
     */
    phoneVerificationTime: v.optional(v.number()),
    phoneConfirmed: v.optional(v.boolean()),
    notificationConsent: v.boolean(),
    notificationConsentAt: v.optional(v.number()),
    termsAcceptedAt: v.optional(v.number()),
    attendanceStatus: v.union(
      v.literal("attending"),
      v.literal("cancelled"),
      v.literal("undecided")
    ),
    dietaryRestrictions: v.optional(v.string()),
    dietaryDetails: v.optional(v.string()),
    travelOrigin: v.optional(v.string()),
    onboardingComplete: v.boolean(),
    adminNotes: v.optional(v.string()),
    githubId: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    githubLinkedAt: v.optional(v.number()),
    /** User OAuth token from github.startLink. Never return from public queries. */
    githubAccessToken: v.optional(v.string()),
    /** X handle, lowercase without the @. Optional in onboarding; see users.setTwitterHandle. */
    twitterHandle: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_signup", ["signupId"])
    .index("by_role", ["role"])
    .index("by_attendance", ["attendanceStatus"])
    .index("by_github_id", ["githubId"])
    .index("by_github", ["githubUsername"])
    .index("by_avatar", ["avatarId"])
    .index("by_avatar_thumb", ["avatarThumbId"])
    .index("by_user_type", ["userTypeId"]),

  /** Pending `hackspain auth login` browser approvals. See convex/cliAuth.ts. */
  cliAuthRequests: defineTable({
    code: v.string(),
    secret: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved")),
    userId: v.optional(v.id("users")),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_expires", ["expiresAt"]),

  // Single-use tokens a signed-in CLI mints so `hackspain open` can sign the
  // browser in (convex/cliAuth.ts, /cli-auth/handoff).
  cliWebHandoffs: defineTable({
    token: v.string(),
    userId: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_expires", ["expiresAt"]),

  tvMessages: defineTable({
    text: v.string(),
    zone: v.union(
      v.literal("banner"),
      v.literal("left"),
      v.literal("right"),
      v.literal("ticker")
    ),
    order: v.number(),
    active: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_zone", ["zone", "order"]),

  tvWidgets: defineTable({
    ...tvWidgetFields,
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_z", ["z"]),

  tvLayouts: defineTable({
    name: v.string(),
    isLive: v.boolean(),
    widgets: v.array(tvWidgetValidator),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_live", ["isLive"]),

  judgingSettings: defineTable({
    key: v.string(),
    generalGroupCount: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  judgingScores: defineTable({
    submissionId: v.id("submissions"),
    judgeId: v.id("users"),
    contextKind: v.union(v.literal("general"), v.literal("track")),
    contextKey: v.string(),
    score: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_submission_context", ["submissionId", "contextKind", "contextKey"])
    .index("by_judge_context", ["judgeId", "contextKind", "contextKey"])
    .index("by_judge_submission", ["judgeId", "submissionId"])
    .index("by_context", ["contextKind", "contextKey"]),

  judgingAssignments: defineTable({
    userId: v.id("users"),
    contextKind: v.optional(v.union(v.literal("general"), v.literal("track"))),
    contextKey: v.optional(v.string()),
    /** Legacy general-group field. Prefer contextKind + contextKey. */
    group: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_context", ["contextKind", "contextKey"])
    .index("by_user_and_context", ["userId", "contextKind", "contextKey"])
    .index("by_group", ["group"])
    .index("by_user_and_group", ["userId", "group"]),
});
