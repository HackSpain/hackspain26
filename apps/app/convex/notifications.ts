import { v } from "convex/values";
import { Resend as ResendAPI } from "resend";
import { internalAction, internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  adminMutation,
  adminQuery,
  authedQuery,
} from "./lib/customFunctions";
import { countsAsAttending } from "./lib/attendance";
import { getSignupForUser, signupIsAccepted } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";

const RESEND_BATCH_LIMIT = 100;
const MAX_STORED_FAILURES = 50;

export const audienceValidator = v.union(
  v.literal("all"),
  v.literal("accepted"),
  v.literal("attending"),
  v.literal("user"),
);

type Audience = "all" | "accepted" | "attending" | "user";

const failureValidator = v.object({
  email: v.string(),
  error: v.string(),
});

async function notifiableEmail(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
): Promise<string | null> {
  if (!user.notificationConsent) return null;
  if (user.email) return user.email;
  const signup = await getSignupForUser(ctx, user);
  return signup?.email ?? null;
}

async function resolveRecipients(
  ctx: QueryCtx | MutationCtx,
  audience: Audience,
  recipientUserId: Id<"users"> | undefined,
): Promise<Array<{ userId: Id<"users">; email: string }>> {
  if (audience === "user") {
    if (!recipientUserId) {
      throw new Error("Elige un usuario para un aviso individual");
    }
    const user = await ctx.db.get(recipientUserId);
    if (!user) return [];
    const email = await notifiableEmail(ctx, user);
    return email ? [{ userId: user._id, email }] : [];
  }

  const users = await ctx.db.query("users").collect();
  const recipients: Array<{ userId: Id<"users">; email: string }> = [];
  for (const user of users) {
    if (audience === "attending" && !countsAsAttending(user.attendanceStatus)) {
      continue;
    }
    if (audience === "accepted") {
      const signup = await getSignupForUser(ctx, user);
      if (!signupIsAccepted(signup)) continue;
    }
    const email = await notifiableEmail(ctx, user);
    if (email) recipients.push({ userId: user._id, email });
  }
  return recipients;
}

async function userIdForEmail(
  ctx: QueryCtx | MutationCtx,
  email: string,
): Promise<Id<"users">> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Introduce el email del usuario");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", normalized))
    .unique();
  if (!user) {
    throw new Error("No hay usuario del panel con ese email");
  }
  return user._id;
}

export const recipientCount = adminQuery({
  args: {
    audience: audienceValidator,
    recipientEmail: v.optional(v.string()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    let recipientUserId: Id<"users"> | undefined;
    if (args.audience === "user") {
      try {
        recipientUserId = await userIdForEmail(ctx, args.recipientEmail ?? "");
      } catch {
        return 0;
      }
    }
    const recipients = await resolveRecipients(
      ctx,
      args.audience,
      recipientUserId,
    );
    return recipients.length;
  },
});

export const list = adminQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("notifications"),
      subject: v.string(),
      body: v.string(),
      audience: audienceValidator,
      recipientEmail: v.optional(v.string()),
      sentByEmail: v.optional(v.string()),
      sentAt: v.number(),
      status: v.union(
        v.literal("queued"),
        v.literal("sent"),
        v.literal("failed"),
      ),
      recipientCount: v.number(),
      sentCount: v.number(),
      failures: v.array(failureValidator),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("notifications").order("desc").take(50);
    const result = [];
    for (const row of rows) {
      const sender = await ctx.db.get(row.sentBy);
      const recipient = row.recipientUserId
        ? await ctx.db.get(row.recipientUserId)
        : null;
      result.push({
        _id: row._id,
        subject: row.subject,
        body: row.body,
        audience: row.audience,
        recipientEmail: recipient?.email,
        sentByEmail: sender?.email,
        sentAt: row.sentAt,
        status: row.status,
        recipientCount: row.recipientCount,
        sentCount: row.sentCount,
        failures: row.failures,
      });
    }
    return result;
  },
});

const FOR_ME_LIMIT = 50;
const FOR_ME_SCAN_LIMIT = 200;

/**
 * Broadcasts addressed to the caller, oldest first. Used by the CLI watcher as
 * a live subscription (`since` = process start) and by `hackspain notifications`.
 * Intentionally not gated on `notificationConsent`: that flag governs email,
 * and running the watcher is itself an opt-in to see organiser messages.
 */
