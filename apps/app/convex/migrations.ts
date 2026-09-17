import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import {
  ambassadorFieldsValidator,
  signupFieldsValidator,
} from "./lib/validators";
import {
  normalizeEmail,
  normalizeGithub,
  normalizeTwitter,
} from "./lib/normalize";
import { formatDietaryRestrictions } from "./lib/dietary";
import { urlOf, urlsFromRecord } from "./lib/urls";
import { findSignupByEmail, findUserByEmail } from "./lib/auth";
import { PARTICIPANT_SECTIONS, slugify } from "./lib/userTypes";
import type { Sections } from "./lib/userTypes";
import type { Doc, Id } from "./_generated/dataModel";

async function attachSignupToUser(
  ctx: MutationCtx,
  email: string,
  signupId: Id<"signups">,
  fullName: string,
  diet: { dietaryRestrictions?: string; dietaryDetails?: string }
): Promise<void> {
  const user = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .unique();
  if (!user) {
    return;
  }
  const patch: {
    signupId?: Id<"signups">;
    name?: string;
    dietaryRestrictions?: string;
    dietaryDetails?: string;
  } = {};
  if (!user.signupId) {
    patch.signupId = signupId;
    patch.name = user.name ?? fullName;
  }
  if (!user.dietaryRestrictions && diet.dietaryRestrictions) {
    patch.dietaryRestrictions = diet.dietaryRestrictions;
  }
  if (!user.dietaryDetails && diet.dietaryDetails) {
    patch.dietaryDetails = diet.dietaryDetails;
  }
  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(user._id, patch);
  }
}

function assertMigrationSecret(secret: string): void {
  const expected = process.env.MIGRATION_SECRET;
  if (!expected) {
    throw new Error("MIGRATION_SECRET is not set on the Convex deployment");
  }
  if (secret !== expected) {
    throw new Error("Unauthorized");
  }
}

export const importSignups = mutation({
  args: {
    secret: v.string(),
    signups: v.array(signupFieldsValidator),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    let inserted = 0;
    let updated = 0;
    for (const raw of args.signups) {
      const email = normalizeEmail(raw.email);
      const urls = raw.urls;
      const githubUrl = urlOf(urls, "github");
      const xUrl = urlOf(urls, "x");
      const githubUsername = githubUrl
        ? normalizeGithub(githubUrl) || undefined
        : undefined;
      const twitterHandle = xUrl
        ? normalizeTwitter(xUrl) || undefined
        : undefined;
      const existing = await ctx.db
        .query("signups")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      // Optional fields are only written when the source provides a value.
      // Patching with undefined would delete data already in Convex (for
      // example when the Neon source lacks a column) on every re-run.
      const optionalFields: {
        achievements?: string;
        freeTime?: string;
        ambassadorMotivation?: string;
        ambassadorStudyWhere?: string;
        dietaryRestrictions?: string;
        dietaryDetails?: string;
      } = {};
      if (raw.achievements) {
        optionalFields.achievements = raw.achievements;
      }
      if (raw.freeTime) {
        optionalFields.freeTime = raw.freeTime;
      }
      if (raw.ambassadorMotivation) {
        optionalFields.ambassadorMotivation = raw.ambassadorMotivation;
      }
      if (raw.ambassadorStudyWhere) {
        optionalFields.ambassadorStudyWhere = raw.ambassadorStudyWhere;
      }
      if (raw.dietaryRestrictionIds !== undefined) {
        optionalFields.dietaryRestrictions = formatDietaryRestrictions(
          raw.dietaryRestrictionIds
        );
      }
      if (raw.dietaryDetails) {
        optionalFields.dietaryDetails = raw.dietaryDetails;
      }
      const fields = {
        email,
        fullName: raw.fullName,
        urls,
        githubUsername,
        twitterHandle,
        wantsAmbassador: raw.wantsAmbassador,
        createdAt: raw.createdAt,
        neonId: raw.neonId,
        ...optionalFields,
      };
      if (existing) {
        await ctx.db.patch(existing._id, {
          ...fields,
          accepted: existing.accepted === true || raw.accepted === true,
        });
        updated += 1;
        await attachSignupToUser(ctx, email, existing._id, fields.fullName, {
          dietaryRestrictions: optionalFields.dietaryRestrictions,
          dietaryDetails: optionalFields.dietaryDetails,
        });
      } else {
        const signupId = await ctx.db.insert("signups", {
          ...fields,
          accepted: raw.accepted === true,
        });
        inserted += 1;
        await attachSignupToUser(ctx, email, signupId, fields.fullName, {
          dietaryRestrictions: optionalFields.dietaryRestrictions,
          dietaryDetails: optionalFields.dietaryDetails,
        });
      }
    }
    return { inserted, updated };
  },
  returns: v.object({
    inserted: v.number(),
    updated: v.number(),
  }),
});

