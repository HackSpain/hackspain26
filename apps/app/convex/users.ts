import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  authedMutation,
  authedQuery,
  onboardedMutation,
} from "./lib/customFunctions";
import { meValidator, signupPublicValidator } from "./lib/validators";
import { defaultedAttendance } from "./lib/attendance";
import { getSignupForUser, signupIsAccepted } from "./lib/auth";
import { fail } from "./lib/errors";
import { parseEventDetails } from "./lib/eventDetails";
import { normalizeGithub, normalizeTwitter } from "./lib/normalize";
import { urlOf, urlsFromRecord } from "./lib/urls";
import { membershipForUser } from "./lib/team";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export async function resolvePendingInvites(
  ctx: MutationCtx,
  userId: Id<"users">,
  email: string | undefined,
  signupId: Id<"signups"> | undefined,
  githubUsername: string | undefined,
  twitterHandle: string | undefined,
): Promise<void> {
  const candidates: Array<{
    type: "email" | "github" | "twitter";
    value: string;
  }> = [];
  if (email) candidates.push({ type: "email", value: email });
  if (githubUsername)
    candidates.push({ type: "github", value: githubUsername });
  if (twitterHandle) candidates.push({ type: "twitter", value: twitterHandle });

  const matches: Array<Doc<"teamMembers">> = [];
  for (const candidate of candidates) {
    const rows = await ctx.db
      .query("teamMembers")
      .withIndex("by_identifier", (q) =>
        q
          .eq("identifierType", candidate.type)
          .eq("identifier", candidate.value),
      )
      .collect();
    for (const row of rows) {
      if (row.userId && row.userId !== userId) continue;
      matches.push(row);
    }
  }

  const existing = await membershipForUser(ctx, userId);
  let teamId = existing?.teamId;
  if (!teamId) {
    const oldest = [...matches].sort((a, b) => a.createdAt - b.createdAt)[0];
    teamId = oldest?.teamId;
  }
  if (!teamId) return;

  let resolved = existing ?? null;
  for (const member of matches) {
    if (member.teamId !== teamId) continue;
    if (!resolved) {
      if (member.status !== "member" || member.userId !== userId) {
        await ctx.db.patch(member._id, {
          userId,
          signupId: member.signupId ?? signupId,
          status: "member",
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

export const me = query({
  args: {},
  returns: v.union(meValidator, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const signup = await getSignupForUser(ctx, user);
    return {
      _id: user._id,
      email: user.email,
      name: user.name ?? signup?.fullName,
      role: user.role,
      phone: user.phone,
      phoneConfirmed: user.phoneConfirmed,
      notificationConsent: user.notificationConsent,
      notificationConsentAt: user.notificationConsentAt,
      attendanceStatus: defaultedAttendance(
        user.attendanceStatus,
        user.onboardingComplete || user.role === "admin",
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
    };
  },
});

export const mySignup = authedQuery({
  args: {},
  returns: v.union(signupPublicValidator, v.null()),
  handler: async (ctx) => {
    const signup = await getSignupForUser(ctx, ctx.user);
    if (!signup) return null;
    return {
      fullName: signup.fullName,
      email: signup.email,
      urls: urlsFromRecord(signup),
      achievements: signup.achievements,
      freeTime: signup.freeTime,
      wantsAmbassador: signup.wantsAmbassador,
    };
  },
});

export const attachAfterLogin = authedMutation({
  args: {},
  returns: v.null(),
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
      signup?.twitterHandle ?? (xUrl ? normalizeTwitter(xUrl) : undefined),
    );
    return null;
  },
});

export const setName = authedMutation({
  args: { name: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const name = args.name.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 80) {
      fail("VALIDATION", "El nombre debe tener entre 2 y 80 caracteres");
    }
    await ctx.db.patch(ctx.user._id, { name });
    return name;
  },
});

export const setAttendance = onboardedMutation({
  args: {
    attendanceStatus: v.union(v.literal("attending"), v.literal("cancelled")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.user._id, {
      attendanceStatus: args.attendanceStatus,
    });
    return null;
  },
});

export const setNotificationConsent = onboardedMutation({
  args: { consent: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(ctx.user._id, {
      notificationConsent: args.consent,
      notificationConsentAt: Date.now(),
    });
    return null;
  },
});

export const updateEventDetails = onboardedMutation({
  args: {
    dietaryRestrictions: v.string(),
    dietaryDetails: v.optional(v.string()),
    travelOrigin: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const details = parseEventDetails(args);
    await ctx.db.patch(ctx.user._id, details);
    return null;
  },
});
