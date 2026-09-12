import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { authedMutation } from "./lib/customFunctions";
import { fail } from "./lib/errors";

/**
 * Device-code login for the CLI. `hackspain auth login` calls
 * /api/cli/auth/device/start with a locally generated secret, opens
 * /cli-auth?hs-code=… in a browser, and polls /api/cli/auth/device/poll.
 * A signed-in dashboard user approves the code; the poll route then redeems
 * it through the `cli-device` credentials provider (convex/auth.ts), which
 * mints the same Convex Auth tokens the email OTP flow produces.
 *
 * Tokens are only ever released to the holder of the start secret: `redeem`
 * requires both the user-visible code and the secret, and deletes the row.
 */

const REQUEST_TTL_MS = 10 * 60 * 1000;
const CODE_LENGTH = 12;
// No 0/O/1/l/i lookalikes; the code travels in a URL but people still see it.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const SECRET_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const EXPIRED_SWEEP_LIMIT = 20;

function randomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (b) => CODE_ALPHABET[b % CODE_ALPHABET.length],
  ).join("");
}

export const start = mutation({
  args: { secret: v.string() },
  returns: v.object({ code: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    if (!SECRET_PATTERN.test(args.secret)) {
      fail("VALIDATION", "Secret inválido");
    }
    // Opportunistic cleanup so abandoned requests do not pile up.
    const stale = await ctx.db
      .query("cliAuthRequests")
      .withIndex("by_expires", (q) => q.lt("expiresAt", Date.now()))
      .take(EXPIRED_SWEEP_LIMIT);
    for (const row of stale) {
      await ctx.db.delete(row._id);
    }
    const code = randomCode();
    const now = Date.now();
    const expiresAt = now + REQUEST_TTL_MS;
    await ctx.db.insert("cliAuthRequests", {
      code,
      secret: args.secret,
      status: "pending",
      createdAt: now,
      expiresAt,
    });
    return { code, expiresAt };
  },
});

/** Poll state for the CLI. Requires the start secret; leaks nothing else. */
export const status = query({
  args: { code: v.string(), secret: v.string() },
  returns: v.union(
    v.literal("pending"),
    v.literal("approved"),
    v.literal("expired"),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("cliAuthRequests")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    if (!row || row.secret !== args.secret || row.expiresAt < Date.now()) {
      return "expired";
    }
    return row.status;
  },
});

/** Signed-in dashboard user authorises the CLI shown on /cli-auth. */
export const approve = authedMutation({
  args: { code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("cliAuthRequests")
      .withIndex("by_code", (q) => q.eq("code", args.code.trim()))
      .unique();
    if (!row || row.expiresAt < Date.now()) {
      fail("BAD_CODE", "Ese código no es válido o ha caducado");
    }
    if (row.status === "approved") {
      if (row.userId === ctx.user._id) {
        return null;
      }
      fail("BAD_CODE", "Ese código ya se ha usado");
    }
    await ctx.db.patch(row._id, { status: "approved", userId: ctx.user._id });
    return null;
  },
});

/**
 * Single-use exchange, called only by the `cli-device` provider in auth.ts.
 * Returns the approving user and deletes the request so the code cannot be
 * redeemed twice.
 */
export const redeem = internalMutation({
  args: { code: v.string(), secret: v.string() },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("cliAuthRequests")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    if (!row) {
      return null;
    }
    if (row.expiresAt < Date.now()) {
      await ctx.db.delete(row._id);
      return null;
    }
    if (
      row.secret !== args.secret ||
      row.status !== "approved" ||
      !row.userId
    ) {
      return null;
    }
    await ctx.db.delete(row._id);
    return row.userId;
  },
});
