import { v } from "convex/values";
import { onboardedMutation, onboardedQuery } from "./lib/customFunctions";
import {
  identifierTypeValidator,
  teamMemberStatusValidator,
} from "./lib/validators";
import {
  normalizeEmail,
  normalizeGithub,
  normalizeTwitter,
} from "./lib/normalize";
import { canonicalRepoUrl } from "./lib/github";
import { MAX_TECH_LENGTH, MAX_TECH_STACK } from "./lib/stack";
import { membershipForUser } from "./lib/team";
import { fail } from "./lib/errors";
import { scheduleStackScan, teamRepoList } from "./stack";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// No 0/O/1/I so codes survive being read aloud or handwritten.
const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 8;
const MAX_REPOS = 5;

function randomJoinCode(): string {
  const bytes = new Uint8Array(JOIN_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (b) => JOIN_CODE_ALPHABET[b % JOIN_CODE_ALPHABET.length]
  ).join("");
}

export function normalizeJoinCode(raw: string): string {
  return raw.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
}

async function uniqueJoinCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomJoinCode();
    const taken = await ctx.db
      .query("teams")
      .withIndex("by_join_code", (q) => q.eq("joinCode", code))
      .first();
    if (!taken) {
      return code;
    }
  }
  throw new Error("No se pudo generar un código de equipo");
}

export function normalizeRepoUrl(raw: string): string | null {
  return canonicalRepoUrl(raw);
}

function normalizeRepoUrls(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    const url = normalizeRepoUrl(entry);
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    out.push(url);
  }
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

const memberReturn = v.object({
  _id: v.id("teamMembers"),
  email: v.optional(v.string()),
  identifier: v.string(),
  identifierType: identifierTypeValidator,
  name: v.optional(v.string()),
  status: teamMemberStatusValidator,
  userId: v.optional(v.id("users")),
});

const teamReturn = v.object({
  _id: v.id("teams"),
  createdAt: v.number(),
  isOwner: v.boolean(),
  joinCode: v.optional(v.string()),
  members: v.array(memberReturn),
  name: v.string(),
  ownerId: v.id("users"),
  repoUrl: v.optional(v.string()),
  repoUrls: v.array(v.string()),
  techStack: v.array(v.string()),
});

const teamSummaryReturn = v.object({
  _id: v.id("teams"),
  isMine: v.boolean(),
  memberCount: v.number(),
  name: v.string(),
  pendingCount: v.number(),
  repoUrl: v.optional(v.string()),
  repoUrls: v.array(v.string()),
  submissionStatus: v.optional(
    v.union(v.literal("draft"), v.literal("submitted"))
  ),
  techStack: v.array(v.string()),
  tracks: v.array(v.object({ slug: v.string(), label: v.string() })),
});

async function hydrateMember(
  ctx: QueryCtx | MutationCtx,
  member: Doc<"teamMembers">
) {
  const user = member.userId ? await ctx.db.get(member.userId) : null;
  const signup = member.signupId ? await ctx.db.get(member.signupId) : null;
  return {
    _id: member._id,
    email: user?.email ?? signup?.email,
    identifier: member.identifier,
    identifierType: member.identifierType,
    name: user?.name ?? signup?.fullName,
    status: member.status,
    userId: member.userId,
  };
}

async function resolveIdentifier(
  ctx: MutationCtx,
  identifierType: "email" | "github" | "twitter",
  raw: string
): Promise<{
  identifier: string;
  userId?: Id<"users">;
  signupId?: Id<"signups">;
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

  let signup: Doc<"signups"> | null = null;
  if (identifierType === "email") {
    signup = await ctx.db
      .query("signups")
      .withIndex("by_email", (q) => q.eq("email", identifier))
      .unique();
  } else if (identifierType === "github") {
    signup = await ctx.db
      .query("signups")
      .withIndex("by_github", (q) => q.eq("githubUsername", identifier))
      .unique();
  } else {
    signup = await ctx.db
      .query("signups")
      .withIndex("by_twitter", (q) => q.eq("twitterHandle", identifier))
      .unique();
  }

  let user: Doc<"users"> | null = null;
  if (identifierType === "email") {
    user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identifier))
      .unique();
  } else if (identifierType === "github") {
    user = await ctx.db
      .query("users")
      .withIndex("by_github", (q) => q.eq("githubUsername", identifier))
      .first();
  }
  if (!user && signup) {
    user = await ctx.db
      .query("users")
      .withIndex("by_signup", (q) => q.eq("signupId", signup._id))
      .unique();
  }

  return {
    identifier,
    signupId: signup?._id,
    status: user ? "member" : "pending",
    userId: user?._id,
  };
}

