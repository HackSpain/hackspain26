import type { AnyDataModel, GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
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
import type { Id } from "./_generated/dataModel";

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

/**
 * SMS verification was removed; the phone itself stays. Clears the legacy
 * `phoneConfirmed` and `phoneVerificationTime` fields on `users` and empties
 * the old `phoneChallenges` table (no longer in the schema) so the two
 * optional fields can be dropped from `schema.ts` afterwards.
 */
export const dropPhoneVerification = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    let usersCleared = 0;
    for (const user of await ctx.db.query("users").collect()) {
      if (
        user.phoneConfirmed === undefined &&
        user.phoneVerificationTime === undefined
      ) {
        continue;
      }
      await ctx.db.patch(user._id, {
        phoneConfirmed: undefined,
        phoneVerificationTime: undefined,
      });
      usersCleared += 1;
    }
    // The table is gone from the schema, so it is queried untyped.
    const untyped = ctx.db as unknown as GenericMutationCtx<AnyDataModel>["db"];
    let challengesDeleted = 0;
    for (const row of await untyped.query("phoneChallenges").collect()) {
      await untyped.delete(row._id);
      challengesDeleted += 1;
    }
    return { usersCleared, challengesDeleted };
  },
  returns: v.object({
    usersCleared: v.number(),
    challengesDeleted: v.number(),
  }),
});

/**
 * Backfill for profile-picture thumbnails (convex/lib/photo.ts). Uploads
 * made before the picker produced its own copy have `avatarId` but no
 * `avatarThumbId`; scripts/backfill-avatar-thumbnails.ts resizes each one
 * locally with sharp and stores the result through these three endpoints.
 * Guarded by MIGRATION_SECRET like the Neon import.
 */
export const listAvatarsWithoutThumbnail = query({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const users = await ctx.db.query("users").collect();
    const out: { userId: Id<"users">; avatarId: Id<"_storage">; url: string }[] =
      [];
    for (const user of users) {
      if (!user.avatarId || user.avatarThumbId) {
        continue;
      }
      const url = await ctx.storage.getUrl(user.avatarId);
      if (url) {
        out.push({ avatarId: user.avatarId, url, userId: user._id });
      }
    }
    return out;
  },
  returns: v.array(
    v.object({
      avatarId: v.id("_storage"),
      url: v.string(),
      userId: v.id("users"),
    })
  ),
});

export const avatarThumbnailUploadUrl = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    return await ctx.storage.generateUploadUrl();
  },
  returns: v.string(),
});

/** Attaches the thumbnail, unless the person changed their picture meanwhile. */
export const setAvatarThumbnail = mutation({
  args: {
    avatarId: v.id("_storage"),
    secret: v.string(),
    thumbId: v.id("_storage"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const user = await ctx.db.get(args.userId);
    if (!user || user.avatarId !== args.avatarId || user.avatarThumbId) {
      await ctx.storage.delete(args.thumbId);
      return false;
    }
    await ctx.db.patch(user._id, { avatarThumbId: args.thumbId });
    return true;
  },
  returns: v.boolean(),
});

/** Run with the old optional fields still in the deployed schema, then remove them. */
export const dropCheckInMetadata = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let cleared = 0;
    for (const pass of await ctx.db.query("eventPasses").collect()) {
      if (!("checkedInBy" in pass) && !("checkedInVia" in pass)) {
        continue;
      }
      await ctx.db.replace(pass._id, {
        userId: pass.userId,
        signupId: pass.signupId,
        code: pass.code,
        status: pass.status,
        codeSentAt: pass.codeSentAt,
        checkedInAt: pass.checkedInAt,
        createdAt: pass.createdAt,
        updatedAt: pass.updatedAt,
      });
      cleared += 1;
    }
    return cleared;
  },
});
