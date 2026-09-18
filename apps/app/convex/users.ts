import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  authedMutation,
  profileMutation,
} from "./lib/customFunctions";
import { meValidator } from "./lib/validators";
import { defaultedAttendance } from "./lib/attendance";
import { getSignupForUser, signupIsAccepted } from "./lib/auth";
import { fail } from "./lib/errors";
import { parseEventDetails } from "./lib/eventDetails";
import { eventIsOpen, eventPhase, getEventWindow } from "./lib/eventWindow";
import { imagePathFor } from "./lib/files";
import {
  MAX_AVATAR_BYTES,
  MAX_THUMB_BYTES,
  avatarUrlFor,
  hasUploadedAvatar,
  isVercelBlobUrl,
  storedBlobUrls,
} from "./lib/photo";
import { missingProfileFields } from "./lib/profile";
import { effectiveSections, userTypeFor } from "./lib/userTypes";
import {
  normalizeGithub,
  normalizePhone,
  normalizeTwitter,
  PHONE_ERROR,
} from "./lib/normalize";
import { urlOf } from "./lib/urls";
import { membershipForUser } from "./lib/team";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export async function resolvePendingInvites(
  ctx: MutationCtx,
  userId: Id<"users">,
  email: string | undefined,
  signupId: Id<"signups"> | undefined,
  githubUsername: string | undefined,
  twitterHandle: string | undefined
): Promise<void> {
  const candidates: {
    type: "email" | "github" | "twitter";
    value: string;
  }[] = [];
  if (email) {
    candidates.push({ type: "email", value: email });
  }
  if (githubUsername) {
    candidates.push({ type: "github", value: githubUsername });
  }
  if (twitterHandle) {
    candidates.push({ type: "twitter", value: twitterHandle });
  }

  const matches: Doc<"teamMembers">[] = [];
  for (const candidate of candidates) {
    const rows = await ctx.db
      .query("teamMembers")
      .withIndex("by_identifier", (q) =>
        q.eq("identifierType", candidate.type).eq("identifier", candidate.value)
      )
      .collect();
    for (const row of rows) {
      if (row.userId && row.userId !== userId) {
        continue;
      }
      matches.push(row);
    }
  }

  const existing = await membershipForUser(ctx, userId);
  let teamId = existing?.teamId;
  if (!teamId) {
    const oldest = [...matches].toSorted(
      (a, b) => a.createdAt - b.createdAt
    )[0];
    teamId = oldest?.teamId;
  }
  if (!teamId) {
    return;
  }

  let resolved = existing ?? null;
  for (const member of matches) {
    if (member.teamId !== teamId) {
      continue;
    }
    if (!resolved) {
      if (member.status !== "member" || member.userId !== userId) {
        await ctx.db.patch(member._id, {
          signupId: member.signupId ?? signupId,
          status: "member",
          userId,
        });
      }
      resolved = member;
      continue;
    }
    if (member._id !== resolved._id) {
      await ctx.db.delete(member._id);
    }
  }
}

export { avatarUrlFor };

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    const signup = await getSignupForUser(ctx, user);
    const type = await userTypeFor(ctx, user);
    const sections = effectiveSections(user, type);
    const window = await getEventWindow(ctx);
    const phase = eventPhase(window, Date.now());
    const profileMissing = missingProfileFields(user);
    const xUrl = urlOf(signup?.urls, "x");
    return {
      _id: user._id,
      email: user.email,
      event: {
        endsAt: window.endsAt,
        open: user.role === "admin" || eventIsOpen(phase),
        phase,
        startsAt: window.startsAt,
      },
      name: user.name ?? signup?.fullName,
      role: user.role,
      avatarUrl: avatarUrlFor(user),
      canRemoveAvatar: hasUploadedAvatar(user) && Boolean(user.image?.trim()),
      canJudge: sections.includes("judging"),
      sections,
      userType: type ? { label: type.label, slug: type.slug } : undefined,
      phone: user.phone,
      notificationConsent: user.notificationConsent,
      notificationConsentAt: user.notificationConsentAt,
      attendanceStatus: defaultedAttendance(
        user.attendanceStatus,
        user.onboardingComplete || user.role === "admin"
      ),
      dietaryRestrictions: user.dietaryRestrictions,
      dietaryDetails: user.dietaryDetails,
      travelOrigin: user.travelOrigin,
      onboardingComplete: user.onboardingComplete,
      isRegistered: signup !== null,
      accepted: signupIsAccepted(signup),
      signupId: user.signupId ?? signup?._id,
      githubUsername: user.githubUsername ?? signup?.githubUsername,
      githubLinked: user.githubLinkedAt !== undefined,
      githubCanReadRepos: Boolean(user.githubAccessToken),
      profileComplete: profileMissing.length === 0,
      profileMissing,
      twitterHandle: user.twitterHandle,
      suggestedTwitterHandle:
        user.twitterHandle ??
        signup?.twitterHandle ??
        (xUrl ? normalizeTwitter(xUrl) || undefined : undefined),
    };
  },
  returns: v.union(meValidator, v.null()),
});

