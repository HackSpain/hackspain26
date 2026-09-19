import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { findSignupByEmail, findUserByEmail } from "./lib/auth";
import { adminEmailAllowlist, normalizeEmail } from "./lib/normalize";

/**
 * Email OTP login support for the `auth:signIn` wrapper (convex/auth.ts).
 * Convex Auth itself sends a code to any address and only reports
 * "Could not verify code" on failure. These queries let the wrapper refuse
 * unknown emails before a code goes out, and tell a wrong code apart from an
 * expired one or a locked account, so the login page and the CLI can say
 * something useful.
 */

export const OTP_PROVIDER = "resend-otp";

/** Mirrors @convex-dev/auth's default `signIn.maxFailedAttempsPerHour`. */
const MAX_FAILED_ATTEMPTS_PER_HOUR = 10;

export const eligibilityValidator = v.union(
  v.literal("ok"),
  v.literal("unregistered")
);

/**
 * Who may receive a code: anyone with a signup, an existing account, or an
 * email on ADMIN_EMAILS. Signups that are not accepted yet still get a code
 * and land on /pending, which explains the wait.
 */
export const eligibility = internalQuery({
  args: { email: v.string() },
  returns: eligibilityValidator,
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (adminEmailAllowlist().has(email)) {
      return "ok";
    }
    if (await findUserByEmail(ctx, email)) {
      return "ok";
    }
    if (await findSignupByEmail(ctx, email)) {
      return "ok";
    }
    return "unregistered";
  },
});

export const verifyFailureValidator = v.union(
  v.literal("TOO_MANY_ATTEMPTS"),
  v.literal("OTP_EXPIRED"),
  v.literal("BAD_OTP")
);

/**
 * Why a verify attempt just failed. Runs after the library rejected the
 * code, so its rate-limit row already counts this attempt. Convex Auth
 * deletes a code it found but could not accept (expired), keeps the live one
 * when the typed digits simply did not match, and refills attempts at
 * MAX_FAILED_ATTEMPTS_PER_HOUR per hour (dist/server/implementation/rateLimit.js).
 */
export const verifyFailure = internalQuery({
  args: { email: v.string() },
  returns: verifyFailureValidator,
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const now = Date.now();

    const limit = await ctx.db
      .query("authRateLimits")
      .withIndex("identifier", (q) => q.eq("identifier", email))
      .unique();
    if (limit) {
      const perMs = MAX_FAILED_ATTEMPTS_PER_HOUR / (60 * 60 * 1000);
      const attemptsLeft = Math.min(
        MAX_FAILED_ATTEMPTS_PER_HOUR,
        limit.attemptsLeft + (now - limit.lastAttemptTime) * perMs
      );
      if (attemptsLeft < 1) {
        return "TOO_MANY_ATTEMPTS";
      }
    }

    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", OTP_PROVIDER).eq("providerAccountId", email)
      )
      .unique();
    if (!account) {
      return "OTP_EXPIRED";
    }
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .collect();
    const live = codes.some((code) => code.expirationTime > now);
    return live ? "BAD_OTP" : "OTP_EXPIRED";
  },
});
