import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth, type Tokens } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import { ResendOTP } from "./ResendOTP";
import { STUB_CODE, emailOtpStubEnabled } from "./devOtp";
import { adminEmailAllowlist, normalizeEmail } from "./lib/normalize";
import { findSignupByEmail, findUserByEmail } from "./lib/auth";

// Redeems an approved CLI device code (convex/cliAuth.ts) for a session.
// Only /api/cli/auth/device/poll calls this, with the code plus the secret
// the CLI generated at start, so tokens never go to anyone else.
const CliDevice = ConvexCredentials<DataModel>({
  id: "cli-device",
  authorize: async (credentials, ctx) => {
    const code =
      typeof credentials.code === "string" ? credentials.code : "";
    const secret =
      typeof credentials.secret === "string" ? credentials.secret : "";
    if (!code || !secret) {
      return null;
    }
    const userId = await ctx.runMutation(internal.cliAuth.redeem, {
      code,
      secret,
    });
    return userId ? { userId } : null;
  },
});

// `signIn` below wraps the library action so a dev stub code can be swapped
// for the real one. The client always calls `auth:signIn`.
export const {
  auth,
  signIn: signInWithProvider,
  signOut,
  store,
  isAuthenticated,
} = convexAuth({
  providers: [ResendOTP, CliDevice],
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
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Convex Auth keeps one single-use code per account: a second "send code"
// (another tab, the CLI, an e2e run) replaces it and any verify attempt
// consumes it. The remembered code can therefore be dead by the time someone
// types the stub, which surfaces as "Could not verify code". Issue a fresh
// code right before swapping so the stub always matches the live one.
async function resolveStubCode(
  ctx: ActionCtx,
  provider: string | undefined,
  params: unknown,
): Promise<unknown> {
  if (!emailOtpStubEnabled() || !isRecord(params)) return params;
  if (provider !== ResendOTP.id) return params;
  if (params.code !== STUB_CODE || typeof params.email !== "string") return params;
  const email = params.email;
  await ctx.runAction(api.auth.signInWithProvider, {
    provider: ResendOTP.id,
    params: { email },
  });
  const code = await ctx.runQuery(internal.devOtp.lookup, { email });
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
    provider: v.optional(v.string()),
    params: v.optional(v.any()),
    verifier: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    calledBy: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SignInResult> => {
    const params: unknown = await resolveStubCode(ctx, args.provider, args.params);
    return await ctx.runAction(api.auth.signInWithProvider, { ...args, params });
  },
});
