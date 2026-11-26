import { v } from "convex/values";
import { assertStoredImage, imagePathFor } from "./lib/files";
import {
  adminMutation,
  adminQuery,
  anytimeOnboardedQuery,
  onboardedMutation,
  onboardedQuery,
} from "./lib/customFunctions";
import {
  identifierTypeValidator,
  teamMemberStatusValidator,
} from "./lib/validators";
import { findUserByEmail } from "./lib/auth";
import { canonicalRepoUrl } from "./lib/github";
import {
  normalizeEmail,
  normalizeGithub,
  normalizeTwitter,
} from "./lib/normalize";
import { currentEditionId, ofEdition, resolveEditionId } from "./lib/editions";
import { getCurrentParticipation } from "./lib/participations";
import { scheduleStackScan } from "./lib/stack";
import {
  currentMembership,
  findTeamSubmission,
  hydrateMember,
  JOIN_CODE_LENGTH,
  MAX_REPOS,
  nextJoinCode,
  normalizeJoinCode,
  normalizeRepoUrls,
  normalizeTechStack,
  ownedTeam,
  resolveIdentifier,
  teamLogoUrlFor,
  teamRepoList,
} from "./lib/team";
import { fail } from "./lib/errors";
import { avatarUrlFor } from "./lib/photo";
import { isTrackCombinationAllowed, MAX_TEAMS_PER_TRACK } from "./lib/tracks";
import { removePostSocial } from "./lib/feedSocial";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

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
  /** /api/files/<id> when the owner uploaded a logo. */
  logoUrl: v.optional(v.string()),
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
  logoUrl: v.optional(v.string()),
  memberCount: v.number(),
  /** Confirmed members with a display name, owner first. */
  members: v.array(
    v.object({
      _id: v.id("teamMembers"),
      avatarUrl: v.optional(v.string()),
      isOwner: v.boolean(),
      name: v.string(),
      userId: v.optional(v.id("users")),
    })
  ),
  name: v.string(),
  pendingCount: v.number(),
  projectName: v.optional(v.string()),
  repoUrl: v.optional(v.string()),
  repoUrls: v.array(v.string()),
  submissionStatus: v.optional(
    v.union(v.literal("draft"), v.literal("submitted"))
  ),
  techStack: v.array(v.string()),
  tracks: v.array(
    v.object({
      label: v.string(),
      logoUrl: v.optional(v.string()),
      slug: v.string(),
    })
  ),
});

