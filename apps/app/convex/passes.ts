import { v } from "convex/values";
import { Resend as ResendAPI } from "resend";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import {
  ACCESS_CODE_EMAIL_SUBJECT,
  accessCodeEmailHtml,
  accessCodeEmailText,
} from "./lib/accessCodeEmail";
import { adminMutation, adminQuery, onboardedQuery } from "./lib/customFunctions";
import { findUserByEmail, getSignupForUser, signupIsAccepted } from "./lib/auth";
import { resendApiKey, resendFrom } from "./lib/resend";
const PASS_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const PASS_CODE_LENGTH = 4;

const passReturn = v.object({
  _id: v.id("eventPasses"),
  checkedInAt: v.optional(v.number()),
  code: v.string(),
  createdAt: v.number(),
  email: v.string(),
  name: v.string(),
  status: v.union(v.literal("active"), v.literal("revoked")),
});

const scanReturn = v.object({
  checkedInAt: v.number(),
  email: v.string(),
  name: v.string(),
  passId: v.id("eventPasses"),
  status: v.union(v.literal("checked_in"), v.literal("already_checked_in")),
});

const staffStatusReturn = v.object({
  checkedIn: v.number(),
  issued: v.number(),
});

function maskedEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) {
    return "";
  }
  return `${local.slice(0, 2)}•••@${domain}`;
}

function randomCode(): string {
  const bytes = new Uint8Array(PASS_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => PASS_CODE_ALPHABET[byte % PASS_CODE_ALPHABET.length]).join("");
}

async function uniqueCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = randomCode();
    const existing = await ctx.db
      .query("eventPasses")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!existing) {
      return code;
    }
  }
  throw new Error("No se ha podido generar un código de acceso único");
}

async function passDetails(
  ctx: QueryCtx | MutationCtx,
  pass: Doc<"eventPasses">,
  user: Doc<"users"> | null,
  knownSignup?: Doc<"signups"> | null,
) {
  const signup =
    knownSignup ??
    (pass.signupId ? await ctx.db.get(pass.signupId) : null) ??
    (user ? await getSignupForUser(ctx, user) : null);
  if (!signup || !signupIsAccepted(signup)) {
    throw new Error("La acreditación no pertenece a un hacker aceptado");
  }
  return {
    _id: pass._id,
    checkedInAt: pass.checkedInAt,
    code: pass.code,
    createdAt: pass.createdAt,
    email: user?.email ?? signup.email,
    name: user?.name ?? signup.fullName,
    status: pass.status,
  };
}

export const mine = onboardedQuery({
  args: {},
  handler: async (ctx) => {
    const signup = await getSignupForUser(ctx, ctx.user);
    const pass =
      (signup
        ? await ctx.db
            .query("eventPasses")
            .withIndex("by_signup", (q) => q.eq("signupId", signup._id))
            .unique()
        : null) ??
      (await ctx.db
        .query("eventPasses")
        .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
        .unique());
    return pass ? await passDetails(ctx, pass, ctx.user, signup) : null;
  },
  returns: v.union(passReturn, v.null()),
});

async function checkIn(ctx: MutationCtx, value: string) {
  const code = value.trim().toUpperCase();
  if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/.test(code)) {
    throw new Error("Introduce un código válido de cuatro caracteres");
  }
  const pass = await ctx.db
    .query("eventPasses")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
  if (!pass) {
    throw new Error("Acreditación desconocida");
  }
  if (pass.status !== "active") {
    throw new Error("Esta acreditación está revocada");
  }
  const signup = pass.signupId ? await ctx.db.get(pass.signupId) : null;
  let user: Doc<"users"> | null = null;
  if (pass.userId) {
    user = await ctx.db.get(pass.userId);
  } else if (signup) {
    user = await findUserByEmail(ctx, signup.email);
  }
  const resolvedSignup = signup ?? (user ? await getSignupForUser(ctx, user) : null);
  if (!signupIsAccepted(resolvedSignup)) {
    throw new Error("Este participante ya no está aceptado");
  }
  if (user && user.attendanceStatus !== "attending") {
    throw new Error("Este participante ha cancelado su asistencia");
  }
  const name = user?.name ?? resolvedSignup?.fullName ?? "Hacker";
  const email = user?.email ?? resolvedSignup?.email ?? "";
  if (pass.checkedInAt !== undefined) {
    return {
      checkedInAt: pass.checkedInAt,
      email,
      name,
      passId: pass._id,
      status: "already_checked_in" as const,
    };
  }
  const checkedInAt = Date.now();
  await ctx.db.patch(pass._id, {
    checkedInAt,
    signupId: pass.signupId ?? resolvedSignup?._id,
    userId: pass.userId ?? user?._id,
    updatedAt: checkedInAt,
  });
  return {
    checkedInAt,
    email,
    name,
    passId: pass._id,
    status: "checked_in" as const,
  };
}

