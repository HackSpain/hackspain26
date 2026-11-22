import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalAction, internalMutation, query } from "./_generated/server";
import {
  ACCESS_CODE_EMAIL_SUBJECT,
  accessCodeEmailHtml,
  accessCodeEmailSubject,
  accessCodeEmailText,
} from "./lib/accessCodeEmail";
import { adminMutation, adminQuery } from "./lib/customFunctions";
import { findUserByEmail } from "./lib/auth";
import { currentEdition, currentEditionId, ofEdition } from "./lib/editions";
import { editionDatesLine } from "./lib/eventWindow";
import { checkInIsOpen } from "./lib/schedule";
import {
  getCurrentParticipation,
  participationIsAccepted,
} from "./lib/participations";
import { randomCode as randomFromAlphabet } from "./lib/randomCode";
import { resendApiKey, sendBatchedEmails } from "./lib/resend";
const PASS_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const PASS_CODE_LENGTH = 4;

const scanReturn = v.object({
  checkedInAt: v.number(),
  email: v.string(),
  name: v.string(),
  passId: v.id("eventPasses"),
  status: v.union(v.literal("checked_in"), v.literal("already_checked_in")),
});

function randomCode(): string {
  return randomFromAlphabet(PASS_CODE_ALPHABET, PASS_CODE_LENGTH);
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

export async function findEventPass(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users"> | null
) {
  if (!user) {
    return null;
  }
  return await ctx.db
    .query("eventPasses")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .unique();
}

async function completeCheckIn(
  ctx: MutationCtx,
  pass: Doc<"eventPasses">,
  user: Doc<"users"> | null,
  participation: Doc<"participations"> | null,
  options: { allowCancelled?: boolean } = {}
) {
  const edition =
    (await ctx.db.get(pass.editionId)) ?? (await currentEdition(ctx));
  if (!checkInIsOpen(edition, Date.now())) {
    throw new Error("El check-in aún no está abierto");
  }
  if (pass.status !== "active") {
    throw new Error("Esta acreditación está revocada");
  }
  if (!participationIsAccepted(participation?.status)) {
    throw new Error("Este participante ya no está aceptado");
  }
  if (
    participation &&
    participation.attendanceStatus !== "attending" &&
    !options.allowCancelled
  ) {
    throw new Error("Este participante ha cancelado su asistencia");
  }
  const name = user?.name ?? participation?.fullName ?? "Hacker";
  const email = user?.email ?? participation?.email ?? "";
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
    userId: pass.userId ?? user?._id,
    updatedAt: checkedInAt,
  });
  if (participation && participation.attendanceStatus !== "attending") {
    await ctx.db.patch(participation._id, { attendanceStatus: "attending" });
  }
  return {
    checkedInAt,
    email,
    name,
    passId: pass._id,
    status: "checked_in" as const,
  };
}

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
  const user = pass.userId ? await ctx.db.get(pass.userId) : null;
  const participation = user ? await getCurrentParticipation(ctx, user) : null;
  return await completeCheckIn(ctx, pass, user, participation);
}

export async function checkInParticipantRecord(
  ctx: MutationCtx,
  args: { signupId?: string; userId?: Id<"users"> }
) {
  const participation = args.signupId
    ? await ctx.db.get(args.signupId as Id<"participations">)
    : null;
  let user = args.userId ? await ctx.db.get(args.userId) : null;
  if (!user && participation?.userId) {
    user = await ctx.db.get(participation.userId);
  }
  if (!user && participation?.email) {
    user = await findUserByEmail(ctx, participation.email);
  }
  const resolved =
    participation ?? (user ? await getCurrentParticipation(ctx, user) : null);
  if (!resolved) {
    throw new Error("No hay solicitud para hacer el check-in");
  }
  if (!participationIsAccepted(resolved.status)) {
    throw new Error("Este participante no está aceptado");
  }
  if (!user && resolved.userId) {
    user = await ctx.db.get(resolved.userId);
  }
  let pass = await findEventPass(ctx, user);
  if (pass?.status === "revoked") {
    throw new Error("Esta acreditación está revocada");
  }
  if (!pass) {
    const now = Date.now();
    const passId = await ctx.db.insert("eventPasses", {
      code: await uniqueCode(ctx),
      createdAt: now,
      editionId: resolved.editionId,
      status: "active",
      updatedAt: now,
      userId: user?._id,
    });
    pass = await ctx.db.get(passId);
    if (!pass) {
      throw new Error("No se ha podido crear la acreditación");
    }
  }
  return await completeCheckIn(ctx, pass, user, resolved, {
    allowCancelled: true,
  });
}

export const scan = adminMutation({
  args: { value: v.string() },
  handler: async (ctx, args) => await checkIn(ctx, args.value),
  returns: scanReturn,
});

