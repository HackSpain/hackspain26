import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth } from "@convex-dev/auth/server";
import type { Tokens } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { ResendOTP } from "./ResendOTP";
import { STUB_CODE, emailOtpStubEnabled } from "./devOtp";
import { fail } from "./lib/errors";
import { isRecord } from "./lib/isRecord";
import { adminEmailAllowlist, normalizeEmail } from "./lib/normalize";
import {
  findSignupByEmail,
  findUserByEmail,
  resolvedLoginRole,
} from "./lib/auth";

// Redeems an approved CLI device code (convex/cliAuth.ts) for a session.
// Only /api/cli/auth/device/poll calls this, with the code plus the secret
// the CLI generated at start, so tokens never go to anyone else.
const CliDevice = ConvexCredentials<DataModel>({
  id: "cli-device",
  authorize: async (credentials, ctx) => {
    const code = typeof credentials.code === "string" ? credentials.code : "";
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

// Reverse direction: a signed-in CLI mints a single-use handoff token
// (cliAuth.startWebHandoff) and opens /cli-auth/handoff in the browser, whose
// page signs in with this provider. The Next.js auth proxy then sets the same
// cookies the email OTP login sets, so the browser never asks for a code.
const CliHandoff = ConvexCredentials<DataModel>({
  id: "cli-handoff",
  authorize: async (credentials, ctx) => {
    const token =
      typeof credentials.token === "string" ? credentials.token : "";
    if (!token) {
      return null;
    }
    const userId = await ctx.runMutation(internal.cliAuth.redeemWebHandoff, {
      token,
    });
    return userId ? { userId } : null;
  },
});

// Library `signIn` is re-exported as an internal action below so clients
// cannot skip the eligibility check on `auth:signIn`.
const {
  auth,
  signIn: librarySignIn,
  signOut,
  store,
  isAuthenticated,
} = convexAuth({
  providers: [ResendOTP, CliDevice, CliHandoff],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const rawEmail =
        typeof args.profile.email === "string" ? args.profile.email : "";
      const email = rawEmail ? normalizeEmail(rawEmail) : undefined;
      const allowlist = adminEmailAllowlist();
      const participation = email ? await findSignupByEmail(ctx, email) : null;
      const allowlisted = Boolean(email && allowlist.has(email));
      const role = resolvedLoginRole(undefined, allowlisted);

      const attachParticipation = async (
        userId: typeof args.existingUserId
      ) => {
        if (!userId || !participation || participation.userId === userId) {
          return;
        }
        await ctx.db.patch(participation._id, { userId });
      };

      if (args.existingUserId) {
        const existing = await ctx.db.get(args.existingUserId);
        if (!existing) {
          throw new Error("Usuario no encontrado");
        }
        await ctx.db.patch(args.existingUserId, {
          email: email ?? existing.email,
          name: existing.name ?? participation?.fullName,
          role: resolvedLoginRole(existing.role, allowlisted),
          emailVerificationTime:
            args.profile.emailVerified || args.type === "email"
              ? Date.now()
              : existing.emailVerificationTime,
        });
        await attachParticipation(args.existingUserId);
        return args.existingUserId;
      }

      if (email) {
        const byEmail = await findUserByEmail(ctx, email);
        if (byEmail) {
          await ctx.db.patch(byEmail._id, {
            name: byEmail.name ?? participation?.fullName,
            role: resolvedLoginRole(byEmail.role, allowlisted),
            emailVerificationTime: Date.now(),
          });
          await attachParticipation(byEmail._id);
          return byEmail._id;
        }
      }

      const userId = await ctx.db.insert("users", {
        email,
        name: participation?.fullName,
        admin: role === "admin",
        role,
        notificationConsent: false,
        emailVerificationTime: Date.now(),
      });
      await attachParticipation(userId);
      return userId;
    },
  },
});

export { auth, signOut, store, isAuthenticated };

type SignInResult = {
  redirect?: string;
  verifier?: string;
  tokens?: Tokens | null;
  started?: boolean;
  /** Set with `started: false` when the send step refused the email. */
  reason?: "UNREGISTERED";
};

type SignInArgs = {
  provider?: string;
  params?: unknown;
  verifier?: string;
  refreshToken?: string;
  calledBy?: string;
};

const signInArgs = {
  provider: v.optional(v.string()),
  params: v.optional(v.any()),
  verifier: v.optional(v.string()),
  refreshToken: v.optional(v.string()),
  calledBy: v.optional(v.string()),
};

async function runLibrarySignIn(
  ctx: ActionCtx,
  args: SignInArgs
): Promise<SignInResult> {
  if (!("_handler" in librarySignIn)) {
    throw new TypeError("Convex Auth signIn handler missing");
  }
  const handler = librarySignIn._handler;
  if (typeof handler !== "function") {
    throw new TypeError("Convex Auth signIn handler missing");
  }
  return await handler(ctx, args);
}

export const signInWithProvider = internalAction({
  args: signInArgs,
  handler: runLibrarySignIn,
});

// Convex Auth keeps one single-use code per account: a second "send code"
// (another tab, the CLI, an e2e run) replaces it and any verify attempt
// consumes it. The remembered code can therefore be dead by the time someone
// types the stub, which surfaces as "Could not verify code". Issue a fresh
// code right before swapping so the stub always matches the live one.
async function resolveStubCode(
  ctx: ActionCtx,
  provider: string | undefined,
  params: unknown
): Promise<unknown> {
  if (!emailOtpStubEnabled() || !isRecord(params)) {
    return params;
  }
  if (provider !== ResendOTP.id) {
    return params;
  }
  if (params.code !== STUB_CODE || typeof params.email !== "string") {
    return params;
  }
  const email = params.email;
  await ctx.runAction(internal.auth.signInWithProvider, {
    provider: ResendOTP.id,
    params: { email },
  });
  const code = await ctx.runQuery(internal.devOtp.lookup, { email });
  return code ? { ...params, code } : params;
}

const VERIFY_COPY = {
  BAD_OTP: "Ese código no es correcto. Revisa el email o pide uno nuevo.",
  OTP_EXPIRED: "Ese código ya no vale. Pide uno nuevo.",
  TOO_MANY_ATTEMPTS:
    "Demasiados intentos. Espera unos minutos y pide un código nuevo.",
} as const;

function isCouldNotVerify(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("Could not verify code")
  );
}