export const forMe = authedQuery({
  args: { since: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("notifications"),
      subject: v.string(),
      body: v.string(),
      audience: audienceValidator,
      sentAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const since = args.since ?? 0;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_sent_at", (q) => q.gt("sentAt", since))
      .order("asc")
      .take(FOR_ME_SCAN_LIMIT);
    if (rows.length === 0) return [];

    const signup = await getSignupForUser(ctx, ctx.user);
    const accepted = signupIsAccepted(signup);
    const attending = countsAsAttending(ctx.user.attendanceStatus);

    const result = [];
    for (const row of rows) {
      if (row.audience === "user" && row.recipientUserId !== ctx.user._id) continue;
      if (row.audience === "accepted" && !accepted) continue;
      if (row.audience === "attending" && !attending) continue;
      result.push({
        _id: row._id,
        subject: row.subject,
        body: row.body,
        audience: row.audience,
        sentAt: row.sentAt,
      });
    }
    return result.slice(-FOR_ME_LIMIT);
  },
});

export const send = adminMutation({
  args: {
    subject: v.string(),
    body: v.string(),
    audience: audienceValidator,
    recipientEmail: v.optional(v.string()),
  },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    const subject = args.subject.trim();
    const body = args.body.trim();
    if (!subject) throw new Error("El asunto es obligatorio");
    if (!body) throw new Error("El mensaje es obligatorio");

    const recipientUserId =
      args.audience === "user"
        ? await userIdForEmail(ctx, args.recipientEmail ?? "")
        : undefined;

    const recipients = await resolveRecipients(
      ctx,
      args.audience,
      recipientUserId,
    );
    if (recipients.length === 0) {
      throw new Error(
        "Nadie en esa audiencia ha dado consentimiento para avisos",
      );
    }

    const notificationId = await ctx.db.insert("notifications", {
      subject,
      body,
      audience: args.audience,
      recipientUserId,
      sentBy: ctx.user._id,
      sentAt: Date.now(),
      status: "queued",
      recipientCount: recipients.length,
      sentCount: 0,
      failures: [],
    });

    await ctx.scheduler.runAfter(0, internal.notifications.deliver, {
      notificationId,
      subject,
      body,
      emails: recipients.map((r) => r.email),
    });

    return notificationId;
  },
});

export const deliver = internalAction({
  args: {
    notificationId: v.id("notifications"),
    subject: v.string(),
    body: v.string(),
    emails: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const apiKey = process.env.AUTH_RESEND_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.notifications.finishDelivery, {
        notificationId: args.notificationId,
        sentCount: 0,
        failures: args.emails.slice(0, MAX_STORED_FAILURES).map((email) => ({
          email,
          error: "AUTH_RESEND_KEY is not set",
        })),
      });
      throw new Error(
        "AUTH_RESEND_KEY is not set on the Convex deployment; cannot send email",
      );
    }

    const resend = new ResendAPI(apiKey);
    const from = process.env.AUTH_EMAIL ?? "HackSpain <onboarding@resend.dev>";

    let sentCount = 0;
    const failures: Array<{ email: string; error: string }> = [];

    for (let i = 0; i < args.emails.length; i += RESEND_BATCH_LIMIT) {
      const chunk = args.emails.slice(i, i + RESEND_BATCH_LIMIT);
      try {
        const { error } = await resend.batch.send(
          chunk.map((email) => ({
            from,
            to: [email],
            subject: args.subject,
            text: args.body,
          })),
        );
        if (error) {
          for (const email of chunk) {
            failures.push({ email, error: error.message });
          }
        } else {
          sentCount += chunk.length;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        for (const email of chunk) {
          failures.push({ email, error: message });
        }
      }
    }

    await ctx.runMutation(internal.notifications.finishDelivery, {
      notificationId: args.notificationId,
      sentCount,
      failures: failures.slice(0, MAX_STORED_FAILURES),
    });
    return null;
  },
});

export const finishDelivery = internalMutation({
  args: {
    notificationId: v.id("notifications"),
    sentCount: v.number(),
    failures: v.array(failureValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, {
      status: args.sentCount > 0 ? "sent" : "failed",
      sentCount: args.sentCount,
      failures: args.failures,
    });
    return null;
  },
});