export const mine = onboardedQuery({
  args: {},
  handler: async (ctx) => {
    const membership = await membershipForUser(ctx, ctx.user._id);
    const team = membership
      ? await ctx.db.get(membership.teamId)
      : await ctx.db
          .query("teams")
          .withIndex("by_owner", (q) => q.eq("ownerId", ctx.user._id))
          .unique();
    if (!team) {
      return null;
    }
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();
    const isOwner = team.ownerId === ctx.user._id;
    return {
      _id: team._id,
      name: team.name,
      ownerId: team.ownerId,
      isOwner,
      createdAt: team.createdAt,
      joinCode: isOwner ? team.joinCode : undefined,
      repoUrl: team.repoUrl,
      repoUrls: teamRepoList(team),
      techStack: team.techStack ?? [],
      members: await Promise.all(members.map((m) => hydrateMember(ctx, m))),
    };
  },
  returns: v.union(teamReturn, v.null()),
});

/** Cheap server-side identity lookup for telemetry and similar ingestion paths. */
export const mineId = onboardedQuery({
  args: {},
  handler: async (ctx) => {
    const membership = await membershipForUser(ctx, ctx.user._id);
    if (membership) {
      return membership.teamId;
    }
    const owned = await ctx.db
      .query("teams")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.user._id))
      .unique();
    return owned?._id ?? null;
  },
  returns: v.union(v.id("teams"), v.null()),
});

export const list = onboardedQuery({
  args: {},
  handler: async (ctx) => {
    const membership = await membershipForUser(ctx, ctx.user._id);
    const teams = await ctx.db.query("teams").collect();
    const result = [];
    for (const team of teams) {
      const members = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      const submission = await ctx.db
        .query("submissions")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .first();
      const tracks = [];
      for (const trackId of submission?.challengeIds ?? []) {
        const track = await ctx.db.get(trackId);
        if (track) {
          tracks.push({ slug: track.slug, label: track.label });
        }
      }
      result.push({
        _id: team._id,
        name: team.name,
        isMine: membership?.teamId === team._id,
        memberCount: members.filter((m) => m.status === "member").length,
        pendingCount: members.filter((m) => m.status === "pending").length,
        repoUrl: team.repoUrl,
        repoUrls: teamRepoList(team),
        techStack: team.techStack ?? [],
        tracks,
        submissionStatus: submission?.status,
      });
    }
    return result.toSorted((a, b) => a.name.localeCompare(b.name, "es"));
  },
  returns: v.array(teamSummaryReturn),
});

const memberInputValidator = v.object({
  identifier: v.string(),
  identifierType: identifierTypeValidator,
});

async function insertMember(
  ctx: MutationCtx,
  team: Doc<"teams">,
  addedBy: Id<"users">,
  identifierType: "email" | "github" | "twitter",
  identifier: string
): Promise<Id<"teamMembers">> {
  const resolved = await resolveIdentifier(ctx, identifierType, identifier);
  const already = await ctx.db
    .query("teamMembers")
    .withIndex("by_identifier", (q) =>
      q
        .eq("identifierType", identifierType)
        .eq("identifier", resolved.identifier)
    )
    .collect();
  const onThisTeam = already.find((row) => row.teamId === team._id);
  if (onThisTeam) {
    throw new Error("Esa persona ya está en este equipo");
  }
  if (already.some((row) => row.teamId !== team._id)) {
    throw new Error(
      "Esa persona ya tiene invitación o membresía en otro equipo"
    );
  }
  if (resolved.userId) {
    const other = await membershipForUser(ctx, resolved.userId);
    if (other) {
      throw new Error("Esa persona ya pertenece a otro equipo");
    }
  }
  if (resolved.signupId) {
    const bySignup = await ctx.db
      .query("teamMembers")
      .withIndex("by_signup", (q) => q.eq("signupId", resolved.signupId))
      .collect();
    if (bySignup.some((row) => row.teamId === team._id)) {
      throw new Error("Esa persona ya está en este equipo");
    }
    if (bySignup.length > 0) {
      throw new Error(
        "Esa persona ya tiene invitación o membresía en otro equipo"
      );
    }
  }

  return await ctx.db.insert("teamMembers", {
    addedBy,
    createdAt: Date.now(),
    identifier: resolved.identifier,
    identifierType,
    signupId: resolved.signupId,
    status: resolved.status,
    teamId: team._id,
    userId: resolved.userId,
  });
}