/**
 * Email OTP with a gentler edge than the library's. The send step checks
 * `login.eligibility` first: an unknown email gets `{ started: false,
 * reason }` back instead of an email and a "code sent" screen, and nothing
 * is logged as an error. The verify step turns the library's one
 * "Could not verify code" into a coded ConvexError (convex/lib/errors.ts)
 * the login page and CLI can explain. Other providers pass straight through.
 */
async function signInWithEmailOtp(
  ctx: ActionCtx,
  args: Record<string, unknown>,
  params: Record<string, unknown>,
  email: string
): Promise<SignInResult> {
  const forwarded = { ...args, params };
  if (params.code === undefined) {
    const eligible = await ctx.runQuery(internal.login.eligibility, { email });
    if (eligible === "unregistered") {
      return { started: false, reason: "UNREGISTERED" };
    }
    return await ctx.runAction(internal.auth.signInWithProvider, forwarded);
  }
  try {
    return await ctx.runAction(internal.auth.signInWithProvider, forwarded);
  } catch (caughtError) {
    if (caughtError instanceof ConvexError || !isCouldNotVerify(caughtError)) {
      throw caughtError;
    }
    const reason = await ctx.runQuery(internal.login.verifyFailure, { email });
    return fail(reason, VERIFY_COPY[reason]);
  }
}

export const signIn = action({
  args: signInArgs,
  handler: async (ctx, args): Promise<SignInResult> => {
    const params: unknown = await resolveStubCode(
      ctx,
      args.provider,
      args.params
    );
    if (
      args.provider === ResendOTP.id &&
      isRecord(params) &&
      typeof params.email === "string"
    ) {
      const email = normalizeEmail(params.email);
      return await signInWithEmailOtp(ctx, args, { ...params, email }, email);
    }
    return await ctx.runAction(internal.auth.signInWithProvider, {
      ...args,
      params,
    });
  },
});
