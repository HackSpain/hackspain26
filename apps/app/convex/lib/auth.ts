import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Role } from "./validators";

type Ctx = QueryCtx | MutationCtx;

export function isAdmin(user: Pick<Doc<"users">, "role">): boolean {
  return user.role === "admin";
}

export function isJudge(user: Pick<Doc<"users">, "role">): boolean {
  return user.role === "judge" || user.role === "admin";
}

export function resolvedLoginRole(
  existing: Role | undefined,
  allowlisted: boolean
): Role {
  if (allowlisted || existing === "admin") {
    return "admin";
  }
  if (existing === "judge") {
    return "judge";
  }
  return "user";
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
  if (!isJudge(user)) {
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
  if (!user.onboardingComplete) {
    throw new Error("Confirma tus datos primero");
  }
  return user;
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