export const create = onboardedMutation({
  args: {
    members: v.optional(v.array(memberInputValidator)),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (name.length < 2) {
      throw new Error("El nombre del equipo debe tener al menos 2 caracteres");
    }
    const existing = await membershipForUser(ctx, ctx.user._id);
    if (existing) {
      throw new Error("Ya perteneces a un equipo");
    }

    const now = Date.now();
    const teamId = await ctx.db.insert("teams", {
      name,
      ownerId: ctx.user._id,
      joinCode: await uniqueJoinCode(ctx),
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("teamMembers", {
      teamId,
      userId: ctx.user._id,
      signupId: ctx.user.signupId,
      identifierType: "email",
      identifier: ctx.user.email ?? ctx.user._id,
      status: "member",
      addedBy: ctx.user._id,
      createdAt: now,
    });

    const team = await ctx.db.get(teamId);
    if (!team) {
      throw new Error("Equipo no encontrado");
    }
    for (const member of args.members ?? []) {
      if (!member.identifier.trim()) {
        continue;
      }
      await insertMember(
        ctx,
        team,
        ctx.user._id,
        member.identifierType,
        member.identifier
      );
    }
    return teamId;
  },
  returns: v.id("teams"),
});

export const rename = onboardedMutation({
  args: { name: v.string(), teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Equipo no encontrado");
    }
    if (team.ownerId !== ctx.user._id) {
      throw new Error("Solo el dueño puede cambiar el nombre");
    }
    const name = args.name.trim();
    if (name.length < 2) {
      throw new Error("El nombre del equipo debe tener al menos 2 caracteres");
    }
    await ctx.db.patch(team._id, { name, updatedAt: Date.now() });
    return null;
  },
  returns: v.null(),
});

export const addMember = onboardedMutation({
  args: {
    identifier: v.string(),
    identifierType: identifierTypeValidator,
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Equipo no encontrado");
    }
    if (team.ownerId !== ctx.user._id) {
      throw new Error("Solo el dueño puede añadir miembros");
    }
    return await insertMember(
      ctx,
      team,
      ctx.user._id,
      args.identifierType,
      args.identifier
    );
  },
  returns: v.id("teamMembers"),
});

export const leave = onboardedMutation({
  args: {},
  handler: async (ctx) => {
    const membership = await membershipForUser(ctx, ctx.user._id);
    if (!membership) {
      throw new Error("No estás en un equipo");
    }
    const team = await ctx.db.get(membership.teamId);
    if (team && team.ownerId === ctx.user._id) {
      throw new Error("El dueño no puede salir del equipo");
    }
    await ctx.db.delete(membership._id);
    return null;
  },
  returns: v.null(),
});

export const removeMember = onboardedMutation({
  args: { memberId: v.id("teamMembers") },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) {
      throw new Error("Miembro no encontrado");
    }
    const team = await ctx.db.get(member.teamId);
    if (!team) {
      throw new Error("Equipo no encontrado");
    }
    if (team.ownerId !== ctx.user._id) {
      throw new Error("Solo el dueño puede quitar miembros");
    }
    if (member.userId === team.ownerId) {
      throw new Error("No se puede quitar al dueño");
    }
    await ctx.db.delete(member._id);
    return null;
  },
  returns: v.null(),
});

async function requireMemberTeam(
  ctx: MutationCtx & { user: Doc<"users"> }
): Promise<Doc<"teams">> {
  const membership = await membershipForUser(ctx, ctx.user._id);
  if (!membership) {
    fail("NO_TEAM", "No estás en un equipo");
  }
  const team = await ctx.db.get(membership.teamId);
  if (!team) {
    fail("NOT_FOUND", "Equipo no encontrado");
  }
  return team;
}

