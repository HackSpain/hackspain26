import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { findUserByEmail } from "./lib/auth";
import { isValidBadgePhoto } from "./lib/badgePhoto";
import {
  EDITION_2027_SLUG,
  currentEdition,
  editionBySlug,
} from "./lib/editions";
import { applicationsStatus } from "./lib/schedule";
import { fail } from "./lib/errors";
import {
  acceptEmailText,
  cancelUrl,
  cancellationEmailText,
  confirmUrl,
  landingOrigin,
  reviewEmailText,
} from "./lib/landingEmail";
import {
  isLikelyEmail,
  normalizeEmail,
  normalizeGithub,
  normalizeTwitter,
} from "./lib/normalize";
import {
  participationByEditionEmail,
  participationIsRegistered,
} from "./lib/participations";
import { resendApiKey, sendBatchedEmails } from "./lib/resend";
import { buildUrls, urlOf } from "./lib/urls";
import {
  defaultUserType,
  typeOpenForApplications,
  typeRequiresConfirmed,
} from "./lib/userTypes";

const MAX_EMAIL_LENGTH = 320;
const MAX_NAME_LENGTH = 200;
const MAX_TEXT_LENGTH = 8000;
const CANCEL_COOLDOWN_MS = 60 * 60 * 1000;
const SHARE_CANDIDATE_LIMIT = 5;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GITHUB_HANDLE_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
const WWW_PREFIX_RE = /^www\./;

const CANCELLABLE_STATUSES = new Set([
  "applied",
  "waitlist",
  "accepted",
  "confirmed",
]);

type Ctx = QueryCtx | MutationCtx;

const confirmStateValidator = v.union(
  v.literal("confirm"),
  v.literal("confirmed"),
  v.literal("invalid"),
  v.literal("not_accepted")
);

const cancelStateValidator = v.union(
  v.literal("already_cancelled"),
  v.literal("cancelled"),
  v.literal("confirm"),
  v.literal("invalid")
);

const confirmViewValidator = v.object({
  fullName: v.string(),
  githubHandle: v.union(v.string(), v.null()),
  photoDataUri: v.union(v.string(), v.null()),
  photoVersion: v.union(v.number(), v.null()),
  state: confirmStateValidator,
});

const cancelViewValidator = v.object({
  fullName: v.string(),
  state: cancelStateValidator,
});

const sharedBadgeValidator = v.object({
  fullName: v.string(),
  githubHandle: v.union(v.string(), v.null()),
  photoDataUri: v.union(v.string(), v.null()),
  photoVersion: v.union(v.number(), v.null()),
});

function requireLandingSecret(secret: string): void {
  const expected = process.env.SUBSCRIBE_SECRET;
  if (!expected) {
    throw new Error("SUBSCRIBE_SECRET is not set on the Convex deployment");
  }
  if (secret !== expected) {
    throw new Error("Unauthorized");
  }
}

function requireEmail(raw: string): string {
  const email = normalizeEmail(raw);
  if (email.length > MAX_EMAIL_LENGTH || !isLikelyEmail(email)) {
    fail("VALIDATION", "Email inválido");
  }
  return email;
}

function optionalText(
  value: string | undefined,
  max: number
): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > max) {
    fail("VALIDATION", "Texto demasiado largo");
  }
  return trimmed;
}

function isManagementToken(token: string): boolean {
  return UUID_RE.test(token);
}

function githubHandleFromUrl(githubUrl: string | undefined): string | null {
  if (!githubUrl) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(githubUrl);
  } catch {
    return null;
  }
  if (parsed.hostname.replace(WWW_PREFIX_RE, "") !== "github.com") {
    return null;
  }
  const segments = parsed.pathname.split("/").filter(Boolean);
  const handle = segments[0];
  if (segments.length !== 1 || !handle) {
    return null;
  }
  return GITHUB_HANDLE_RE.test(handle) ? handle : null;
}

function githubHandleOf(row: Doc<"participations">): string | null {
  const stored = row.githubUsername?.trim() ?? "";
  if (stored && GITHUB_HANDLE_RE.test(stored)) {
    return stored;
  }
  return githubHandleFromUrl(urlOf(row.urls, "github"));
}

function normalizedName(value: string): string {
  return value.trim().toLowerCase();
}