export const scan = adminMutation({
  args: { value: v.string() },
  handler: async (ctx, args) => await checkIn(ctx, args.value),
  returns: scanReturn,
});

export const staffStatus = query({
  args: {},
  handler: async (ctx) => {
    const passes = await ctx.db.query("eventPasses").collect();
    return {
      checkedIn: passes.filter((pass) => pass.status === "active" && pass.checkedInAt !== undefined)
        .length,
      issued: passes.filter((pass) => pass.status === "active").length,
    };
  },
  returns: staffStatusReturn,
});

// Public venue projection: deliberately excludes email, access codes and contact details.
// The first response establishes a server-clock baseline so opening a screen never
// replays the day's arrivals. Subsequent subscriptions also catch up after reconnects.
export const arrivals = query({
  args: { since: v.optional(v.number()) },
  returns: v.object({
    serverTime: v.number(),
    checkedIn: v.number(),
    entries: v.array(v.object({
      id: v.string(),
      checkedInAt: v.number(),
      number: v.number(),
      name: v.string(),
      image: v.union(v.string(), v.null()),
      role: v.string(),
      city: v.string(),
      company: v.string(),
      university: v.string(),
      skills: v.array(v.string()),
    })),
  }),
  handler: async (ctx, { since }) => {
    const passes = (await ctx.db.query("eventPasses").collect())
      .filter((pass): pass is Doc<"eventPasses"> & { checkedInAt: number } =>
        pass.status === "active" && pass.checkedInAt !== undefined)
      .toSorted((a, b) => (a.checkedInAt - b.checkedInAt) || a._id.localeCompare(b._id));
    const entries = await Promise.all(passes.flatMap((pass, index) => {
      if (since === undefined || pass.checkedInAt < since) {
        return [];
      }
      return [(async () => {
        const signup = pass.signupId ? await ctx.db.get(pass.signupId) : null;
        let user: Doc<"users"> | null = null;
        if (pass.userId) {
          user = await ctx.db.get(pass.userId);
        } else if (signup) {
          user = await findUserByEmail(ctx, signup.email);
        }
        const card = user?.directory;
        return {
          id: `${pass._id}:${pass.checkedInAt}`,
          checkedInAt: pass.checkedInAt,
          number: index + 1,
          name: user?.name?.trim() || signup?.fullName || "Hacker",
          image: user?.avatarId
            ? await ctx.storage.getUrl(user.avatarId)
            : user?.image || null,
          role: card?.role || "Hacker",
          city: card?.city || "",
          company: card?.company || "",
          university: card?.university || "",
          skills: card?.skills.slice(0, 4) || [],
        };
      })()];
    }));
    return { serverTime: Date.now(), checkedIn: passes.length, entries };
  },
});

export const staffScan = mutation({
  args: { value: v.string() },
  handler: async (ctx, args) => {
    const result = await checkIn(ctx, args.value);
    return { ...result, email: maskedEmail(result.email) };
  },
  returns: scanReturn,
});

