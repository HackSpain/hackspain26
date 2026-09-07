import { convexAuth } from "@convex-dev/auth/server";
import type { Tokens } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { ResendOTP } from "./ResendOTP";
import { STUB_CODE, emailOtpStubEnabled } from "./devOtp";
import { adminEmailAllowlist, normalizeEmail } from "./lib/normalize";
import { findSignupByEmail, findUserByEmail } from "./lib/auth";

// `signIn` below wraps the library action so a dev stub code can be swapped
// for the real one. The client always calls `auth:signIn`.
export const {
  auth,
  signIn: signInWithProvider,
  signOut,
  store,
  isAuthenticated,
} = convexAuth({
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const rawEmail =
        typeof args.profile.email === "string" ? args.profile.email : "";
      const email = rawEmail ? normalizeEmail(rawEmail) : undefined;
      const allowlist = adminEmailAllowlist();
      const signup = email ? await findSignupByEmail(ctx, email) : null;
      const role = email && allowlist.has(email) ? "admin" : "user";

      if (args.existingUserId) {
        const existing = await ctx.db.get(args.existingUserId);
        if (!existing) {
          throw new Error("Usuario no encontrado");
        }
        await ctx.db.patch(args.existingUserId, {
          email: email ?? existing.email,
          name: existing.name ?? signup?.fullName,
          signupId: existing.signupId ?? signup?._id,
          dietaryRestrictions:
            existing.dietaryRestrictions ?? signup?.dietaryRestrictions,
          dietaryDetails: existing.dietaryDetails ?? signup?.dietaryDetails,
          role: existing.role === "admin" ? "admin" : role,
          emailVerificationTime:
            args.profile.emailVerified || args.type === "email"
              ? Date.now()
              : existing.emailVerificationTime,
        });
        return args.existingUserId;
      }

      if (email) {
        const byEmail = await findUserByEmail(ctx, email);
        if (byEmail) {
          await ctx.db.patch(byEmail._id, {
            name: byEmail.name ?? signup?.fullName,
            signupId: byEmail.signupId ?? signup?._id,
            dietaryRestrictions:
              byEmail.dietaryRestrictions ?? signup?.dietaryRestrictions,
            dietaryDetails: byEmail.dietaryDetails ?? signup?.dietaryDetails,
            role: byEmail.role === "admin" ? "admin" : role,
            emailVerificationTime: Date.now(),
          });
          return byEmail._id;
        }
      }

      return await ctx.db.insert("users", {
        email,
        name: signup?.fullName,
        role,
        signupId: signup?._id,
        dietaryRestrictions: signup?.dietaryRestrictions,
        dietaryDetails: signup?.dietaryDetails,
        phoneConfirmed: false,
        notificationConsent: false,
        attendanceStatus: "attending",
        onboardingComplete: false,
        emailVerificationTime: Date.now(),
      });
    },
  },
  providers: [ResendOTP],
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function resolveStubCode(
  ctx: ActionCtx,
  params: unknown
): Promise<unknown> {
  if (!emailOtpStubEnabled() || !isRecord(params)) {
    return params;
  }
  if (params.code !== STUB_CODE || typeof params.email !== "string") {
    return params;
  }
  const code = await ctx.runQuery(internal.devOtp.lookup, {
    email: params.email,
  });
  return code ? { ...params, code } : params;
}

type SignInResult = {
  redirect?: string;
  verifier?: string;
  tokens?: Tokens | null;
  started?: boolean;
};

export const signIn = action({
  args: {
    calledBy: v.optional(v.string()),
    params: v.optional(v.any()),
    provider: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    verifier: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SignInResult> => {
    const params: unknown = await resolveStubCode(ctx, args.params);
    return await ctx.runAction(api.auth.signInWithProvider, {
      ...args,
      params,
    });
  },
});