async function clearPendingInvites(
  ctx: MutationCtx,
  user: Doc<"users">
): Promise<void> {
  const rows: Doc<"teamMembers">[] = [];
  const identifiers: {
    type: "email" | "github" | "twitter";
    value: string | undefined;
  }[] = [
    {
      type: "email",
      value: user.email ? normalizeEmail(user.email) : undefined,
    },
    {
      type: "github",
      value: user.githubUsername
        ? normalizeGithub(user.githubUsername)
        : undefined,
    },
  ];
  for (const { type, value } of identifiers) {
    if (!value) {
      continue;
    }
    rows.push(
      ...(await ctx.db
        .query("teamMembers")
        .withIndex("by_identifier", (q) =>
          q.eq("identifierType", type).eq("identifier", value)
        )
        .collect())
    );
  }
  if (user.signupId) {
    rows.push(
      ...(await ctx.db
        .query("teamMembers")
        .withIndex("by_signup", (q) => q.eq("signupId", user.signupId))
        .collect())
    );
  }
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row._id) || row.status !== "pending") {
      continue;
    }
    seen.add(row._id);
    await ctx.db.delete(row._id);
  }
}

export const join = onboardedMutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const code = normalizeJoinCode(args.code);
    if (code.length !== JOIN_CODE_LENGTH) {
      fail("BAD_CODE", "El código de equipo tiene 8 caracteres");
    }
    const team = await ctx.db
      .query("teams")
      .withIndex("by_join_code", (q) => q.eq("joinCode", code))
      .unique();
    if (!team) {
      fail("BAD_CODE", "No hay ningún equipo con ese código");
    }

    const existing = await membershipForUser(ctx, ctx.user._id);
    if (existing) {
      if (existing.teamId === team._id) {
        return team._id;
      }
      fail("ALREADY_IN_TEAM", "Ya perteneces a otro equipo");
    }

    await clearPendingInvites(ctx, ctx.user);
    await ctx.db.insert("teamMembers", {
      teamId: team._id,
      userId: ctx.user._id,
      signupId: ctx.user.signupId,
      identifierType: "email",
      identifier: ctx.user.email ?? ctx.user._id,
      status: "member",
      addedBy: ctx.user._id,
      createdAt: Date.now(),
    });
    await ctx.db.patch(team._id, { updatedAt: Date.now() });
    return team._id;
  },
  returns: v.id("teams"),
});

export const regenerateCode = onboardedMutation({
  args: {},
  handler: async (ctx) => {
    const team = await requireMemberTeam(ctx);
    if (team.ownerId !== ctx.user._id) {
      fail("NOT_OWNER", "Solo el dueño puede regenerar el código");
    }
    const joinCode = await uniqueJoinCode(ctx);
    await ctx.db.patch(team._id, { joinCode, updatedAt: Date.now() });
    return joinCode;
  },
  returns: v.string(),
});

async function writeTeamRepos(
  ctx: MutationCtx & { user: Doc<"users"> },
  team: Doc<"teams">,
  urls: string[]
): Promise<string[]> {
  const primary = urls[0];
  if (!primary) {
    return [];
  }
  const changed =
    primary !== team.repoUrl ||
    JSON.stringify(teamRepoList(team)) !== JSON.stringify(urls);
  await ctx.db.patch(team._id, {
    githubEtag: changed ? undefined : team.githubEtag,
    repoUrl: primary,
    repoUrls: urls,
    updatedAt: Date.now(),
  });
  if (changed && urls.length > 0) {
    await scheduleStackScan(ctx, {
      force: true,
      repoUrls: urls,
      teamId: team._id,
      userId: ctx.user._id,
    });
  }
  return urls;
}

export const setRepoUrl = onboardedMutation({
  args: { url: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const team = await requireMemberTeam(ctx);
    if (args.url === null || args.url.trim() === "") {
      await ctx.db.patch(team._id, {
        githubEtag: undefined,
        repoUrl: undefined,
        repoUrls: undefined,
        updatedAt: Date.now(),
      });
      return null;
    }
    const repoUrl = normalizeRepoUrl(args.url);
    if (!repoUrl) {
      fail(
        "VALIDATION",
        "Introduce una URL de repositorio de GitHub (https://github.com/org/repo)"
      );
    }
    await writeTeamRepos(ctx, team, [repoUrl]);
    return repoUrl;
  },
  returns: v.union(v.string(), v.null()),
});