function confirmView(row: Doc<"participations"> | null): {
  fullName: string;
  githubHandle: string | null;
  photoDataUri: string | null;
  photoVersion: number | null;
  state: "confirm" | "confirmed" | "invalid" | "not_accepted";
} {
  if (!row) {
    return {
      fullName: "",
      githubHandle: null,
      photoDataUri: null,
      photoVersion: null,
      state: "invalid",
    };
  }
  let state: "confirm" | "confirmed" | "not_accepted" = "not_accepted";
  if (row.status === "confirmed") {
    state = "confirmed";
  } else if (row.status === "accepted") {
    state = "confirm";
  }
  return {
    fullName: row.fullName ?? "",
    githubHandle: githubHandleOf(row),
    photoDataUri: row.badgePhoto ?? null,
    photoVersion: row.badgePhotoUpdatedAt ?? null,
    state,
  };
}

function cancelView(
  row: Doc<"participations"> | null,
  stateOverride?: "cancelled"
): {
  fullName: string;
  state: "already_cancelled" | "cancelled" | "confirm" | "invalid";
} {
  if (!row) {
    return { fullName: "", state: "invalid" };
  }
  if (stateOverride) {
    return { fullName: row.fullName ?? "", state: stateOverride };
  }
  if (row.status === "cancelled" || row.cancelledAt !== undefined) {
    return { fullName: row.fullName ?? "", state: "already_cancelled" };
  }
  if (CANCELLABLE_STATUSES.has(row.status)) {
    return { fullName: row.fullName ?? "", state: "confirm" };
  }
  return { fullName: row.fullName ?? "", state: "invalid" };
}

async function participationByToken(
  ctx: Ctx,
  token: string
): Promise<Doc<"participations"> | null> {
  if (!isManagementToken(token)) {
    return null;
  }
  return await ctx.db
    .query("participations")
    .withIndex("by_management_token", (q) => q.eq("managementToken", token))
    .unique();
}

