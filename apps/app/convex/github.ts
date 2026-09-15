import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { authedMutation } from "./lib/customFunctions";
import { getSignupForUser } from "./lib/auth";
import { resolvePendingInvites } from "./users";

const STATE_TTL_MS = 10 * 60 * 1000;

export function githubRedirectUri(): string {
  const site = process.env.CONVEX_SITE_URL;
  if (!site) {
    throw new Error("CONVEX_SITE_URL no está configurada");
  }
  return `${site.replace(/\/$/, "")}/github/callback`;
}

function randomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const startLink = authedMutation({
  args: {},
  handler: async (ctx) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      throw new Error("La vinculación con GitHub no está configurada");
    }
    const previous = await ctx.db
      .query("githubLinkStates")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();
    for (const row of previous) {
      await ctx.db.delete(row._id);
    }
    const state = randomState();
    await ctx.db.insert("githubLinkStates", {
      userId: ctx.user._id,
      state,
      expiresAt: Date.now() + STATE_TTL_MS,
    });
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", githubRedirectUri());
    url.searchParams.set("scope", "read:user repo");
    url.searchParams.set("state", state);
    return { url: url.toString() };
  },
  returns: v.object({ url: v.string() }),
});

export const unlink = authedMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.db.patch(ctx.user._id, {
      githubAccessToken: undefined,
      githubId: undefined,
      githubUsername: undefined,
      githubLinkedAt: undefined,
    });
    return null;
  },
  returns: v.null(),
});

export const consumeState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("githubLinkStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();
    if (!row) {
      return null;
    }
    await ctx.db.delete(row._id);
    if (row.expiresAt < Date.now()) {
      return null;
    }
    return row.userId;
  },
  returns: v.union(v.id("users"), v.null()),
});

export const linkAccount = internalMutation({
  args: {
    accessToken: v.string(),
    avatarUrl: v.optional(v.string()),
    githubId: v.string(),
    login: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }
    const taken = await ctx.db
      .query("users")
      .withIndex("by_github_id", (q) => q.eq("githubId", args.githubId))
      .first();
    if (taken && taken._id !== user._id) {
      throw new Error("Esa cuenta de GitHub ya está vinculada a otro usuario");
    }
    const login = args.login.trim().toLowerCase();
    await ctx.db.patch(user._id, {
      githubAccessToken: args.accessToken,
      githubId: args.githubId,
      githubUsername: login,
      githubLinkedAt: Date.now(),
      image: user.image ?? args.avatarUrl,
    });
    const signup = await getSignupForUser(ctx, user);
    if (signup && signup.githubUsername !== login) {
      const clash = await ctx.db
        .query("signups")
        .withIndex("by_github", (q) => q.eq("githubUsername", login))
        .first();
      if (!clash) {
        await ctx.db.patch(signup._id, { githubUsername: login });
      }
    }
    await resolvePendingInvites(
      ctx,
      user._id,
      user.email,
      signup?._id ?? user.signupId,
      login,
      signup?.twitterHandle
    );
    return null;
  },
  returns: v.null(),
});