export const importAmbassadors = mutation({
  args: {
    applications: v.array(ambassadorFieldsValidator),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    let inserted = 0;
    let updated = 0;
    for (const raw of args.applications) {
      const email = normalizeEmail(raw.email);
      const existing = await ctx.db
        .query("ambassadorApplications")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      const fields = {
        email,
        fullName: raw.fullName,
        institution: raw.institution,
        cityRegion: raw.cityRegion,
        urls: raw.urls,
        motivation: raw.motivation,
        outreachPlan: raw.outreachPlan,
        createdAt: raw.createdAt,
        neonId: raw.neonId,
      };
      if (existing) {
        await ctx.db.patch(existing._id, fields);
        updated += 1;
      } else {
        await ctx.db.insert("ambassadorApplications", fields);
        inserted += 1;
      }
    }
    return { inserted, updated };
  },
  returns: v.object({
    inserted: v.number(),
    updated: v.number(),
  }),
});

export const rewriteLegacyUrls = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    let signupsRewritten = 0;
    let ambassadorsRewritten = 0;

    for (const signup of await ctx.db.query("signups").collect()) {
      const leftoverFields = signup as typeof signup & {
        githubUrl?: string;
        xUrl?: string;
        linkedinUrl?: string;
        webUrl?: string;
      };
      const urls = urlsFromRecord(leftoverFields);
      const leftover =
        leftoverFields.githubUrl !== undefined ||
        leftoverFields.xUrl !== undefined ||
        leftoverFields.linkedinUrl !== undefined ||
        leftoverFields.webUrl !== undefined ||
        leftoverFields.urls === undefined;
      if (!leftover) {
        continue;
      }
      await ctx.db.replace(signup._id, {
        email: signup.email,
        fullName: signup.fullName,
        urls,
        githubUsername: signup.githubUsername,
        twitterHandle: signup.twitterHandle,
        achievements: signup.achievements,
        freeTime: signup.freeTime,
        wantsAmbassador: signup.wantsAmbassador,
        ambassadorMotivation: signup.ambassadorMotivation,
        ambassadorStudyWhere: signup.ambassadorStudyWhere,
        accepted: signup.accepted === true,
        dietaryRestrictions: signup.dietaryRestrictions,
        dietaryDetails: signup.dietaryDetails,
        createdAt: signup.createdAt,
        neonId: signup.neonId,
      });
      signupsRewritten += 1;
    }

    for (const application of await ctx.db
      .query("ambassadorApplications")
      .collect()) {
      const leftoverFields = application as typeof application & {
        githubUrl?: string;
        xUrl?: string;
        linkedinUrl?: string;
        webUrl?: string;
      };
      const urls = urlsFromRecord(leftoverFields);
      const leftover =
        leftoverFields.githubUrl !== undefined ||
        leftoverFields.xUrl !== undefined ||
        leftoverFields.linkedinUrl !== undefined ||
        leftoverFields.webUrl !== undefined ||
        leftoverFields.urls === undefined;
      if (!leftover) {
        continue;
      }
      await ctx.db.replace(application._id, {
        email: application.email,
        fullName: application.fullName,
        institution: application.institution,
        cityRegion: application.cityRegion,
        urls,
        motivation: application.motivation,
        outreachPlan: application.outreachPlan,
        createdAt: application.createdAt,
        neonId: application.neonId,
      });
      ambassadorsRewritten += 1;
    }

    return { signupsRewritten, ambassadorsRewritten };
  },
  returns: v.object({
    signupsRewritten: v.number(),
    ambassadorsRewritten: v.number(),
  }),
});

