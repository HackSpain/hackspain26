import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireEventOpen } from "./eventWindow";
import { currentEditionId } from "./editions";
import {
  getCurrentParticipation,
  participationByEditionEmail,
  participationIsAccepted,
  participationIsRegistered,
} from "./participations";
import {
  canJudge,
  canBrowseSponsorCatalog,
  canBrowseDirectory,
} from "./userTypes";
import type { Role } from "./validators";

type Ctx = QueryCtx | MutationCtx;

export function isAdmin(user: Pick<Doc<"users">, "admin" | "role">): boolean {
  return user.admin === true || user.role === "admin";
}

export function resolvedLoginRole(
  existing: Role | undefined,
  allowlisted: boolean
): Role {
  if (existing === "admin") {
    return "admin";
  }
  if (existing === "judge") {
    return "user";
  }
  if (existing) {
    return existing;
  }
  return allowlisted ? "admin" : "user";
}

export async function getCurrentUser(ctx: Ctx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("No has iniciado sesión");
  }
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("Usuario no encontrado");
  }
  return user;
}

export async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!isAdmin(user)) {
    throw new Error("Se necesita acceso de admin");
  }
  return user;
}

export async function requireJudge(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!(await canJudge(ctx, user))) {
    throw new Error("Se necesita acceso de juez");
  }
  return user;
}

export async function requireAccepted(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (isAdmin(user)) {
    return user;
  }
  const participation = await getCurrentParticipation(ctx, user);
  if (!participation || !participationIsRegistered(participation.status)) {
    throw new Error("No hay inscripción a la hackathon con este email");
  }
  if (!participationIsAccepted(participation.status)) {
    throw new Error("Aún no te han aceptado");
  }
  return user;
}

export async function requireOnboarded(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireAccepted(ctx);
  if (isAdmin(user)) {
    return user;
  }
  const participation = await getCurrentParticipation(ctx, user);
  if (!participation?.onboardingComplete) {
    throw new Error("Confirma tus datos primero");
  }
  return user;
}

/** Onboarded and inside the hackathon window (admins skip both). */
export async function requireInEvent(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireOnboarded(ctx);
  await requireEventOpen(ctx, user);
  return user;
}

/** Challenge catalog: judges may read it outside the window and without a signup. */
export async function requireTracksViewer(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (await canJudge(ctx, user)) {
    return user;
  }
  return await requireInEvent(ctx);
}

export async function requireSponsorCatalog(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!(await canBrowseSponsorCatalog(ctx, user))) {
    throw new Error("Se necesita acceso de sponsor");
  }
  return user;
}

export async function requireDirectoryViewer(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!(await canBrowseDirectory(ctx, user))) {
    throw new Error("Se necesita acceso al directorio");
  }
  return user;
}

/** Boolean form of `requireOnboarded` for callers that degrade instead of throwing. */
export async function isOnboarded(
  ctx: Ctx,
  user: Doc<"users">
): Promise<boolean> {
  if (isAdmin(user)) {
    return true;
  }
  const participation = await getCurrentParticipation(ctx, user);
  if (!participation?.onboardingComplete) {
    return false;
  }
  return participationIsAccepted(participation.status);
}

export async function findSignupByEmail(
  ctx: Ctx,
  email: string
): Promise<Doc<"participations"> | null> {
  return await participationByEditionEmail(
    ctx,
    await currentEditionId(ctx),
    email
  );
}

export async function findUserByEmail(
  ctx: Ctx,
  email: string
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .unique();
}