async function roleBySlug(
  ctx: Ctx,
  slug: string
): Promise<Doc<"userTypes"> | null> {
  return await ctx.db
    .query("userTypes")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

async function participationMail(
  ctx: QueryCtx,
  participationId: Doc<"participations">["_id"]
): Promise<{
  edition: Doc<"editions">;
  role: Doc<"userTypes"> | null;
  row: Doc<"participations">;
} | null> {
  const row = await ctx.db.get(participationId);
  if (!row) {
    return null;
  }
  const [edition, role] = await Promise.all([
    ctx.db.get(row.editionId),
    ctx.db.get(row.roleId),
  ]);
  if (!edition) {
    return null;
  }
  return { edition, role, row };
}

/**
 * Called only by the landing after its BotID check; the shared secret keeps
 * browsers from skipping that check by calling Convex.
 * The 2027 list is an `interested` participation on that edition.
 */
export const subscribe = mutation({
  args: { email: v.string(), secret: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireLandingSecret(args.secret);
    const email = requireEmail(args.email);
    const edition = await editionBySlug(ctx, EDITION_2027_SLUG);
    if (!edition) {
      throw new Error("No existe la edición 2027");
    }
    const existing = await participationByEditionEmail(ctx, edition._id, email);
    if (existing) {
      return null;
    }
    const hacker =
      (await roleBySlug(ctx, "hacker")) ?? (await defaultUserType(ctx));
    if (!hacker) {
      throw new Error("No hay un rol Hacker para la lista 2027");
    }
    const user = await findUserByEmail(ctx, email);
    await ctx.db.insert("participations", {
      createdAt: Date.now(),
      editionId: edition._id,
      email,
      onboardingComplete: false,
      roleId: hacker._id,
      status: "interested",
      userId: user?._id,
    });
    return null;
  },
});

export const apply = mutation({
  args: {
    achievements: v.optional(v.string()),
    ambassadorMotivation: v.optional(v.string()),
    ambassadorStudyWhere: v.optional(v.string()),
    dietaryDetails: v.optional(v.string()),
    dietaryRestrictions: v.optional(v.string()),
    email: v.string(),
    freeTime: v.optional(v.string()),
    fullName: v.string(),
    githubUrl: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    roleSlug: v.string(),
    secret: v.string(),
    wantsAmbassador: v.optional(v.boolean()),
    webUrl: v.optional(v.string()),
    xUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireLandingSecret(args.secret);
    const email = requireEmail(args.email);
    const fullName = optionalText(args.fullName, MAX_NAME_LENGTH);
    if (!fullName) {
      fail("VALIDATION", "El nombre es obligatorio");
    }
    const roleSlug = args.roleSlug.trim().toLowerCase();
    if (!roleSlug) {
      fail("VALIDATION", "Rol desconocido");
    }
    const role = await roleBySlug(ctx, roleSlug);
    if (!role) {
      throw new Error("Rol desconocido");
    }
    if (!typeOpenForApplications(role)) {
      throw new Error("Este rol no admite solicitudes");
    }
    const edition = await currentEdition(ctx);
    const window = applicationsStatus(edition, Date.now());
    if (window === "closed") {
      fail("VALIDATION", "Las inscripciones están cerradas.");
    }
    const existing = await participationByEditionEmail(ctx, edition._id, email);
    if (existing && participationIsRegistered(existing.status)) {
      throw new Error("Ya hay una solicitud con este email");
    }
    const urls = buildUrls([
      { kind: "x", url: optionalText(args.xUrl, MAX_TEXT_LENGTH) },
      {
        kind: "linkedin",
        url: optionalText(args.linkedinUrl, MAX_TEXT_LENGTH),
      },
      { kind: "github", url: optionalText(args.githubUrl, MAX_TEXT_LENGTH) },
      { kind: "web", url: optionalText(args.webUrl, MAX_TEXT_LENGTH) },
    ]);
    const githubUrl = urlOf(urls, "github");
    const xUrl = urlOf(urls, "x");
    const user = await findUserByEmail(ctx, email);
    const fields = {
      achievements: optionalText(args.achievements, MAX_TEXT_LENGTH),
      ambassadorMotivation: optionalText(
        args.ambassadorMotivation,
        MAX_TEXT_LENGTH
      ),
      ambassadorStudyWhere: optionalText(
        args.ambassadorStudyWhere,
        MAX_TEXT_LENGTH
      ),
      dietaryDetails: optionalText(args.dietaryDetails, MAX_TEXT_LENGTH),
      dietaryRestrictions: optionalText(
        args.dietaryRestrictions,
        MAX_TEXT_LENGTH
      ),
      email,
      fullName,
      githubUsername: githubUrl
        ? normalizeGithub(githubUrl) || undefined
        : undefined,
      managementToken: existing?.managementToken ?? crypto.randomUUID(),
      onboardingComplete: false,
      roleId: role._id,
      status:
        window === "waitlist" ? ("waitlist" as const) : ("applied" as const),
      twitterHandle: xUrl ? normalizeTwitter(xUrl) || undefined : undefined,
      urls,
      userId: user?._id,
      wantsAmbassador: args.wantsAmbassador === true,
    };
    const participationId = existing
      ? existing._id
      : await ctx.db.insert("participations", {
          ...fields,
          createdAt: Date.now(),
          editionId: edition._id,
        });
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    }
    await ctx.scheduler.runAfter(0, internal.landing.sendReviewEmail, {
      participationId,
    });
    return null;
  },
});

export const lookupConfirmation = query({
  args: { secret: v.string(), token: v.string() },
  returns: confirmViewValidator,
  handler: async (ctx, args) => {
    requireLandingSecret(args.secret);
    return confirmView(await participationByToken(ctx, args.token));
  },
});

export const confirm = mutation({
  args: { secret: v.string(), token: v.string() },
  returns: confirmViewValidator,
  handler: async (ctx, args) => {
    requireLandingSecret(args.secret);
    const row = await participationByToken(ctx, args.token);
    if (!row) {
      return confirmView(null);
    }
    if (row.status === "accepted") {
      await ctx.db.patch(row._id, { status: "confirmed" });
      return confirmView({ ...row, status: "confirmed" });
    }
    return confirmView(row);
  },
});

export const lookupCancellation = query({
  args: { secret: v.string(), token: v.string() },
  returns: cancelViewValidator,
  handler: async (ctx, args) => {
    requireLandingSecret(args.secret);
    return cancelView(await participationByToken(ctx, args.token));
  },
});

