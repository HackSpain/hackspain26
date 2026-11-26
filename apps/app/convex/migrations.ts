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
import { hasMemeTag } from "./lib/feedTabs";
import { urlOf } from "./lib/urls";
import { deleteUnreadTableRows } from "./lib/unreadTables";
import type { Id } from "./_generated/dataModel";
import { seedEditions } from "./lib/editions";
import {
  participationByEditionEmail,
  participationIsAccepted,
} from "./lib/participations";
import { defaultUserType } from "./lib/userTypes";

async function attachUserToParticipation(
  ctx: MutationCtx,
  email: string,
  participationId: Id<"participations">,
  fullName: string
): Promise<void> {
  const user = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .unique();
  if (!user) {
    return;
  }
  if (!user.name) {
    await ctx.db.patch(user._id, { name: fullName });
  }
  const row = await ctx.db.get(participationId);
  if (row && row.userId !== user._id) {
    await ctx.db.patch(participationId, { userId: user._id });
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
    const { edition2026 } = await seedEditions(ctx);
    const hacker =
      (await ctx.db
        .query("userTypes")
        .withIndex("by_slug", (q) => q.eq("slug", "hacker"))
        .unique()) ?? (await defaultUserType(ctx));
    if (!hacker) {
      throw new Error("No hay un rol Hacker para importar solicitudes");
    }
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
      const existing = await participationByEditionEmail(
        ctx,
        edition2026,
        email
      );
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
      let status:
        | "applied"
        | "accepted"
        | "confirmed"
        | "cancelled"
        | "waitlist"
        | "rejected"
        | "interested" = "applied";
      if (existing && participationIsAccepted(existing.status)) {
        status = existing.status;
      } else if (raw.accepted === true) {
        status = "accepted";
      }
      if (existing) {
        await ctx.db.patch(existing._id, {
          ...fields,
          dietaryDetails: optionalFields.dietaryDetails,
          dietaryRestrictions: optionalFields.dietaryRestrictions,
          status,
        });
        updated += 1;
        await attachUserToParticipation(
          ctx,
          email,
          existing._id,
          fields.fullName
        );
      } else {
        const participationId = await ctx.db.insert("participations", {
          ...fields,
          editionId: edition2026,
          onboardingComplete: false,
          roleId: hacker._id,
          status,
        });
        inserted += 1;
        await attachUserToParticipation(
          ctx,
          email,
          participationId,
          fields.fullName
        );
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

export const emptyUnreadTables = internalMutation({
  args: {},
  handler: async (ctx) => await deleteUnreadTableRows(ctx),
  returns: v.record(v.string(), v.number()),
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
    const untyped = ctx.db as GenericMutationCtx<AnyDataModel>["db"];
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
    const out: {
      userId: Id<"users">;
      avatarId: Id<"_storage">;
      url: string;
    }[] = [];
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
        editionId: pass.editionId,
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

/** Flags posts written before the feed had a #meme tab. Safe to run again. */
export const backfillMemeTag = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let flagged = 0;
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_kind_created", (q) => q.eq("kind", "post"))
      .collect();
    for (const post of posts) {
      if (!post.meme && hasMemeTag(post.text)) {
        await ctx.db.patch(post._id, { meme: true });
        flagged += 1;
      }
    }
    return flagged;
  },
});