export const checkInParticipant = adminMutation({
  args: {
    signupId: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => await checkInParticipantRecord(ctx, args),
  returns: scanReturn,
});

// Public venue projection: deliberately excludes email, access codes and contact details.
// The first response establishes a server-clock baseline so opening a screen never
// replays the day's arrivals. Subsequent subscriptions also catch up after reconnects.
export const arrivals = query({
  args: { since: v.optional(v.number()) },
  returns: v.object({
    serverTime: v.number(),
    checkedIn: v.number(),
    entries: v.array(
      v.object({
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
      })
    ),
  }),
  handler: async (ctx, { since }) => {
    const editionId = await currentEditionId(ctx);
    const passes = ofEdition(
      await ctx.db.query("eventPasses").collect(),
      editionId
    )
      .filter(
        (pass): pass is Doc<"eventPasses"> & { checkedInAt: number } =>
          pass.status === "active" && pass.checkedInAt !== undefined
      )
      .toSorted(
        (a, b) => a.checkedInAt - b.checkedInAt || a._id.localeCompare(b._id)
      );
    const entries = await Promise.all(
      passes.flatMap((pass, index) => {
        if (since === undefined || pass.checkedInAt < since) {
          return [];
        }
        return [
          (async () => {
            let user: Doc<"users"> | null = null;
            if (pass.userId) {
              user = await ctx.db.get(pass.userId);
            }
            const participation = user
              ? await getCurrentParticipation(ctx, user)
              : null;
            const card = user?.directory;
            return {
              id: `${pass._id}:${pass.checkedInAt}`,
              checkedInAt: pass.checkedInAt,
              number: index + 1,
              name: user?.name?.trim() || participation?.fullName || "Hacker",
              image: user?.avatarId
                ? await ctx.storage.getUrl(user.avatarId)
                : user?.image || null,
              role: card?.role || "Hacker",
              city: card?.city || "",
              company: card?.company || "",
              university: card?.university || "",
              skills: card?.skills.slice(0, 4) || [],
            };
          })(),
        ];
      })
    );
    return { serverTime: Date.now(), checkedIn: passes.length, entries };
  },
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
    const editionId = await currentEditionId(ctx);
    const passes = ofEdition(
      await ctx.db.query("eventPasses").collect(),
      editionId
    );
    const activePasses = passes.filter((pass) => pass.status === "active");
    const accepted = await ctx.db
      .query("participations")
      .withIndex("by_edition", (q) => q.eq("editionId", editionId))
      .collect();
    let expected = 0;
    for (const row of accepted) {
      if (
        participationIsAccepted(row.status) &&
        row.attendanceStatus !== "cancelled"
      ) {
        expected++;
      }
    }
    return {
      expected,
      sent: activePasses.filter((pass) => pass.codeSentAt !== undefined).length,
      checkInTimes: activePasses.flatMap((pass) =>
        pass.checkedInAt === undefined ? [] : [pass.checkedInAt]
      ),
      checkedIn: activePasses.filter((pass) => pass.checkedInAt !== undefined)
        .length,
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
    const editionId = await currentEditionId(ctx);
    const rows = await ctx.db
      .query("participations")
      .withIndex("by_edition", (q) => q.eq("editionId", editionId))
      .collect();
    const recipients: {
      passId: Id<"eventPasses">;
      code: string;
      email: string;
      name: string;
    }[] = [];
    let issued = 0;

    for (const row of rows) {
      if (
        !participationIsAccepted(row.status) ||
        row.attendanceStatus === "cancelled"
      ) {
        continue;
      }
      const user = row.userId
        ? await ctx.db.get(row.userId)
        : await findUserByEmail(ctx, row.email);
      let pass = user
        ? await ctx.db
            .query("eventPasses")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .unique()
        : null;
      if (!pass) {
        const now = Date.now();
        const code = await uniqueCode(ctx);
        const passId = await ctx.db.insert("eventPasses", {
          code,
          createdAt: now,
          editionId,
          status: "active",
          updatedAt: now,
          userId: user?._id,
        });
        pass = await ctx.db.get(passId);
        issued++;
      } else if (user && !pass.userId) {
        await ctx.db.patch(pass._id, {
          editionId: pass.editionId ?? editionId,
          updatedAt: Date.now(),
          userId: user._id,
        });
      }
      if (pass?.status === "active" && pass.codeSentAt === undefined) {
        recipients.push({
          passId: pass._id,
          code: pass.code,
          email: row.email,
          name: row.fullName ?? user?.name ?? row.email,
        });
      }
    }

    if (recipients.length > 0) {
      const edition = await currentEdition(ctx);
      await ctx.scheduler.runAfter(0, internal.passes.deliverAccessCodes, {
        datesLine:
          editionDatesLine(edition.eventStartsAt, edition.eventEndsAt) ??
          `Madrid · ${edition.label}`,
        label: edition.label,
        recipients,
        subject: accessCodeEmailSubject(edition.label),
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
    datesLine: v.optional(v.string()),
    label: v.optional(v.string()),
    recipients: v.array(
      v.object({
        passId: v.id("eventPasses"),
        code: v.string(),
        email: v.string(),
        name: v.string(),
      })
    ),
    subject: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await sendBatchedEmails(
      args.recipients.map((recipient) => ({
        html: accessCodeEmailHtml({
          ...recipient,
          datesLine: args.datesLine,
          label: args.label,
        }),
        subject: args.subject ?? ACCESS_CODE_EMAIL_SUBJECT,
        text: accessCodeEmailText({
          ...recipient,
          label: args.label,
        }),
        to: [recipient.email],
      }))
    );
    if (result.failures.length > 0 && result.sentCount === 0) {
      throw new Error(
        result.failures[0]?.error ?? "No se pudieron enviar los códigos"
      );
    }
    const failed = new Set(result.failures.map((row) => row.email));
    const sent = args.recipients
      .filter((recipient) => !failed.has(recipient.email))
      .map((recipient) => recipient.passId);
    if (sent.length > 0) {
      await ctx.runMutation(internal.passes.markCodesSent, {
        passIds: sent,
      });
    }
    return null;
  },
  returns: v.null(),
});
