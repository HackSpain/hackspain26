import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { fail } from "./lib/errors";
import { isLikelyEmail, normalizeEmail } from "./lib/normalize";

const MAX_EMAIL_LENGTH = 320;

/**
 * Called only by the landing's /api/subscribe after its BotID check; the
 * shared secret keeps browsers from skipping that check by calling Convex.
 */
export const subscribe = mutation({
  args: { email: v.string(), secret: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const expected = process.env.SUBSCRIBE_SECRET;
    if (!expected) {
      throw new Error("SUBSCRIBE_SECRET is not set on the Convex deployment");
    }
    if (args.secret !== expected) {
      throw new Error("Unauthorized");
    }
    const email = normalizeEmail(args.email);
    if (email.length > MAX_EMAIL_LENGTH || !isLikelyEmail(email)) {
      fail("VALIDATION", "Email inválido");
    }
    const existing = await ctx.db
      .query("hackspain27_emails")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!existing) {
      await ctx.db.insert("hackspain27_emails", { email });
    }
    return null;
  },
});