export const staffUndoCheckIn = mutation({
  args: { passId: v.id("eventPasses") },
  handler: async (ctx, args) => {
    const pass = await ctx.db.get(args.passId);
    if (!pass) {
      throw new Error("Acreditación no encontrada");
    }
    await ctx.db.patch(pass._id, {
      checkedInAt: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
  returns: v.null(),
});

export const undoCheckIn = adminMutation({
  args: { passId: v.id("eventPasses") },
  handler: async (ctx, args) => {
    const pass = await ctx.db.get(args.passId);
    if (!pass) {
      throw new Error("Acreditación no encontrada");
    }
    await ctx.db.patch(pass._id, {
      checkedInAt: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
  returns: v.null(),
});

export const stats = adminQuery({
  args: {},
  handler: async (ctx) => {
    const passes = await ctx.db.query("eventPasses").collect();
    const activePasses = passes.filter((pass) => pass.status === "active");
    const accepted = await ctx.db
      .query("signups")
      .withIndex("by_accepted", (q) => q.eq("accepted", true))
      .collect();
    let expected = 0;
    for (const signup of accepted) {
      const user = await findUserByEmail(ctx, signup.email);
      if (user?.attendanceStatus !== "cancelled") {
        expected++;
      }
    }
    return {
      expected,
      sent: activePasses.filter((pass) => pass.codeSentAt !== undefined).length,
      checkInTimes: activePasses.flatMap((pass) =>
        pass.checkedInAt === undefined ? [] : [pass.checkedInAt],
      ),
      checkedIn: activePasses.filter((pass) => pass.checkedInAt !== undefined).length,
      issued: activePasses.length,
      withCode: activePasses.length,
    };
  },
  returns: v.object({
    checkInTimes: v.array(v.number()),
    expected: v.number(),
    sent: v.number(),
    checkedIn: v.number(),
    issued: v.number(),
    withCode: v.number(),
  }),
});

export const issueAndEmailAccepted = adminMutation({
  args: {},
  handler: async (ctx) => {
    if (!resendApiKey()) {
      throw new Error("Configura Resend antes de enviar los códigos de acceso");
    }
    const signups = await ctx.db
      .query("signups")
      .withIndex("by_accepted", (q) => q.eq("accepted", true))
      .collect();
    const recipients: { passId: Id<"eventPasses">; code: string; email: string; name: string }[] =
      [];
    let issued = 0;

    for (const signup of signups) {
      const user = await findUserByEmail(ctx, signup.email);
      if (user?.attendanceStatus === "cancelled") {
        continue;
      }
      let pass = await ctx.db
        .query("eventPasses")
        .withIndex("by_signup", (q) => q.eq("signupId", signup._id))
        .unique();
      if (!pass && user) {
        pass = await ctx.db
          .query("eventPasses")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .unique();
      }
      if (!pass) {
        const now = Date.now();
        const code = await uniqueCode(ctx);
        const passId = await ctx.db.insert("eventPasses", {
          code,
          createdAt: now,
          signupId: signup._id,
          status: "active",
          updatedAt: now,
          userId: user?._id,
        });
        pass = await ctx.db.get(passId);
        issued++;
      } else if (!pass.signupId || (user && !pass.userId)) {
        await ctx.db.patch(pass._id, {
          signupId: signup._id,
          updatedAt: Date.now(),
          userId: pass.userId ?? user?._id,
        });
      }
      if (pass?.status === "active" && pass.codeSentAt === undefined) {
        recipients.push({
          passId: pass._id,
          code: pass.code,
          email: signup.email,
          name: signup.fullName,
        });
      }
    }

    if (recipients.length > 0) {
      await ctx.scheduler.runAfter(0, internal.passes.deliverAccessCodes, {
        recipients,
      });
    }
    return { emailed: recipients.length, issued };
  },
  returns: v.object({ emailed: v.number(), issued: v.number() }),
});

export const markCodesSent = internalMutation({
  args: { passIds: v.array(v.id("eventPasses")) },
  handler: async (ctx, args) => {
    for (const passId of args.passIds) {
      await ctx.db.patch(passId, { codeSentAt: Date.now() });
    }
  },
});

export const deliverAccessCodes = internalAction({
  args: {
    recipients: v.array(
      v.object({
        passId: v.id("eventPasses"),
        code: v.string(),
        email: v.string(),
        name: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const apiKey = resendApiKey();
    if (!apiKey) {
      throw new Error("Resend is not configured; access codes were not emailed");
    }
    const resend = new ResendAPI(apiKey);
    const from = resendFrom();
    for (let offset = 0; offset < args.recipients.length; offset += 100) {
      const chunk = args.recipients.slice(offset, offset + 100);
      const { error } = await resend.batch.send(
        chunk.map((recipient) => ({
          from,
          html: accessCodeEmailHtml(recipient),
          subject: ACCESS_CODE_EMAIL_SUBJECT,
          text: accessCodeEmailText(recipient),
          to: [recipient.email],
        })),
      );
      if (error) {
        throw new Error(error.message);
      }
      await ctx.runMutation(internal.passes.markCodesSent, {
        passIds: chunk.map((recipient) => recipient.passId),
      });
    }
    return null;
  },
  returns: v.null(),
});