// ---------- Accreditations ----------
// Driven by scripts/import-accreditations.ts from the accreditation CSV.

export const accreditationTypeValidator = v.union(
  v.literal("hacker"),
  v.literal("mentor"),
  v.literal("sponsor")
);

export type AccreditationType = "hacker" | "mentor" | "sponsor";

const accreditationRowValidator = v.object({
  type: accreditationTypeValidator,
  fullName: v.string(),
  email: v.string(),
  organization: v.optional(v.string()),
  /** Dietary option ids as in convex/lib/dietary.ts (gluten_free, vegan, …). */
  dietaryRestrictionIds: v.optional(v.array(v.string())),
  dietaryDetails: v.optional(v.string()),
});

/** Same wording as the dev seed so the two deployments read alike. */
const ACCREDITATION_TYPES: Record<
  AccreditationType,
  { label: string; description: string; sections: Sections }
> = {
  hacker: {
    description: "Participa en la hackathon.",
    label: "Hacker",
    sections: PARTICIPANT_SECTIONS,
  },
  mentor: {
    description: "Acompaña a los equipos durante el evento.",
    label: "Mentor",
    sections: ["tracks", "participantes", "cli"],
  },
  sponsor: {
    description: "Partner del evento: retos y perks.",
    label: "Sponsor",
    sections: ["tracks", "perks", "participantes"],
  },
};

const accreditationReportValidator = v.object({
  /** Mentors and sponsors given a signup and an account so they can log in. */
  created: v.array(v.string()),
  /** Accounts whose type, name, diet or notes changed. */
  updated: v.array(v.string()),
  /** Accounts already matching the sheet. */
  unchanged: v.number(),
  /** Hackers with a signup but no account yet: the type applies once they log in as the default. */
  noAccount: v.array(v.string()),
  /** Hackers with neither a signup nor an account. Left alone; check the sheet. */
  unknown: v.array(v.string()),
  typesCreated: v.array(v.string()),
  dryRun: v.boolean(),
});

async function ensureAccreditationType(
  ctx: MutationCtx,
  type: AccreditationType,
  adminId: Id<"users">,
  dryRun: boolean,
  created: string[]
): Promise<Id<"userTypes"> | null> {
  const spec = ACCREDITATION_TYPES[type];
  const slug = slugify(spec.label);
  const existing = await ctx.db
    .query("userTypes")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (existing) {
    return existing._id;
  }
  created.push(spec.label);
  if (dryRun) {
    return null;
  }
  const all = await ctx.db.query("userTypes").withIndex("by_sort").collect();
  const hasDefault = all.some((row) => row.isDefault);
  const now = Date.now();
  return await ctx.db.insert("userTypes", {
    createdAt: now,
    createdBy: adminId,
    description: spec.description,
    isDefault: type === "hacker" && !hasDefault,
    label: spec.label,
    sections: spec.sections,
    slug,
    sortOrder: (all.at(-1)?.sortOrder ?? -1) + 1,
    updatedAt: now,
  });
}

function accreditationNotes(type: AccreditationType, organization?: string): string {
  const label = ACCREDITATION_TYPES[type].label;
  return organization ? `Acreditación: ${label} · ${organization}` : `Acreditación: ${label}`;
}

