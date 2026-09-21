import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireEventOpen } from "./eventWindow";
import { canJudge, canBrowseSponsorCatalog, canBrowseDirectory } from "./userTypes";
import type { Role } from "./validators";

type Ctx = QueryCtx | MutationCtx;

export function isAdmin(user: Pick<Doc<"users">, "role">): boolean {
  return user.role === "admin";
}

export function resolvedLoginRole(
  existing: Role | undefined,
  allowlisted: boolean
): Role {
  if (allowlisted || existing === "admin") {
    return "admin";
  }
  // "judge" is a legacy value; userTypes.ensureDefaults moves it to a type.
  return existing ?? "user";
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

export function signupIsAccepted(signup: Doc<"signups"> | null): boolean {
  return signup?.accepted === true;
}

export async function requireAccepted(ctx: Ctx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (user.role === "admin") {
    return user;
  }
  const signup = await getSignupForUser(ctx, user);
  if (!signup) {
    throw new Error("No hay inscripción a la hackathon con este email");
  }
  if (!signupIsAccepted(signup)) {
    throw new Error("Aún no te han aceptado");
  }
  return user;
}

export async function requireOnboarded(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireAccepted(ctx);
  if (user.role !== "admin" && !user.onboardingComplete) {
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

export async function requireJudgeInEvent(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireJudge(ctx);
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

export async function requireSponsorCatalog(
  ctx: Ctx
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!(await canBrowseSponsorCatalog(ctx, user))) {
    throw new Error("Se necesita acceso de sponsor");
  }
  return user;
}

export async function requireDirectoryViewer(
  ctx: Ctx
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!(await canBrowseDirectory(ctx, user))) {
    throw new Error("Se necesita acceso de sponsor o juez");
  }
  return user;
}

export async function requireSponsorCatalogInEvent(
  ctx: Ctx
): Promise<Doc<"users">> {
  const user = await requireSponsorCatalog(ctx);
  await requireEventOpen(ctx, user);
  return user;
}

/** Boolean form of `requireOnboarded` for callers that degrade instead of throwing. */
export async function isOnboarded(ctx: Ctx, user: Doc<"users">): Promise<boolean> {
  if (user.role === "admin") {
    return true;
  }
  if (!user.onboardingComplete) {
    return false;
  }
  return signupIsAccepted(await getSignupForUser(ctx, user));
}

export async function getSignupForUser(
  ctx: Ctx,
  user: Doc<"users">
): Promise<Doc<"signups"> | null> {
  if (user.signupId) {
    const byId = await ctx.db.get(user.signupId);
    if (byId) {
      return byId;
    }
  }
  if (!user.email) {
    return null;
  }
  return await findSignupByEmail(ctx, user.email);
}

export async function findSignupByEmail(
  ctx: Ctx,
  email: string
): Promise<Doc<"signups"> | null> {
  return await ctx.db
    .query("signups")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
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