export const mine = onboardedQuery({
  args: {},
  handler: async (ctx) => {
    const editionId = await currentEditionId(ctx);
    const membership = await currentMembership(ctx, ctx.user._id);
    const team = membership
      ? await ctx.db.get(membership.teamId)
      : (ofEdition(
          await ctx.db
            .query("teams")
            .withIndex("by_owner", (q) => q.eq("ownerId", ctx.user._id))
            .collect(),
          editionId
        )[0] ?? null);
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
      logoUrl: teamLogoUrlFor(team),
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

/**
 * Cheap server-side identity lookup for telemetry and similar ingestion paths.
 * Anytime: the telemetry route stamps it on uploads that arrive after the end.
 */
export const mineId = anytimeOnboardedQuery({
  args: {},
  handler: async (ctx) => {
    const editionId = await currentEditionId(ctx);
    const membership = await currentMembership(ctx, ctx.user._id);
    if (membership) {
      return membership.teamId;
    }
    const owned = ofEdition(
      await ctx.db
        .query("teams")
        .withIndex("by_owner", (q) => q.eq("ownerId", ctx.user._id))
        .collect(),
      editionId
    )[0];
    return owned?._id ?? null;
  },
  returns: v.union(v.id("teams"), v.null()),
});

export const list = onboardedQuery({
  args: {},
  handler: async (ctx) => {
    const editionId = await currentEditionId(ctx);
    const [membership, teams] = await Promise.all([
      currentMembership(ctx, ctx.user._id),
      ctx.db
        .query("teams")
        .withIndex("by_edition", (q) => q.eq("editionId", editionId))
        .collect(),
    ]);
    // Tracks are shared by many teams. Reuse each read within this execution.
    const trackReads = new Map<Id<"tracks">, Promise<Doc<"tracks"> | null>>();
    const getTrack = (id: Id<"tracks">) => {
      let read = trackReads.get(id);
      if (!read) {
        read = ctx.db.get(id);
        trackReads.set(id, read);
      }
      return read;
    };
    const result = await Promise.all(
      teams.map(async (team) => {
        const [members, submission] = await Promise.all([
          ctx.db
            .query("teamMembers")
            .withIndex("by_team", (q) => q.eq("teamId", team._id))
            .collect(),
          ctx.db
            .query("submissions")
            .withIndex("by_team", (q) => q.eq("teamId", team._id))
            .first(),
        ]);
        const tracks = (
          await Promise.all((submission?.challengeIds ?? []).map(getTrack))
        )
          .filter((track) => track !== null)
          .map(({ label, logoUrl, slug }) => ({ label, logoUrl, slug }));
        const people = await Promise.all(
          members
            .filter((member) => member.status === "member")
            .map(async (member) => {
              const user = member.userId
                ? await ctx.db.get(member.userId)
                : null;
              const participation =
                user && user.name === undefined
                  ? await getCurrentParticipation(ctx, user)
                  : null;
              return {
                _id: member._id,
                avatarUrl: user ? avatarUrlFor(user) : undefined,
                isOwner: member.userId === team.ownerId,
                name:
                  user?.name ?? participation?.fullName ?? member.identifier,
                userId: member.userId,
              };
            })
        );
        return {
          _id: team._id,
          name: team.name,
          isMine: membership?.teamId === team._id,
          logoUrl: teamLogoUrlFor(team),
          memberCount: people.length,
          members: people.toSorted(
            (a, b) => Number(b.isOwner) - Number(a.isOwner)
          ),
          pendingCount: members.filter((m) => m.status === "pending").length,
          projectName: submission?.name?.trim() || undefined,
          repoUrl: team.repoUrl,
          repoUrls: teamRepoList(team),
          techStack: team.techStack ?? [],
          tracks,
          submissionStatus: submission?.status,
        };
      })
    );
    return result.toSorted((a, b) => a.name.localeCompare(b.name, "es"));
  },
  returns: v.array(teamSummaryReturn),
});

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Upload target for the team logo. POST the file there, then call setLogo. */
export const generateLogoUploadUrl = onboardedMutation({
  args: {},
  handler: async (ctx) => {
    await ownedTeam(ctx, ctx.user._id);
    return await ctx.storage.generateUploadUrl();
  },
  returns: v.string(),
});

export const setLogo = onboardedMutation({
  args: { imageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const team = await ownedTeam(ctx, ctx.user._id);
    await assertStoredImage(
      ctx,
      args.imageId,
      MAX_LOGO_BYTES,
      "El logo no puede superar 2 MB"
    );
    const previous = team.logoId;
    await ctx.db.patch(team._id, {
      logoId: args.imageId,
      updatedAt: Date.now(),
    });
    if (previous && previous !== args.imageId) {
      await ctx.storage.delete(previous);
    }
    return imagePathFor(args.imageId);
  },
  returns: v.string(),
});

export const removeLogo = onboardedMutation({
  args: {},
  handler: async (ctx) => {
    const team = await ownedTeam(ctx, ctx.user._id);
    if (!team.logoId) {
      return null;
    }
    await ctx.db.patch(team._id, { logoId: undefined, updatedAt: Date.now() });
    await ctx.storage.delete(team.logoId);
    return null;
  },
  returns: v.null(),
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
    const other = await currentMembership(ctx, resolved.userId);
    if (other) {
      throw new Error("Esa persona ya pertenece a otro equipo");
    }
  }
  return await ctx.db.insert("teamMembers", {
    addedBy,
    createdAt: Date.now(),
    editionId: team.editionId ?? (await currentEditionId(ctx)),
    identifier: resolved.identifier,
    identifierType,
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
    const existing = await currentMembership(ctx, ctx.user._id);
    if (existing) {
      throw new Error("Ya perteneces a un equipo");
    }

    const now = Date.now();
    const editionId = await currentEditionId(ctx);
    const teamId = await ctx.db.insert("teams", {
      createdAt: now,
      editionId,
      joinCode: await nextJoinCode(ctx),
      name,
      ownerId: ctx.user._id,
      updatedAt: now,
    });
    await ctx.db.insert("teamMembers", {
      addedBy: ctx.user._id,
      createdAt: now,
      editionId,
      identifier: ctx.user.email ?? ctx.user._id,
      identifierType: "email",
      status: "member",
      teamId,
      userId: ctx.user._id,
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

export const leave = onboardedMutation({
  args: {},
  handler: async (ctx) => {
    const membership = await currentMembership(ctx, ctx.user._id);
    if (!membership) {
      throw new Error("No estás en un equipo");
    }
    const team = await ctx.db.get(membership.teamId);
    if (team && team.ownerId === ctx.user._id) {
      throw new Error("El dueño no puede salir del equipo");
    }
    if (team) {
      const submission = await findTeamSubmission(ctx, team._id);
      if (submission?.submittedBy === ctx.user._id) {
        await ctx.db.patch(submission._id, { submittedBy: team.ownerId });
      }
    }
    await ctx.db.delete(membership._id);
    return null;
  },
  returns: v.null(),
});

async function requireMemberTeam(
  ctx: MutationCtx & { user: Doc<"users"> }
): Promise<Doc<"teams">> {
  const membership = await currentMembership(ctx, ctx.user._id);
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
    {
      type: "twitter",
      value: user.twitterHandle
        ? normalizeTwitter(user.twitterHandle)
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
    const editionId = await currentEditionId(ctx);
    const team = await ctx.db
      .query("teams")
      .withIndex("by_edition_join_code", (q) =>
        q.eq("editionId", editionId).eq("joinCode", code)
      )
      .unique();
    if (!team) {
      fail("BAD_CODE", "No hay ningún equipo con ese código");
    }

    const existing = await currentMembership(ctx, ctx.user._id);
    if (existing) {
      if (existing.teamId === team._id) {
        return team._id;
      }
      fail("ALREADY_IN_TEAM", "Ya perteneces a otro equipo");
    }

    await clearPendingInvites(ctx, ctx.user);
    await ctx.db.insert("teamMembers", {
      addedBy: ctx.user._id,
      createdAt: Date.now(),
      editionId: team.editionId ?? editionId,
      identifier: ctx.user.email ?? ctx.user._id,
      identifierType: "email",
      status: "member",
      teamId: team._id,
      userId: ctx.user._id,
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
    const joinCode = await nextJoinCode(ctx);
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
    githubEtags: changed ? undefined : team.githubEtags,
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
        githubEtags: undefined,
        repoUrl: undefined,
        repoUrls: undefined,
        updatedAt: Date.now(),
      });
      return null;
    }
    const repoUrl = canonicalRepoUrl(args.url);
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
      fail("VALIDATION", "Introduce URLs de GitHub o slugs org/repo");
    }
    if (urls.length === 0) {
      await ctx.db.patch(team._id, {
        githubEtag: undefined,
        githubEtags: undefined,
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

/**
 * A watcher saw this sanitized GitHub origin in an agent session. Observed
 * repos never override the project/team configuration; the feed only uses
 * them as a fallback while no official repo has been declared.
 */
export const observeRepo = onboardedMutation({
  args: { repo: v.string() },
  handler: async (ctx, args) => {
    const team = await requireMemberTeam(ctx);
    const url = canonicalRepoUrl(args.repo);
    if (!url) {
      fail("VALIDATION", "Repositorio de GitHub no válido");
    }
    const observed = [
      ...(team.observedRepoUrls ?? []).filter(
        (existing) => canonicalRepoUrl(existing) !== url
      ),
      url,
    ].slice(-MAX_REPOS);
    if (
      JSON.stringify(observed) !== JSON.stringify(team.observedRepoUrls ?? [])
    ) {
      await ctx.db.patch(team._id, { observedRepoUrls: observed });
    }
    return url;
  },
  returns: v.string(),
});

export const setTechStack = onboardedMutation({
  args: { stack: v.array(v.string()) },
  handler: async (ctx, args) => {
    const team = await requireMemberTeam(ctx);
    const techStack = normalizeTechStack(args.stack);
    await ctx.db.patch(team._id, {
      techStack,
      techStackAt: Date.now(),
      // Typed by hand from here on, until the next repo scan says otherwise.
      techStackSource: undefined,
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

async function deleteTeamWithoutMembers(
  ctx: MutationCtx,
  team: Doc<"teams">,
  members: Doc<"teamMembers">[]
): Promise<void> {
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
      await removePostSocial(ctx, post._id);
      await ctx.db.delete(post._id);
    } else {
      await ctx.db.patch(post._id, { teamId: undefined });
    }
  }
  for (const member of members) {
    await ctx.db.delete(member._id);
  }
  if (team.logoId) {
    await ctx.storage.delete(team.logoId);
  }
  await ctx.db.delete(team._id);
}

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
    await deleteTeamWithoutMembers(ctx, team, members);
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
      await ctx.db.patch(team._id, { joinCode: await nextJoinCode(ctx) });
      updated++;
    }
    return updated;
  },
  returns: v.number(),
});

function memberEmails(
  user: { email?: string } | null,
  member: Doc<"teamMembers">
): string[] {
  const emails = [user?.email];
  if (member.identifierType === "email") {
    emails.push(member.identifier);
  }
  return [
    ...new Set(emails.filter((email): email is string => Boolean(email))),
  ];
}

export const adminDirectory = adminQuery({
  args: {
    editionId: v.optional(v.id("editions")),
    search: v.optional(v.string()),
    trackId: v.optional(v.id("tracks")),
  },
  handler: async (ctx, args) => {
    const editionId = await resolveEditionId(ctx, args.editionId);
    const [teams, catalog] = await Promise.all([
      ctx.db
        .query("teams")
        .withIndex("by_edition", (q) => q.eq("editionId", editionId))
        .collect(),
      ctx.db
        .query("tracks")
        .withIndex("by_edition", (q) => q.eq("editionId", editionId))
        .collect(),
    ]);
    const tracks = catalog.toSorted((a, b) => a.sortOrder - b.sortOrder);
    const rows = [];
    const teamCount = new Map<string, number>();
    for (const team of teams) {
      const members = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      const submission = await ctx.db
        .query("submissions")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .first();
      const entered = [];
      for (const trackId of new Set(submission?.challengeIds)) {
        const track = await ctx.db.get(trackId);
        if (!track) {
          continue;
        }
        entered.push({ _id: track._id, label: track.label });
        teamCount.set(track._id, (teamCount.get(track._id) ?? 0) + 1);
      }
      const people = [];
      const emails: string[] = [];
      for (const member of members) {
        if (member.status !== "member") {
          continue;
        }
        const user = member.userId ? await ctx.db.get(member.userId) : null;
        const found = memberEmails(user, member);
        emails.push(...found);
        people.push({
          email: found[0],
          isOwner: member.userId === team.ownerId,
          name: user?.name ?? member.identifier,
        });
      }
      rows.push({
        _id: team._id,
        emails: [...new Set(emails)],
        members: people.toSorted(
          (a, b) => Number(b.isOwner) - Number(a.isOwner)
        ),
        entered,
        name: team.name,
        submitted: submission?.status === "submitted",
      });
    }
    const needle = args.search?.trim().toLowerCase() ?? "";
    const listed = rows.filter((team) => {
      if (
        args.trackId &&
        !team.entered.some((track) => track._id === args.trackId)
      ) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        team.name.toLowerCase().includes(needle) ||
        team.emails.some((email) => email.toLowerCase().includes(needle))
      );
    });
    return {
      teamLimit: MAX_TEAMS_PER_TRACK,
      teams: listed.toSorted((a, b) => a.name.localeCompare(b.name, "es")),
      tracks: tracks.map((track) => ({
        _id: track._id,
        label: track.label,
        slug: track.slug,
        teamCount: teamCount.get(track._id) ?? 0,
      })),
    };
  },
  returns: v.object({
    teamLimit: v.number(),
    teams: v.array(
      v.object({
        _id: v.id("teams"),
        emails: v.array(v.string()),
        members: v.array(
          v.object({
            email: v.optional(v.string()),
            isOwner: v.boolean(),
            name: v.string(),
          })
        ),
        entered: v.array(
          v.object({
            _id: v.id("tracks"),
            label: v.string(),
          })
        ),
        name: v.string(),
        submitted: v.boolean(),
      })
    ),
    tracks: v.array(
      v.object({
        _id: v.id("tracks"),
        label: v.string(),
        slug: v.string(),
        teamCount: v.number(),
      })
    ),
  }),
});

export const adminSetTrack = adminMutation({
  args: {
    teamIds: v.array(v.id("teams")),
    trackId: v.optional(v.id("tracks")),
  },
  handler: async (ctx, args) => {
    if (args.trackId) {
      const track = await ctx.db.get(args.trackId);
      if (!track) {
        throw new Error("Reto no encontrado");
      }
    }
    const now = Date.now();
    const seen = new Set<string>();
    for (const teamId of args.teamIds) {
      if (seen.has(teamId)) {
        continue;
      }
      seen.add(teamId);
      const team = await ctx.db.get(teamId);
      if (!team) {
        throw new Error("Equipo no encontrado");
      }
      const existing = await ctx.db
        .query("submissions")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .first();
      const challengeIds = args.trackId
        ? [...new Set([...(existing?.challengeIds ?? []), args.trackId])]
        : [];
      const selectedTracks = await Promise.all(
        challengeIds.map((trackId) => ctx.db.get(trackId))
      );
      if (
        selectedTracks.some((track) => !track) ||
        !isTrackCombinationAllowed(
          selectedTracks.filter((track) => track !== null)
        )
      ) {
        fail(
          "VALIDATION",
          "Un equipo puede entrar en un track, o en dos si uno es THEKER."
        );
      }
      if (existing) {
        await ctx.db.patch(existing._id, { challengeIds, updatedAt: now });
      } else {
        await ctx.db.insert("submissions", {
          challengeIds,
          createdAt: now,
          description: "",
          editionId: team.editionId ?? (await currentEditionId(ctx)),
          name: team.name,
          perkIds: [],
          status: "draft",
          submittedBy: team.ownerId,
          teamId: team._id,
          updatedAt: now,
          urls: [],
        });
      }
    }
    return null;
  },
  returns: v.null(),
});

export const adminRemoveTrack = adminMutation({
  args: {
    teamIds: v.array(v.id("teams")),
    trackId: v.id("tracks"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const seen = new Set<string>();
    for (const teamId of args.teamIds) {
      if (seen.has(teamId)) {
        continue;
      }
      seen.add(teamId);
      const existing = await ctx.db
        .query("submissions")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .first();
      if (!existing) {
        continue;
      }
      const challengeIds = existing.challengeIds.filter(
        (trackId) => trackId !== args.trackId
      );
      if (challengeIds.length === existing.challengeIds.length) {
        continue;
      }
      await ctx.db.patch(existing._id, { challengeIds, updatedAt: now });
    }
    return null;
  },
  returns: v.null(),
});

export const adminOptions = adminQuery({
  args: {},
  handler: async (ctx) => {
    const teams = ofEdition(
      await ctx.db.query("teams").collect(),
      await currentEditionId(ctx)
    );
    return teams
      .map((team) => ({ _id: team._id, name: team.name }))
      .toSorted((a, b) => a.name.localeCompare(b.name, "es"));
  },
  returns: v.array(v.object({ _id: v.id("teams"), name: v.string() })),
});

async function loadAdminParticipant(
  ctx: QueryCtx | MutationCtx,
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
  if (!user && !participation) {
    throw new Error("Participante no encontrado");
  }
  return { participation, user };
}

async function membershipsForPerson(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users"> | null
): Promise<Doc<"teamMembers">[]> {
  if (!user) {
    return [];
  }
  return await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
}

async function dropMemberships(
  ctx: MutationCtx,
  memberships: Doc<"teamMembers">[]
): Promise<void> {
  for (const membership of memberships) {
    if (!(await ctx.db.get(membership._id))) {
      continue;
    }
    const team = await ctx.db.get(membership.teamId);
    if (team && membership.userId && team.ownerId === membership.userId) {
      const members = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      const successor = members.find(
        (member) =>
          member._id !== membership._id &&
          member.status === "member" &&
          member.userId
      );
      if (successor?.userId) {
        await ctx.db.patch(team._id, {
          ownerId: successor.userId,
          updatedAt: Date.now(),
        });
      } else {
        // Admin removal of the sole owner must not leave an owned team
        // visible to someone who is no longer a member.
        await deleteTeamWithoutMembers(ctx, team, members);
        continue;
      }
    }
    await ctx.db.delete(membership._id);
    if (team) {
      await ctx.db.patch(team._id, { updatedAt: Date.now() });
    }
  }
}

export const adminAssignMember = adminMutation({
  args: {
    signupId: v.optional(v.string()),
    teamId: v.id("teams"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Equipo no encontrado");
    }
    const { participation, user } = await loadAdminParticipant(ctx, args);
    const email = user?.email ?? participation?.email;
    if (!email) {
      throw new Error("Este participante no tiene email para asignarlo");
    }
    const existing = await membershipsForPerson(ctx, user);
    if (
      existing.some((row) => row.teamId === team._id && row.status === "member")
    ) {
      return null;
    }
    await dropMemberships(
      ctx,
      existing.filter((row) => row.teamId !== team._id)
    );
    const stillOnTeam = existing.find((row) => row.teamId === team._id);
    if (stillOnTeam) {
      await ctx.db.patch(stillOnTeam._id, {
        status: user ? "member" : stillOnTeam.status,
        userId: stillOnTeam.userId ?? user?._id,
      });
      await ctx.db.patch(team._id, { updatedAt: Date.now() });
      return null;
    }
    await ctx.db.insert("teamMembers", {
      addedBy: ctx.user._id,
      createdAt: Date.now(),
      editionId: team.editionId ?? (await currentEditionId(ctx)),
      identifier: normalizeEmail(email),
      identifierType: "email",
      status: user ? "member" : "pending",
      teamId: team._id,
      userId: user?._id,
    });
    await ctx.db.patch(team._id, { updatedAt: Date.now() });
    return null;
  },
  returns: v.null(),
});

export const adminRemoveMember = adminMutation({
  args: {
    signupId: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { user } = await loadAdminParticipant(ctx, args);
    const existing = await membershipsForPerson(ctx, user);
    if (existing.length === 0) {
      throw new Error("Esta persona no está en ningún equipo");
    }
    await dropMemberships(ctx, existing);
    return null;
  },
  returns: v.null(),
});