/**
 * Marks everyone on the accreditation sheet with their user type and gives
 * mentors and sponsors who never registered a signup plus an account, so the
 * email OTP login lets them in and they land with the right sections.
 * Idempotent: rerunning changes nothing once the sheet is applied. Hackers
 * without an account are only reported; the sheet cannot create them, and the
 * Hacker type is the default anyway.
 */
export const importAccreditations = mutation({
  args: {
    secret: v.string(),
    rows: v.array(accreditationRowValidator),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const dryRun = args.dryRun === true;
    const admin = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .first();
    if (!admin) {
      throw new Error("No admin user to own the user types");
    }

    const typesCreated: string[] = [];
    const typeIds = {} as Record<AccreditationType, Id<"userTypes"> | null>;
    for (const type of ["hacker", "mentor", "sponsor"] as const) {
      typeIds[type] = await ensureAccreditationType(ctx, type, admin._id, dryRun, typesCreated);
    }

    const created: string[] = [];
    const updated: string[] = [];
    const noAccount: string[] = [];
    const unknown: string[] = [];
    let unchanged = 0;
    const seen = new Set<string>();

    for (const row of args.rows) {
      const email = normalizeEmail(row.email);
      if (!email || seen.has(email)) {
        continue;
      }
      seen.add(email);
      const fullName = row.fullName.trim().replaceAll(/\s+/g, " ");
      const organization = row.organization?.trim() || undefined;
      const dietaryRestrictions = row.dietaryRestrictionIds?.length
        ? formatDietaryRestrictions(row.dietaryRestrictionIds)
        : undefined;
      const dietaryDetails = row.dietaryDetails?.trim() || undefined;
      const typeId = typeIds[row.type];
      const user = await findUserByEmail(ctx, email);
      const signup = await findSignupByEmail(ctx, email);

      if (user) {
        const patch: Partial<Doc<"users">> = {};
        // A dry run cannot know the id of a type it did not create; count the
        // assignment as a change.
        if (typeId === null || user.userTypeId !== typeId) {
          patch.userTypeId = typeId ?? undefined;
        }
        if (!user.name && fullName) {
          patch.name = fullName;
        }
        if (!user.signupId && signup) {
          patch.signupId = signup._id;
        }
        if (!user.dietaryRestrictions && dietaryRestrictions) {
          patch.dietaryRestrictions = dietaryRestrictions;
        }
        if (!user.dietaryDetails && dietaryDetails) {
          patch.dietaryDetails = dietaryDetails;
        }
        if (!user.adminNotes) {
          patch.adminNotes = accreditationNotes(row.type, organization);
        }
        if (Object.keys(patch).length === 0) {
          unchanged += 1;
          continue;
        }
        updated.push(email);
        if (!dryRun) {
          await ctx.db.patch(user._id, patch);
        }
        continue;
      }

      if (row.type === "hacker") {
        (signup ? noAccount : unknown).push(email);
        continue;
      }

      created.push(email);
      if (dryRun) {
        continue;
      }
      const now = Date.now();
      let signupId: Id<"signups">;
      if (signup) {
        signupId = signup._id;
        if (signup.accepted !== true) {
          await ctx.db.patch(signup._id, { accepted: true });
        }
      } else {
        signupId = await ctx.db.insert("signups", {
          accepted: true,
          createdAt: now,
          dietaryDetails,
          dietaryRestrictions,
          email,
          fullName,
          urls: [],
          wantsAmbassador: false,
        });
      }
      await ctx.db.insert("users", {
        adminNotes: accreditationNotes(row.type, organization),
        attendanceStatus: "attending",
        dietaryDetails,
        dietaryRestrictions,
        email,
        name: fullName,
        notificationConsent: false,
        onboardingComplete: false,
        phoneConfirmed: false,
        role: "user",
        signupId,
        userTypeId: typeId ?? undefined,
      });
    }

    return { created, dryRun, noAccount, typesCreated, unchanged, unknown, updated };
  },
  returns: accreditationReportValidator,
});