export const attachAfterLogin = authedMutation({
  args: {},
  handler: async (ctx) => {
    const signup = await getSignupForUser(ctx, ctx.user);
    const patch: {
      signupId?: Id<"signups">;
      name?: string;
      attendanceStatus?: "attending";
    } = {};
    if (signup && ctx.user.signupId !== signup._id) {
      patch.signupId = signup._id;
      patch.name = ctx.user.name ?? signup.fullName;
    }
    if (
      (ctx.user.onboardingComplete || ctx.user.role === "admin") &&
      ctx.user.attendanceStatus !== "cancelled" &&
      ctx.user.attendanceStatus !== "attending"
    ) {
      patch.attendanceStatus = "attending";
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(ctx.user._id, patch);
    }
    const githubUrl = urlOf(signup?.urls, "github");
    const xUrl = urlOf(signup?.urls, "x");
    await resolvePendingInvites(
      ctx,
      ctx.user._id,
      ctx.user.email,
      signup?._id ?? ctx.user.signupId,
      ctx.user.githubUsername ??
        signup?.githubUsername ??
        (githubUrl ? normalizeGithub(githubUrl) : undefined),
      signup?.twitterHandle ?? (xUrl ? normalizeTwitter(xUrl) : undefined)
    );
    return null;
  },
  returns: v.null(),
});

export const setName = authedMutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const name = args.name.trim().replaceAll(/\s+/g, " ");
    if (name.length < 2 || name.length > 80) {
      fail("VALIDATION", "El nombre debe tener entre 2 y 80 caracteres");
    }
    await ctx.db.patch(ctx.user._id, { name });
    return name;
  },
  returns: v.string(),
});

/** Contact number for the venue. Normalised to E.164, never verified. */
export const setPhone = authedMutation({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const phone = normalizePhone(args.phone);
    if (!phone) {
      fail("VALIDATION", PHONE_ERROR);
    }
    await ctx.db.patch(ctx.user._id, { phone });
    return phone;
  },
  returns: v.string(),
});

const TWITTER_HANDLE = /^[a-z0-9_]{1,15}$/;

/** Empty clears the handle. Accepts "@ana", "ana" or an x.com / twitter.com URL. */
export const setTwitterHandle = authedMutation({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    const handle = normalizeTwitter(args.handle);
    if (!handle) {
      await ctx.db.patch(ctx.user._id, { twitterHandle: undefined });
      return null;
    }
    if (!TWITTER_HANDLE.test(handle)) {
      fail("VALIDATION", "Ese usuario de X no parece válido");
    }
    await ctx.db.patch(ctx.user._id, { twitterHandle: handle });
    const signup = await getSignupForUser(ctx, ctx.user);
    await resolvePendingInvites(
      ctx,
      ctx.user._id,
      ctx.user.email,
      signup?._id ?? ctx.user.signupId,
      ctx.user.githubUsername ?? signup?.githubUsername,
      handle
    );
    return handle;
  },
  returns: v.union(v.string(), v.null()),
});

async function assertImage(
  ctx: MutationCtx,
  imageId: Id<"_storage">,
  maxBytes: number
): Promise<void> {
  const meta = await ctx.db.system.get(imageId);
  if (!meta) {
    fail("NOT_FOUND", "La imagen no se ha subido");
  }
  if (!meta.contentType?.startsWith("image/")) {
    fail("VALIDATION", "Solo se admiten imágenes");
  }
  if (meta.size > maxBytes) {
    fail("VALIDATION", "La foto no puede superar 2 MB");
  }
}

async function deleteStoredFiles(
  ctx: MutationCtx,
  avatarId: Id<"_storage"> | undefined,
  avatarThumbId: Id<"_storage"> | undefined
): Promise<void> {
  if (avatarId) {
    await ctx.storage.delete(avatarId);
  }
  if (avatarThumbId) {
    await ctx.storage.delete(avatarThumbId);
  }
}

function requireBlobUrl(url: string): string {
  const trimmed = url.trim();
  if (!isVercelBlobUrl(trimmed)) {
    fail("VALIDATION", "La imagen no se ha subido");
  }
  return trimmed;
}