export const setRepoUrls = onboardedMutation({
  args: { urls: v.array(v.string()) },
  handler: async (ctx, args) => {
    const team = await requireMemberTeam(ctx);
    const urls = normalizeRepoUrls(args.urls);
    if (args.urls.length > 0 && urls.length === 0) {
      fail(
        "VALIDATION",
        "Introduce URLs de GitHub o slugs org/repo"
      );
    }
    if (urls.length === 0) {
      await ctx.db.patch(team._id, {
        githubEtag: undefined,
        repoUrl: undefined,
        repoUrls: undefined,
        updatedAt: Date.now(),
      });
      return [];
    }
    return await writeTeamRepos(ctx, team, urls);
  },
  returns: v.array(v.string()),
});

export const setTechStack = onboardedMutation({
  args: { stack: v.array(v.string()) },
  handler: async (ctx, args) => {
    const team = await requireMemberTeam(ctx);
    const techStack = normalizeTechStack(args.stack);
    await ctx.db.patch(team._id, {
      techStack,
      techStackAt: Date.now(),
      updatedAt: Date.now(),
    });
    return techStack;
  },
  returns: v.array(v.string()),
});

export const transferOwnership = onboardedMutation({
  args: { memberId: v.id("teamMembers") },
  handler: async (ctx, args) => {
    const team = await requireMemberTeam(ctx);
    if (team.ownerId !== ctx.user._id) {
      fail("NOT_OWNER", "Solo el dueño puede transferir el equipo");
    }
    const member = await ctx.db.get(args.memberId);
    if (!member || member.teamId !== team._id) {
      fail("NOT_FOUND", "Miembro no encontrado");
    }
    if (member.status !== "member" || !member.userId) {
      fail(
        "VALIDATION",
        "Solo se puede transferir a alguien que ya haya entrado en el equipo"
      );
    }
    if (member.userId === ctx.user._id) {
      fail("VALIDATION", "Ya eres el dueño del equipo");
    }
    await ctx.db.patch(team._id, {
      ownerId: member.userId,
      updatedAt: Date.now(),
    });
    return null;
  },
  returns: v.null(),
});

/**
 * Delete a team that has no other members. Pending invites, the team's
 * draft and its milestones go with it; a submitted project blocks it.
 */
export const dissolve = onboardedMutation({
  args: {},
  handler: async (ctx) => {
    const team = await requireMemberTeam(ctx);
    if (team.ownerId !== ctx.user._id) {
      fail("NOT_OWNER", "Solo el dueño puede disolver el equipo");
    }
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();
    const others = members.filter(
      (m) => m.status === "member" && m.userId !== ctx.user._id
    );
    if (others.length > 0) {
      fail(
        "VALIDATION",
        "El equipo aún tiene miembros: transfiere la propiedad o quítalos antes"
      );
    }
    const submission = await ctx.db
      .query("submissions")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .first();
    if (submission?.status === "submitted") {
      fail(
        "VALIDATION",
        "El equipo ya ha enviado un proyecto y no se puede disolver"
      );
    }
    if (submission) {
      await ctx.db.delete(submission._id);
    }
    const milestones = await ctx.db
      .query("milestones")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();
    for (const milestone of milestones) {
      await ctx.db.delete(milestone._id);
    }
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();
    for (const post of posts) {
      if (post.kind === "github") {
        await ctx.db.delete(post._id);
      } else {
        await ctx.db.patch(post._id, { teamId: undefined });
      }
    }
    for (const member of members) {
      await ctx.db.delete(member._id);
    }
    await ctx.db.delete(team._id);
    return null;
  },
  returns: v.null(),
});

// One-off for teams created before join codes existed. Run from the dashboard.
export const backfillJoinCodes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const teams = await ctx.db.query("teams").collect();
    let updated = 0;
    for (const team of teams) {
      if (team.joinCode) {
        continue;
      }
      await ctx.db.patch(team._id, { joinCode: await uniqueJoinCode(ctx) });
      updated++;
    }
    return updated;
  },
  returns: v.number(),
});
