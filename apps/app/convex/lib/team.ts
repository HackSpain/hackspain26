import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { currentEditionId } from "./editions";
import { fail } from "./errors";
import { imagePathFor } from "./files";
import { canonicalRepoUrl, repoSlug } from "./github";
import { normalizeEmail, normalizeGithub, normalizeTwitter } from "./normalize";
import { randomCode } from "./randomCode";
import { MAX_TECH_LENGTH, MAX_TECH_STACK } from "./stack";

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 8;
export const MAX_REPOS = 5;

/** Same-origin path for the team logo, if the owner uploaded one. */
export function teamLogoUrlFor(
  team: Pick<Doc<"teams">, "logoId"> | null | undefined
): string | undefined {
  return team?.logoId ? imagePathFor(team.logoId) : undefined;
}

export async function membershipForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  editionId?: Id<"editions">
): Promise<Doc<"teamMembers"> | null> {
  const rows = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (editionId === undefined) {
    return rows[0] ?? null;
  }
  for (const row of rows) {
    if (row.editionId === editionId) {
      return row;
    }
    const team = await ctx.db.get(row.teamId);
    if (team?.editionId === editionId) {
      return row;
    }
  }
  return null;
}

export async function findTeamSubmission(
  ctx: QueryCtx | MutationCtx,
  teamId: Id<"teams">
): Promise<Doc<"submissions"> | null> {
  return await ctx.db
    .query("submissions")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .first();
}

export async function findOwnedSubmission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  editionId?: Id<"editions">
): Promise<Doc<"submissions"> | null> {
  const membership = await membershipForUser(ctx, userId, editionId);
  if (membership) {
    const byTeam = await findTeamSubmission(ctx, membership.teamId);
    if (byTeam && (editionId === undefined || byTeam.editionId === editionId)) {
      return byTeam;
    }
  }
  const owned = await ctx.db
    .query("submissions")
    .withIndex("by_user", (q) => q.eq("submittedBy", userId))
    .collect();
  const match = owned.find(
    (row) =>
      !row.teamId && (editionId === undefined || row.editionId === editionId)
  );
  return match ?? null;
}

export async function currentMembership(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Doc<"teamMembers"> | null> {
  return await membershipForUser(ctx, userId, await currentEditionId(ctx));
}

function randomJoinCode(): string {
  return randomCode(JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH);
}

export function normalizeJoinCode(raw: string): string {
  return raw.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
}

export async function uniqueJoinCode(
  ctx: MutationCtx,
  editionId: Id<"editions">
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomJoinCode();
    const taken = await ctx.db
      .query("teams")
      .withIndex("by_edition_join_code", (q) =>
        q.eq("editionId", editionId).eq("joinCode", code)
      )
      .first();
    if (!taken) {
      return code;
    }
  }
  throw new Error("No se pudo generar un código de equipo");
}

export async function nextJoinCode(ctx: MutationCtx): Promise<string> {
  return await uniqueJoinCode(ctx, await currentEditionId(ctx));
}