const avatarWriteReturn = v.object({
  previousBlobUrls: v.array(v.string()),
  url: v.string(),
});

/**
 * Upload target for a legacy Convex storage picture. New uploads go through
 * POST /api/avatar (Vercel Blob) and then setAvatar with `blobUrl`.
 */
export const generateAvatarUploadUrl = authedMutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
  returns: v.string(),
});

/**
 * Attach a profile picture. The dashboard sends public Vercel Blob URLs
 * (`blobUrl`, optional `thumbBlobUrl`). `imageId` / `thumbId` remain for
 * photos that were still uploaded to Convex storage.
 *
 * The browser-made 128px copy (src/components/avatar-picker.tsx) is what the
 * participants map draws; without it the map falls back to the full image
 * (Blob) or the resizing file route (legacy Convex).
 */
export const setAvatar = authedMutation({
  args: {
    blobUrl: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    thumbBlobUrl: v.optional(v.string()),
    thumbId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const previousBlobUrls = storedBlobUrls(ctx.user);
    const previous = ctx.user.avatarId;
    const previousThumb = ctx.user.avatarThumbId;

    if (args.blobUrl !== undefined) {
      const blobUrl = requireBlobUrl(args.blobUrl);
      const thumbBlobUrl =
        args.thumbBlobUrl === undefined
          ? undefined
          : requireBlobUrl(args.thumbBlobUrl);
      await ctx.db.patch(ctx.user._id, {
        avatarBlobUrl: blobUrl,
        avatarId: undefined,
        avatarThumbBlobUrl: thumbBlobUrl,
        avatarThumbId: undefined,
      });
      await deleteStoredFiles(ctx, previous, previousThumb);
      return {
        previousBlobUrls: previousBlobUrls.filter(
          (url) => url !== blobUrl && url !== thumbBlobUrl
        ),
        url: blobUrl,
      };
    }

    if (args.imageId === undefined) {
      fail("VALIDATION", "La imagen no se ha subido");
    }
    await assertImage(ctx, args.imageId, MAX_AVATAR_BYTES);
    if (args.thumbId) {
      await assertImage(ctx, args.thumbId, MAX_THUMB_BYTES);
    }
    await ctx.db.patch(ctx.user._id, {
      avatarBlobUrl: undefined,
      avatarId: args.imageId,
      avatarThumbBlobUrl: undefined,
      avatarThumbId: args.thumbId,
    });
    if (previous && previous !== args.imageId) {
      await ctx.storage.delete(previous);
    }
    if (previousThumb && previousThumb !== args.thumbId) {
      await ctx.storage.delete(previousThumb);
    }
    return {
      previousBlobUrls,
      url: imagePathFor(args.imageId),
    };
  },
  returns: avatarWriteReturn,
});

/** Only while the GitHub avatar remains: a photo is required (convex/lib/profile.ts). */
export const removeAvatar = authedMutation({
  args: {},
  handler: async (ctx) => {
    if (!hasUploadedAvatar(ctx.user)) {
      return { previousBlobUrls: [] };
    }
    if (!ctx.user.image?.trim()) {
      fail(
        "VALIDATION",
        "Sube otra foto antes de quitar esta: sin foto no puedes usar el panel"
      );
    }
    const previousBlobUrls = storedBlobUrls(ctx.user);
    const previous = ctx.user.avatarId;
    const previousThumb = ctx.user.avatarThumbId;
    await ctx.db.patch(ctx.user._id, {
      avatarBlobUrl: undefined,
      avatarId: undefined,
      avatarThumbBlobUrl: undefined,
      avatarThumbId: undefined,
    });
    await deleteStoredFiles(ctx, previous, previousThumb);
    return { previousBlobUrls };
  },
  returns: v.object({ previousBlobUrls: v.array(v.string()) }),
});

export const setAttendance = profileMutation({
  args: {
    attendanceStatus: v.union(v.literal("attending"), v.literal("cancelled")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.user._id, {
      attendanceStatus: args.attendanceStatus,
    });
    return null;
  },
  returns: v.null(),
});

export const setNotificationConsent = profileMutation({
  args: { consent: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.user._id, {
      notificationConsent: args.consent,
      notificationConsentAt: Date.now(),
    });
    return null;
  },
  returns: v.null(),
});

export const updateEventDetails = profileMutation({
  args: {
    dietaryDetails: v.optional(v.string()),
    dietaryRestrictions: v.string(),
    travelOrigin: v.string(),
  },
  handler: async (ctx, args) => {
    const details = parseEventDetails(args);
    await ctx.db.patch(ctx.user._id, details);
    return null;
  },
  returns: v.null(),
});
