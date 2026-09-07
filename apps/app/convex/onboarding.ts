import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { acceptedMutation, acceptedQuery } from "./lib/customFunctions";
import { defaultedAttendance } from "./lib/attendance";
import { getSignupForUser } from "./lib/auth";
import { attendanceValidator } from "./lib/validators";
import {
  generateNumericCode,
  normalizePhone,
  sha256Hex,
} from "./lib/normalize";

const PHONE_CODE_TTL_MS = 10 * 60 * 1000;
const PHONE_MAX_ATTEMPTS = 5;

type TwilioConfig = { sid: string; token: string; from: string };

function twilioEnv(): { config: TwilioConfig | null; partial: boolean } {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (sid && token && from) {
    return { config: { from, sid, token }, partial: false };
  }
  return { config: null, partial: Boolean(sid || token || from) };
}

function requireTwilio(): TwilioConfig {
  const { config, partial } = twilioEnv();
  if (!config) {
    throw new Error(
      partial
        ? "Twilio is partially configured: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER together"
        : "Twilio is not configured"
    );
  }
  return config;
}

export const status = acceptedQuery({
  args: {},
  handler: async (ctx) => {
    const signup = await getSignupForUser(ctx, ctx.user);
    return {
      phone: ctx.user.phone,
      phoneConfirmed: ctx.user.phoneConfirmed,
      notificationConsent: ctx.user.notificationConsent,
      attendanceStatus: defaultedAttendance(
        ctx.user.attendanceStatus,
        ctx.user.onboardingComplete || ctx.user.role === "admin"
      ),
      dietaryRestrictions:
        ctx.user.dietaryRestrictions ?? signup?.dietaryRestrictions,
      dietaryDetails: ctx.user.dietaryDetails ?? signup?.dietaryDetails,
      travelOrigin: ctx.user.travelOrigin,
      onboardingComplete: ctx.user.onboardingComplete,
      smsConfigured: twilioEnv().config !== null,
    };
  },
  returns: v.object({
    phone: v.optional(v.string()),
    phoneConfirmed: v.boolean(),
    notificationConsent: v.boolean(),
    attendanceStatus: attendanceValidator,
    dietaryRestrictions: v.optional(v.string()),
    dietaryDetails: v.optional(v.string()),
    travelOrigin: v.optional(v.string()),
    onboardingComplete: v.boolean(),
    smsConfigured: v.boolean(),
  }),
});

export const requestPhoneCode = acceptedMutation({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const phone = normalizePhone(args.phone);
    if (!phone) {
      throw new Error(
        "Introduce un teléfono válido en formato E.164, como +34600111222"
      );
    }

    const twilio = twilioEnv();
    if (twilio.partial) {
      throw new Error(
        "Twilio is partially configured: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER together"
      );
    }
    const stubAllowed = process.env.ALLOW_PHONE_STUB === "true";
    if (!twilio.config && !stubAllowed) {
      throw new Error("El SMS no está configurado");
    }

    const existing = await ctx.db
      .query("phoneChallenges")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    const code = generateNumericCode(6);
    const codeHash = await sha256Hex(`${ctx.user._id}:${phone}:${code}`);
    await ctx.db.insert("phoneChallenges", {
      userId: ctx.user._id,
      phone,
      codeHash,
      expiresAt: Date.now() + PHONE_CODE_TTL_MS,
      attempts: 0,
    });

    if (twilio.config) {
      await ctx.scheduler.runAfter(0, internal.onboarding.sendPhoneCode, {
        to: phone,
        code,
      });
      return { delivery: "sms" as const };
    }

    console.log(`[phone] Stub OTP for ${phone}: ${code}`);
    return { delivery: "stub" as const, debugCode: code };
  },
  returns: v.object({
    delivery: v.union(v.literal("sms"), v.literal("stub")),
    debugCode: v.optional(v.string()),
  }),
});

export const sendPhoneCode = internalAction({
  args: { code: v.string(), to: v.string() },
  handler: async (_ctx, args) => {
    const twilio = requireTwilio();
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilio.sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${twilio.sid}:${twilio.token}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: args.to,
          From: twilio.from,
          Body: `Your HackSpain confirmation code is ${args.code}. It expires in 10 minutes.`,
        }).toString(),
      }
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Twilio send failed (${response.status}): ${detail}`);
    }
    return null;
  },
  returns: v.null(),
});

export const verifyFailureValidator = v.union(
  v.literal("no_challenge"),
  v.literal("expired"),
  v.literal("too_many_attempts"),
  v.literal("incorrect")
);

// Failures are returned (not thrown) so the attempt counter and challenge
// deletes commit — Convex rolls back all writes when a mutation throws.
export const verifyPhoneCode = acceptedMutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const challenge = await ctx.db
      .query("phoneChallenges")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .unique();
    if (!challenge) {
      return { ok: false as const, reason: "no_challenge" as const };
    }
    if (challenge.expiresAt < Date.now()) {
      await ctx.db.delete(challenge._id);
      return { ok: false as const, reason: "expired" as const };
    }
    if (challenge.attempts >= PHONE_MAX_ATTEMPTS) {
      await ctx.db.delete(challenge._id);
      return { ok: false as const, reason: "too_many_attempts" as const };
    }

    const expected = await sha256Hex(
      `${ctx.user._id}:${challenge.phone}:${args.code.trim()}`
    );
    if (expected !== challenge.codeHash) {
      const attempts = challenge.attempts + 1;
      if (attempts >= PHONE_MAX_ATTEMPTS) {
        await ctx.db.delete(challenge._id);
        return { ok: false as const, reason: "too_many_attempts" as const };
      }
      await ctx.db.patch(challenge._id, { attempts });
      return { ok: false as const, reason: "incorrect" as const };
    }

    await ctx.db.patch(ctx.user._id, {
      phone: challenge.phone,
      phoneConfirmed: true,
      phoneVerificationTime: Date.now(),
    });
    await ctx.db.delete(challenge._id);
    return { ok: true as const };
  },
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({ ok: v.literal(false), reason: verifyFailureValidator })
  ),
});

export const confirmDetails = acceptedMutation({
  args: {
    consent: v.boolean(),
    termsAccepted: v.boolean(),
    travelOrigin: v.string(),
  },
  handler: async (ctx, args) => {
    if (!ctx.user.phoneConfirmed) {
      throw new Error("Confirma el teléfono primero");
    }
    if (!args.termsAccepted) {
      throw new Error("Acepta los términos para continuar");
    }
    const travelOrigin = args.travelOrigin.trim();
    if (!travelOrigin) {
      throw new Error("Dinos desde dónde viajas");
    }
    const signup = await getSignupForUser(ctx, ctx.user);
    const dietaryRestrictions =
      ctx.user.dietaryRestrictions?.trim() ||
      signup?.dietaryRestrictions?.trim() ||
      "Ninguna";
    const dietaryDetails =
      ctx.user.dietaryDetails?.trim() ||
      signup?.dietaryDetails?.trim() ||
      undefined;
    await ctx.db.patch(ctx.user._id, {
      dietaryRestrictions,
      dietaryDetails,
      travelOrigin,
      notificationConsent: args.consent,
      notificationConsentAt: Date.now(),
      termsAcceptedAt: Date.now(),
      attendanceStatus: "attending",
      onboardingComplete: true,
    });
    return null;
  },
  returns: v.null(),
});