export function teamRepoList(
  team: Pick<Doc<"teams">, "repoUrl" | "repoUrls"> | null
): string[] {
  if (!team) {
    return [];
  }
  let raw = team.repoUrls ?? [];
  if (raw.length === 0 && team.repoUrl) {
    raw = [team.repoUrl];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of raw) {
    const slug = repoSlug(url);
    if (!slug || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    out.push(url);
  }
  return out;
}

export function normalizeRepoUrls(raw: string[]): string[] {
  const out = [
    ...new Set(raw.map(canonicalRepoUrl).filter((url) => url !== null)),
  ];
  if (out.length > MAX_REPOS) {
    fail("VALIDATION", `Máximo ${MAX_REPOS} repositorios`);
  }
  return out;
}

export function normalizeTechStack(raw: string[]): string[] {
  const seen = new Set<string>();
  for (const entry of raw) {
    const tech = entry.trim().toLowerCase();
    if (!tech) {
      continue;
    }
    if (tech.length > MAX_TECH_LENGTH) {
      fail(
        "VALIDATION",
        `"${entry.trim()}" supera ${MAX_TECH_LENGTH} caracteres`
      );
    }
    seen.add(tech);
  }
  if (seen.size > MAX_TECH_STACK) {
    fail("VALIDATION", `Máximo ${MAX_TECH_STACK} tecnologías`);
  }
  return [...seen];
}

export async function hydrateMember(
  ctx: QueryCtx | MutationCtx,
  member: Doc<"teamMembers">
) {
  const user = member.userId ? await ctx.db.get(member.userId) : null;
  return {
    _id: member._id,
    email: user?.email,
    identifier: member.identifier,
    identifierType: member.identifierType,
    name: user?.name,
    status: member.status,
    userId: member.userId,
  };
}

export async function resolveIdentifier(
  ctx: MutationCtx,
  identifierType: "email" | "github" | "twitter",
  raw: string
): Promise<{
  identifier: string;
  userId?: Id<"users">;
  status: "member" | "pending";
}> {
  let identifier: string;
  if (identifierType === "email") {
    identifier = normalizeEmail(raw);
  } else if (identifierType === "github") {
    identifier = normalizeGithub(raw);
  } else {
    identifier = normalizeTwitter(raw);
  }
  if (!identifier) {
    throw new Error(
      "Introduce un usuario de GitHub, un handle de X o un email válido"
    );
  }

  let user: Doc<"users"> | null = null;
  if (identifierType === "email") {
    const byEmail = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identifier))
      .first();
    if (byEmail?.emailVerificationTime !== undefined) {
      user = byEmail;
    }
  } else if (identifierType === "github") {
    const byGithub = await ctx.db
      .query("users")
      .withIndex("by_github", (q) => q.eq("githubUsername", identifier))
      .collect();
    user = byGithub.find((row) => row.githubLinkedAt !== undefined) ?? null;
  } else {
    const byTwitter = await ctx.db
      .query("users")
      .withIndex("by_twitter", (q) => q.eq("twitterHandle", identifier))
      .collect();
    user = byTwitter.find((row) => row.twitterLinkedAt !== undefined) ?? null;
  }

  return {
    identifier,
    status: user ? "member" : "pending",
    userId: user?._id,
  };
}

export async function ownedTeam(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<Doc<"teams">> {
  const membership = await currentMembership(ctx, userId);
  const team = membership ? await ctx.db.get(membership.teamId) : null;
  if (!team) {
    fail("NO_TEAM", "No tienes equipo");
  }
  if (team.ownerId !== userId) {
    fail("NOT_OWNER", "Solo el dueño del equipo puede cambiar el logo");
  }
  return team;
}

/** Attach verified GitHub/email/X invites to the account that just linked them. */
export async function resolvePendingInvites(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user) {
    return;
  }
  const candidates: {
    type: "email" | "github" | "twitter";
    value: string;
  }[] = [];
  if (user.email && user.emailVerificationTime !== undefined) {
    candidates.push({ type: "email", value: normalizeEmail(user.email) });
  }
  if (user.githubUsername && user.githubLinkedAt !== undefined) {
    candidates.push({
      type: "github",
      value: normalizeGithub(user.githubUsername),
    });
  }
  if (user.twitterHandle && user.twitterLinkedAt !== undefined) {
    candidates.push({
      type: "twitter",
      value: normalizeTwitter(user.twitterHandle),
    });
  }

  const matches: Doc<"teamMembers">[] = [];
  for (const candidate of candidates) {
    const rows = await ctx.db
      .query("teamMembers")
      .withIndex("by_identifier", (q) =>
        q.eq("identifierType", candidate.type).eq("identifier", candidate.value)
      )
      .collect();
    for (const row of rows) {
      if (row.userId && row.userId !== userId) {
        continue;
      }
      matches.push(row);
    }
  }

  let editionId: Id<"editions"> | undefined;
  try {
    editionId = await currentEditionId(ctx);
  } catch {
    editionId = undefined;
  }
  const scoped: Doc<"teamMembers">[] = [];
  for (const row of matches) {
    if (editionId === undefined) {
      scoped.push(row);
      continue;
    }
    if (row.editionId === editionId) {
      scoped.push(row);
      continue;
    }
    const team = await ctx.db.get(row.teamId);
    if (!team || team.editionId === editionId) {
      scoped.push(row);
    }
  }

  const existing = await membershipForUser(ctx, userId, editionId);
  let teamId = existing?.teamId;
  if (!teamId) {
    const oldest = [...scoped].toSorted((a, b) => a.createdAt - b.createdAt)[0];
    teamId = oldest?.teamId;
  }
  if (!teamId) {
    return;
  }

  let resolved = existing ?? null;
  for (const member of scoped) {
    if (member.teamId !== teamId) {
      continue;
    }
    if (!resolved) {
      if (member.status !== "member" || member.userId !== userId) {
        await ctx.db.patch(member._id, {
          status: "member",
          userId,
        });
      }
      resolved = member;
      continue;
    }
    if (member._id !== resolved._id) {
      await ctx.db.delete(member._id);
    }
  }
}