export const cancel = mutation({
  args: { secret: v.string(), token: v.string() },
  returns: cancelViewValidator,
  handler: async (ctx, args) => {
    requireLandingSecret(args.secret);
    const row = await participationByToken(ctx, args.token);
    const view = cancelView(row);
    if (view.state !== "confirm" || !row) {
      return view;
    }
    await ctx.db.patch(row._id, {
      attendanceStatus: "cancelled",
      cancelledAt: Date.now(),
      status: "cancelled",
    });
    return cancelView(row, "cancelled");
  },
});

export const requestCancellation = mutation({
  args: { email: v.string(), secret: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireLandingSecret(args.secret);
    const email = normalizeEmail(args.email);
    if (email.length > MAX_EMAIL_LENGTH || !isLikelyEmail(email)) {
      return null;
    }
    const rows = await ctx.db
      .query("participations")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    const cancellable = rows.filter(
      (row) =>
        CANCELLABLE_STATUSES.has(row.status) && row.cancelledAt === undefined
    );
    if (cancellable.length === 0) {
      return null;
    }
    const current = await currentEdition(ctx);
    const row =
      cancellable.find((candidate) => candidate.editionId === current._id) ??
      cancellable[0];
    if (!row) {
      return null;
    }
    const now = Date.now();
    if (
      row.cancellationEmailSentAt !== undefined &&
      now - row.cancellationEmailSentAt < CANCEL_COOLDOWN_MS
    ) {
      return null;
    }
    const token = row.managementToken ?? crypto.randomUUID();
    await ctx.db.patch(row._id, {
      cancellationEmailSentAt: now,
      managementToken: token,
    });
    await ctx.scheduler.runAfter(0, internal.landing.sendCancellationEmail, {
      participationId: row._id,
      sentAt: now,
    });
    return null;
  },
});

export const saveBadgePhoto = mutation({
  args: { photo: v.string(), secret: v.string(), token: v.string() },
  returns: v.object({ version: v.union(v.number(), v.null()) }),
  handler: async (ctx, args) => {
    requireLandingSecret(args.secret);
    if (!isValidBadgePhoto(args.photo)) {
      throw new Error("Foto inválida");
    }
    const row = await participationByToken(ctx, args.token);
    if (!row || row.status !== "confirmed") {
      throw new Error("No encontrado");
    }
    const version = Date.now();
    await ctx.db.patch(row._id, {
      badgePhoto: args.photo,
      badgePhotoUpdatedAt: version,
    });
    return { version };
  },
});

export const findSharedBadge = query({
  args: {
    fullName: v.string(),
    githubHandle: v.optional(v.string()),
    secret: v.string(),
  },
  returns: v.union(sharedBadgeValidator, v.null()),
  handler: async (ctx, args) => {
    requireLandingSecret(args.secret);
    const fullName = args.fullName.trim();
    if (!fullName) {
      return null;
    }
    const wantedName = normalizedName(fullName);
    const wantedHandle = args.githubHandle?.trim().toLowerCase() ?? "";
    const editions = await ctx.db.query("editions").collect();
    const matches: Doc<"participations">[] = [];
    for (const edition of editions) {
      const rows = await ctx.db
        .query("participations")
        .withIndex("by_edition_status", (q) =>
          q.eq("editionId", edition._id).eq("status", "confirmed")
        )
        .collect();
      for (const row of rows) {
        if (normalizedName(row.fullName ?? "") !== wantedName) {
          continue;
        }
        matches.push(row);
        if (matches.length >= SHARE_CANDIDATE_LIMIT) {
          break;
        }
      }
      if (matches.length >= SHARE_CANDIDATE_LIMIT) {
        break;
      }
    }
    const withHandles = matches.map((row) => ({
      fullName: row.fullName ?? "",
      githubHandle: githubHandleOf(row),
      photoDataUri: row.badgePhoto ?? null,
      photoVersion: row.badgePhotoUpdatedAt ?? null,
    }));
    if (wantedHandle) {
      return (
        withHandles.find(
          (match) => match.githubHandle?.toLowerCase() === wantedHandle
        ) ?? null
      );
    }
    return withHandles.length === 1 ? withHandles[0] : null;
  },
});

