import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { authedMutation, profileMutation } from "./lib/customFunctions";
import { meValidator } from "./lib/validators";
import { defaultedAttendance } from "./lib/attendance";
import { isAdmin } from "./lib/auth";
import { currentEditionId } from "./lib/editions";
import { fail } from "./lib/errors";
import { parseEventDetails } from "./lib/eventDetails";
import { eventIsOpen, eventPhase, getEventWindow } from "./lib/eventWindow";
import { assertStoredImage, imagePathFor } from "./lib/files";
import {
  getCurrentParticipation,
  participationIsAccepted,
  participationIsRegistered,
} from "./lib/participations";
import { missingProfileFields } from "./lib/profile";
import { effectiveSections, userTypeFor } from "./lib/userTypes";
import {
  normalizeEmail,
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
  userId: Id<"users">
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user) {
    return;
  }
  const candidates: {
    type: "email" | "github" | "twitter";
    value: string;
  }[] = [];
  if (user.email && user.emailVerificationTime !== undefined) {
    candidates.push({ type: "email", value: normalizeEmail(user.email) });
  }
  if (user.githubUsername && user.githubLinkedAt !== undefined) {
    candidates.push({
      type: "github",
      value: normalizeGithub(user.githubUsername),
    });
  }
  if (user.twitterHandle && user.twitterLinkedAt !== undefined) {
    candidates.push({
      type: "twitter",
      value: normalizeTwitter(user.twitterHandle),
    });
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

  let editionId: Id<"editions"> | undefined;
  try {
    editionId = await currentEditionId(ctx);
  } catch {
    editionId = undefined;
  }
  const scoped: Doc<"teamMembers">[] = [];
  for (const row of matches) {
    if (editionId === undefined) {
      scoped.push(row);
      continue;
    }
    if (row.editionId === editionId) {
      scoped.push(row);
      continue;
    }
    const team = await ctx.db.get(row.teamId);
    if (!team || team.editionId === editionId) {
      scoped.push(row);
    }
  }

  const existing = await membershipForUser(ctx, userId, editionId);
  let teamId = existing?.teamId;
  if (!teamId) {
    const oldest = [...scoped].toSorted((a, b) => a.createdAt - b.createdAt)[0];
    teamId = oldest?.teamId;
  }
  if (!teamId) {
    return;
  }

  let resolved = existing ?? null;
  for (const member of scoped) {
    if (member.teamId !== teamId) {
      continue;
    }
    if (!resolved) {
      if (member.status !== "member" || member.userId !== userId) {
        await ctx.db.patch(member._id, {
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

export function avatarUrlFor(
  user: Pick<Doc<"users">, "avatarId" | "image">
): string | undefined {
  if (user.avatarId) {
    return imagePathFor(user.avatarId);
  }
  return user.image;
}

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
    const participation = await getCurrentParticipation(ctx, user);
    const type = await userTypeFor(ctx, user);
    const sections = effectiveSections(user, type);
    const window = await getEventWindow(ctx);
    const phase = eventPhase(window, Date.now());
    const onboarded =
      participation?.onboardingComplete === true || isAdmin(user);
    const profileMissing = missingProfileFields(user);
    const xUrl = urlOf(participation?.urls, "x");
    return {
      _id: user._id,
      email: user.email,
      event: {
        endsAt: window.endsAt,
        open: isAdmin(user) || eventIsOpen(phase),
        phase,
        startsAt: window.startsAt,
      },
      name: user.name ?? participation?.fullName,
      admin: isAdmin(user),
      role: user.role,
      avatarUrl: avatarUrlFor(user),
      canRemoveAvatar: Boolean(user.avatarId && user.image?.trim()),
      canJudge: sections.includes("judging"),
      sections,
      userType: type ? { label: type.label, slug: type.slug } : undefined,
      phone: user.phone,
      notificationConsent: user.notificationConsent,
      notificationConsentAt: user.notificationConsentAt,
      attendanceStatus: defaultedAttendance(
        participation?.attendanceStatus,
        onboarded
      ),
      dietaryRestrictions: participation?.dietaryRestrictions,
      dietaryDetails: participation?.dietaryDetails,
      travelOrigin: participation?.travelOrigin,
      onboardingComplete: onboarded,
      isRegistered: participationIsRegistered(participation?.status),
      accepted: participationIsAccepted(participation?.status),
      signupId: participation?._id,
      githubUsername: user.githubUsername ?? participation?.githubUsername,
      githubLinked: user.githubLinkedAt !== undefined,
      githubCanReadRepos: Boolean(user.githubAccessToken),
      profileComplete: profileMissing.length === 0,
      profileMissing,
      twitterHandle: user.twitterHandle,
      suggestedTwitterHandle:
        user.twitterHandle ??
        participation?.twitterHandle ??
        (xUrl ? normalizeTwitter(xUrl) || undefined : undefined),
    };
  },
  returns: v.union(meValidator, v.null()),
});

export const attachAfterLogin = authedMutation({
  args: {},
  handler: async (ctx) => {
    if (ctx.user.email) {
      const rows = await ctx.db
        .query("participations")
        .withIndex("by_email", (q) => q.eq("email", ctx.user.email ?? ""))
        .collect();
      for (const row of rows) {
        const patch: {
          fullName?: string;
          userId?: Id<"users">;
        } = {};
        if (row.userId !== ctx.user._id) {
          patch.userId = ctx.user._id;
        }
        if (!ctx.user.name && row.fullName) {
          patch.fullName = row.fullName;
        }
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(row._id, patch);
        }
      }
      const named = rows.find((row) => row.fullName);
      if (!ctx.user.name && named?.fullName) {
        await ctx.db.patch(ctx.user._id, { name: named.fullName });
      }
    }
    const participation = await getCurrentParticipation(ctx, ctx.user);
    if (
      participation &&
      participation.attendanceStatus !== "cancelled" &&
      participation.attendanceStatus !== "attending" &&
      (participation.onboardingComplete || isAdmin(ctx.user))
    ) {
      await ctx.db.patch(participation._id, {
        attendanceStatus: "attending",
      });
    }
    await resolvePendingInvites(ctx, ctx.user._id);
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
      await ctx.db.patch(ctx.user._id, {
        twitterHandle: undefined,
        twitterLinkedAt: undefined,
      });
      return null;
    }
    if (!TWITTER_HANDLE.test(handle)) {
      fail("VALIDATION", "Ese usuario de X no parece válido");
    }
    await ctx.db.patch(ctx.user._id, {
      twitterHandle: handle,
      ...(handle === ctx.user.twitterHandle
        ? {}
        : { twitterLinkedAt: undefined }),
    });
    return handle;
  },
  returns: v.union(v.string(), v.null()),
});

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
/** The browser-made 128px copy; anything bigger is not a thumbnail. */
const MAX_THUMB_BYTES = 256 * 1024;

async function assertImage(
  ctx: MutationCtx,
  imageId: Id<"_storage">,
  maxBytes: number
): Promise<void> {
  await assertStoredImage(
    ctx,
    imageId,
    maxBytes,
    "La foto no puede superar 2 MB"
  );
}

/** Upload target for a profile picture. POST the file there, then call setAvatar. */
export const generateAvatarUploadUrl = authedMutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
  returns: v.string(),
});

/**
 * `thumbId` is the small square copy the browser made of the same picture
 * (src/components/avatar-picker.tsx). Without it the map falls back to
 * resizing the full upload on every request, so the picker always sends one
 * when it can.
 */
export const setAvatar = authedMutation({
  args: { imageId: v.id("_storage"), thumbId: v.optional(v.id("_storage")) },
  handler: async (ctx, args) => {
    await assertImage(ctx, args.imageId, MAX_AVATAR_BYTES);
    if (args.thumbId) {
      await assertImage(ctx, args.thumbId, MAX_THUMB_BYTES);
    }
    const previous = ctx.user.avatarId;
    const previousThumb = ctx.user.avatarThumbId;
    await ctx.db.patch(ctx.user._id, {
      avatarId: args.imageId,
      avatarThumbId: args.thumbId,
    });
    if (previous && previous !== args.imageId) {
      await ctx.storage.delete(previous);
    }
    if (previousThumb && previousThumb !== args.thumbId) {
      await ctx.storage.delete(previousThumb);
    }
    return imagePathFor(args.imageId);
  },
  returns: v.string(),
});

/** Only while the GitHub avatar remains: a photo is required (convex/lib/profile.ts). */
export const removeAvatar = authedMutation({
  args: {},
  handler: async (ctx) => {
    const previous = ctx.user.avatarId;
    if (!previous) {
      return null;
    }
    if (!ctx.user.image?.trim()) {
      fail(
        "VALIDATION",
        "Sube otra foto antes de quitar esta: sin foto no puedes usar el panel"
      );
    }
    const previousThumb = ctx.user.avatarThumbId;
    await ctx.db.patch(ctx.user._id, {
      avatarId: undefined,
      avatarThumbId: undefined,
    });
    await ctx.storage.delete(previous);
    if (previousThumb) {
      await ctx.storage.delete(previousThumb);
    }
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
    const participation = await getCurrentParticipation(ctx, ctx.user);
    if (!participation) {
      throw new Error("No hay participación en la edición en curso");
    }
    await ctx.db.patch(participation._id, details);
    return null;
  },
  returns: v.null(),
});