export const reviewEmailPayload = internalQuery({
  args: { participationId: v.id("participations") },
  returns: v.union(
    v.object({
      editionLabel: v.string(),
      email: v.string(),
      fullName: v.string(),
      roleLabel: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const mail = await participationMail(ctx, args.participationId);
    if (!mail?.role) {
      return null;
    }
    return {
      editionLabel: mail.edition.label,
      email: mail.row.email,
      fullName: mail.row.fullName ?? mail.row.email,
      roleLabel: mail.role.label,
    };
  },
});

export const acceptEmailPayload = internalQuery({
  args: { participationId: v.id("participations") },
  returns: v.union(
    v.object({
      confirmUrl: v.string(),
      editionLabel: v.string(),
      email: v.string(),
      fullName: v.string(),
      requiresConfirmed: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const mail = await participationMail(ctx, args.participationId);
    if (!mail?.row.managementToken || !mail.role) {
      return null;
    }
    return {
      confirmUrl: confirmUrl(mail.row.managementToken),
      editionLabel: mail.edition.label,
      email: mail.row.email,
      fullName: mail.row.fullName ?? mail.row.email,
      requiresConfirmed: typeRequiresConfirmed(mail.role),
    };
  },
});

export const cancellationEmailPayload = internalQuery({
  args: { participationId: v.id("participations") },
  returns: v.union(
    v.object({
      cancelUrl: v.string(),
      editionLabel: v.string(),
      email: v.string(),
      fullName: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const mail = await participationMail(ctx, args.participationId);
    if (!mail?.row.managementToken) {
      return null;
    }
    return {
      cancelUrl: cancelUrl(mail.row.managementToken),
      editionLabel: mail.edition.label,
      email: mail.row.email,
      fullName: mail.row.fullName ?? mail.row.email,
    };
  },
});

export const releaseCancellationEmail = internalMutation({
  args: { participationId: v.id("participations"), sentAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.participationId);
    if (!row || row.cancellationEmailSentAt !== args.sentAt) {
      return null;
    }
    await ctx.db.patch(row._id, { cancellationEmailSentAt: undefined });
    return null;
  },
});

async function sendPlainEmail(input: {
  subject: string;
  text: string;
  to: string;
}): Promise<void> {
  if (!resendApiKey()) {
    throw new Error(
      "RESEND_API_KEY is not set on the Convex deployment; cannot send email"
    );
  }
  const result = await sendBatchedEmails([
    { subject: input.subject, text: input.text, to: [input.to] },
  ]);
  if (result.failures.length > 0) {
    throw new Error(result.failures[0]?.error ?? "No se pudo enviar el correo");
  }
}

export const sendReviewEmail = internalAction({
  args: { participationId: v.id("participations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(internal.landing.reviewEmailPayload, {
      participationId: args.participationId,
    });
    if (!payload) {
      return null;
    }
    await sendPlainEmail({
      subject: `Hemos recibido tu solicitud para ${payload.editionLabel}`,
      text: reviewEmailText({
        editionLabel: payload.editionLabel,
        fullName: payload.fullName,
        origin: landingOrigin(),
        roleLabel: payload.roleLabel,
      }),
      to: payload.email,
    });
    return null;
  },
});

export const sendAcceptEmail = internalAction({
  args: { participationId: v.id("participations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(internal.landing.acceptEmailPayload, {
      participationId: args.participationId,
    });
    if (!payload) {
      return null;
    }
    await sendPlainEmail({
      subject: payload.requiresConfirmed
        ? `Tienes plaza en ${payload.editionLabel}`
        : `Puedes entrar en ${payload.editionLabel}`,
      text: acceptEmailText(payload),
      to: payload.email,
    });
    return null;
  },
});

export const sendCancellationEmail = internalAction({
  args: { participationId: v.id("participations"), sentAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(
      internal.landing.cancellationEmailPayload,
      { participationId: args.participationId }
    );
    if (!payload) {
      await ctx.runMutation(internal.landing.releaseCancellationEmail, args);
      return null;
    }
    try {
      await sendPlainEmail({
        subject: `Cancelar tu participación en ${payload.editionLabel}`,
        text: cancellationEmailText(payload),
        to: payload.email,
      });
    } catch (error) {
      await ctx.runMutation(internal.landing.releaseCancellationEmail, args);
      throw error;
    }
    return null;
  },
});
