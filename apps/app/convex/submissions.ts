import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation } from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import { isAdmin, requireOnboarded } from "./lib/auth";
import {
  adminQuery,
  onboardedMutation,
  onboardedQuery,
} from "./lib/customFunctions";
import { fail } from "./lib/errors";
import { inspectPublicGithubRepo } from "./lib/github";
import {
  countGroups,
  DEFAULT_GENERAL_GROUP_COUNT,
  JUDGING_SETTINGS_KEY,
  pickBalancedGroup,
} from "./lib/judging";
import {
  parseGithubRepoUrl,
  parseOptionalProductUrl,
  parseProjectName,
  parseYoutubeWatchUrl,
} from "./lib/submission";
import {
  findOwnedSubmission,
  findTeamSubmission,
  membershipForUser,
  teamLogoUrlFor,
} from "./lib/team";
import { buildUrls, urlOf, urlsValidator } from "./lib/urls";
import { submissionStatusValidator } from "./lib/validators";
import { scheduleStackScan } from "./stack";
import {
  isTrackCombinationAllowed,
  MAX_TEAMS_PER_TRACK,
  submissionsAreOpen,
  trackEntryCounts,
} from "./tracks";

const challengeSummary = v.object({
  _id: v.id("tracks"),
  label: v.string(),
  logoUrl: v.optional(v.string()),
  slug: v.string(),
});

const perkSummary = v.object({
  _id: v.id("perks"),
  company: v.string(),
  title: v.string(),
});

const submittedTrackReturn = v.object({
  _id: v.id("tracks"),
  label: v.string(),
  slug: v.string(),
  submittedAt: v.number(),
  videoUrl: v.string(),
});

const submissionReturn = v.object({
  _id: v.id("submissions"),
  challengeIds: v.array(v.id("tracks")),
  challenges: v.array(challengeSummary),
  createdAt: v.number(),
  description: v.string(),
  name: v.string(),
  perkIds: v.array(v.id("perks")),
  perks: v.array(perkSummary),
  status: submissionStatusValidator,
  submittedAt: v.optional(v.number()),
  submittedBy: v.id("users"),
  submittedTracks: v.array(submittedTrackReturn),
  teamId: v.optional(v.id("teams")),
  teamLogoUrl: v.optional(v.string()),
  teamName: v.optional(v.string()),
  techStack: v.array(v.string()),
  updatedAt: v.number(),
  urls: urlsValidator,
});

function uniqueIds<T extends string>(ids: T[]): T[] {
  return [...new Set(ids)];
}

function recordedTrackVideos(submission: Doc<"submissions">) {
  if (submission.trackVideos && submission.trackVideos.length > 0) {
    return submission.trackVideos;
  }
  if (submission.status !== "submitted") {
    return [];
  }
  const videoUrl = urlOf(submission.urls, "video");
  if (!videoUrl) {
    return [];
  }
  const submittedAt = submission.submittedAt ?? submission.updatedAt;
  return submission.challengeIds.map((trackId) => ({
    submittedAt,
    trackId,
    videoUrl,
  }));
}

async function hydrateSubmission(
  ctx: QueryCtx | MutationCtx,
  submission: Doc<"submissions">
) {
  const team = submission.teamId ? await ctx.db.get(submission.teamId) : null;
  const challenges = [];
  for (const trackId of submission.challengeIds) {
    const track = await ctx.db.get(trackId);
    if (track) {
      challenges.push({
        _id: track._id,
        label: track.label,
        logoUrl: track.logoUrl,
        slug: track.slug,
      });
    }
  }
  const submittedTracks = [];
  for (const entry of recordedTrackVideos(submission)) {
    const track = await ctx.db.get(entry.trackId);
    if (track) {
      submittedTracks.push({
        _id: track._id,
        label: track.label,
        slug: track.slug,
        submittedAt: entry.submittedAt,
        videoUrl: entry.videoUrl,
      });
    }
  }
  const perks = [];
  for (const perkId of submission.perkIds) {
    const perk = await ctx.db.get(perkId);
    if (perk) {
      perks.push({
        _id: perk._id,
        company: perk.company,
        title: perk.title,
      });
    }
  }
  return {
    _id: submission._id,
    challengeIds: submission.challengeIds,
    challenges,
    createdAt: submission.createdAt,
    description: submission.description,
    name: submission.name,
    perkIds: submission.perkIds,
    perks,
    status: submission.status,
    submittedAt: submission.submittedAt,
    submittedBy: submission.submittedBy,
    submittedTracks,
    teamId: submission.teamId,
    teamLogoUrl: teamLogoUrlFor(team),
    teamName: team?.name,
    // The scan lands on whichever has the repo; the team's covers a project
    // that never got its own repo URL.
    techStack: submission.techStack?.length
      ? submission.techStack
      : (team?.techStack ?? []),
    updatedAt: submission.updatedAt,
    urls: submission.urls,
  };
}

async function resolveChallengeIds(
  ctx: MutationCtx,
  challengeIds: Id<"tracks">[],
  requireActive: boolean,
  existing: Doc<"submissions"> | null
): Promise<Id<"tracks">[]> {
  const unique = [...new Set(challengeIds)];
  // A project keeps the place it already holds; only a new entry needs room.
  const added = unique.filter(
    (trackId) => !existing?.challengeIds.includes(trackId)
  );
  const counts =
    added.length > 0 ? await trackEntryCounts(ctx, existing?._id) : null;
  const tracks = await Promise.all(unique.map((trackId) => ctx.db.get(trackId)));
  if (tracks.some((track) => !track)) {
    throw new Error("Reto no encontrado");
  }
  const resolvedTracks = tracks.filter((track) => track !== null);
  if (!isTrackCombinationAllowed(resolvedTracks)) {
    fail(
      "VALIDATION",
      "Un equipo puede entrar en un track, o en dos si uno es THEKER."
    );
  }
  for (const track of resolvedTracks) {
    if (requireActive && !track.active) {
      throw new Error(`${track.label} no está abierto`);
    }
    if (
      added.includes(track._id) &&
      (counts?.get(track._id) ?? 0) >= MAX_TEAMS_PER_TRACK
    ) {
      fail(
        "TRACK_FULL",
        `${track.label} ya tiene ${MAX_TEAMS_PER_TRACK} equipos. Únete a otro track.`
      );
    }
  }
  return unique;
}

async function resolvePerkIds(
  ctx: MutationCtx,
  perkIds: Id<"perks">[]
): Promise<Id<"perks">[]> {
  const unique = [...new Set(perkIds)];
  for (const perkId of unique) {
    const perk = await ctx.db.get(perkId);
    if (!perk) {
      throw new Error("Perk de partner no encontrado");
    }
  }
  return unique;
}

async function nextGeneralGroup(ctx: MutationCtx): Promise<number> {
  const [settings, submitted] = await Promise.all([
    ctx.db
      .query("judgingSettings")
      .withIndex("by_key", (q) => q.eq("key", JUDGING_SETTINGS_KEY))
      .unique(),
    ctx.db
      .query("submissions")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .collect(),
  ]);
  const groupCount = settings?.generalGroupCount ?? DEFAULT_GENERAL_GROUP_COUNT;
  return pickBalancedGroup(countGroups(submitted, groupCount), groupCount);
}

function projectUrls(repoUrl?: string, demoUrl?: string, videoUrl?: string) {
  return buildUrls([
    { kind: "repo", url: repoUrl },
    { kind: "demo", url: demoUrl },
    { kind: "video", url: videoUrl },
  ]);
}

export const mine = onboardedQuery({
  args: {},
  handler: async (ctx) => {
    const submission = await findOwnedSubmission(ctx, ctx.user._id);
    if (!submission) {
      return null;
    }
    return await hydrateSubmission(ctx, submission);
  },
  returns: v.union(submissionReturn, v.null()),
});

const projectArgs = {
  challengeIds: v.array(v.id("tracks")),
  demoUrl: v.optional(v.string()),
  description: v.string(),
  name: v.string(),
  perkIds: v.array(v.id("perks")),
  repoUrl: v.optional(v.string()),
  videoUrl: v.optional(v.string()),
};

export const saveDraft = onboardedMutation({
  args: projectArgs,
  handler: async (ctx, args) => {
    const existing = await findOwnedSubmission(ctx, ctx.user._id);
    if (existing && existing.status === "submitted") {
      throw new Error("Este proyecto ya está enviado");
    }

    const challengeIds = await resolveChallengeIds(
      ctx,
      args.challengeIds,
      false,
      existing
    );
    const perkIds = await resolvePerkIds(ctx, args.perkIds);
    const membership = await membershipForUser(ctx, ctx.user._id);
    const now = Date.now();
    const fields = {
      challengeIds,
      description: args.description.trim(),
      name: args.name.trim(),
      perkIds,
      status: "draft" as const,
      submittedBy: ctx.user._id,
      teamId: membership?.teamId,
      updatedAt: now,
      urls: projectUrls(
        args.repoUrl,
        args.demoUrl,
        args.videoUrl ?? urlOf(existing?.urls, "video")
      ),
    };

    const submissionId = existing
      ? (await ctx.db.patch(existing._id, fields), existing._id)
      : await ctx.db.insert("submissions", {
          ...fields,
          createdAt: now,
        });
    const repoUrl = args.repoUrl ?? urlOf(fields.urls, "repo");
    if (repoUrl) {
      await scheduleStackScan(ctx, {
        force: false,
        repoUrls: [repoUrl],
        submissionId,
        teamId: membership?.teamId,
        userId: ctx.user._id,
      });
    }
    return submissionId;
  },
  returns: v.id("submissions"),
});

const commitArgs = {
  challengeId: v.id("tracks"),
  demoUrl: v.optional(v.string()),
  name: v.string(),
  perkIds: v.array(v.id("perks")),
  repoUrl: v.string(),
  teamId: v.optional(v.id("teams")),
  videoUrl: v.string(),
};

export const commitTrack = internalMutation({
  args: commitArgs,
  handler: async (ctx, args) => {
    const user = await requireOnboarded(ctx);
    let existing;
    let teamId: Id<"teams"> | undefined;
    let submittedBy: Id<"users">;

    if (args.teamId) {
      if (!isAdmin(user)) {
        throw new Error("Se necesita acceso de admin");
      }
      const team = await ctx.db.get(args.teamId);
      if (!team) {
        throw new Error("Equipo no encontrado");
      }
      existing = await findTeamSubmission(ctx, args.teamId);
      teamId = args.teamId;
      submittedBy = existing?.submittedBy ?? team.ownerId;
    } else {
      if (!(await submissionsAreOpen(ctx))) {
        throw new Error("El envío de proyectos aún no está abierto");
      }
      existing = await findOwnedSubmission(ctx, user._id);
      const membership = await membershipForUser(ctx, user._id);
      teamId = membership?.teamId ?? existing?.teamId;
      submittedBy = existing?.submittedBy ?? user._id;
    }

    const [challengeId] = await resolveChallengeIds(
      ctx,
      [args.challengeId],
      true,
      existing
    );
    if (!challengeId) {
      throw new Error("Reto no encontrado");
    }
    if (
      existing &&
      existing.challengeIds.length > 0 &&
      !existing.challengeIds.includes(challengeId)
    ) {
      fail("VALIDATION", "El equipo no está apuntado a este reto.");
    }
    const perkIds = await resolvePerkIds(ctx, args.perkIds);
    const already = existing ? recordedTrackVideos(existing) : [];
    if (already.some((entry) => entry.trackId === challengeId)) {
      throw new Error("Este reto ya está enviado");
    }

    const now = Date.now();
    const firstSubmit = !existing || existing.status !== "submitted";
    const trackVideos = [
      ...already,
      { submittedAt: now, trackId: challengeId, videoUrl: args.videoUrl },
    ];
    const challengeIds = uniqueIds([
      ...(existing?.challengeIds ?? []),
      challengeId,
    ]);
    const firstVideo =
      urlOf(existing?.urls, "video") ?? already[0]?.videoUrl ?? args.videoUrl;
    const fields = {
      challengeIds,
      description: existing?.description ?? "",
      name: args.name,
      perkIds: perkIds.length > 0 ? perkIds : (existing?.perkIds ?? []),
      status: "submitted" as const,
      submittedAt: existing?.submittedAt ?? now,
      submittedBy,
      teamId,
      trackVideos,
      updatedAt: now,
      urls: projectUrls(args.repoUrl, args.demoUrl, firstVideo),
      ...(firstSubmit
        ? {
            generalGroup:
              existing?.generalGroup ?? (await nextGeneralGroup(ctx)),
          }
        : {}),
    };

    const submissionId = existing
      ? (await ctx.db.patch(existing._id, fields), existing._id)
      : await ctx.db.insert("submissions", {
          ...fields,
          createdAt: now,
        });
    await scheduleStackScan(ctx, {
      force: true,
      repoUrls: [args.repoUrl],
      submissionId,
      teamId,
      userId: submittedBy,
    });
    return submissionId;
  },
  returns: v.id("submissions"),
});

const submitArgs = {
  challengeId: v.id("tracks"),
  demoUrl: v.optional(v.string()),
  name: v.string(),
  perkIds: v.optional(v.array(v.id("perks"))),
  repoUrl: v.string(),
  videoUrl: v.string(),
};

async function submitTrack(
  ctx: ActionCtx,
  args: {
    challengeId: Id<"tracks">;
    demoUrl?: string;
    name: string;
    perkIds?: Id<"perks">[];
    repoUrl: string;
    teamId?: Id<"teams">;
    videoUrl: string;
  }
): Promise<Id<"submissions">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("No has iniciado sesión");
  }

  const name = parseProjectName(args.name);
  if (!name.ok) {
    throw new Error(name.message);
  }
  const video = parseYoutubeWatchUrl(args.videoUrl);
  if (!video.ok) {
    throw new Error(video.message);
  }
  const repo = parseGithubRepoUrl(args.repoUrl);
  if (!repo.ok) {
    throw new Error(repo.message);
  }
  const demo = parseOptionalProductUrl(args.demoUrl);
  if (!demo.ok) {
    throw new Error(demo.message);
  }
  const publicRepo = await inspectPublicGithubRepo(repo.value);
  if (!publicRepo.ok) {
    throw new Error(publicRepo.message);
  }

  return await ctx.runMutation(internal.submissions.commitTrack, {
    challengeId: args.challengeId,
    demoUrl: demo.value,
    name: name.value,
    perkIds: args.perkIds ?? [],
    repoUrl: publicRepo.url,
    teamId: args.teamId,
    videoUrl: video.value,
  });
}

export const submit = action({
  args: submitArgs,
  handler: submitTrack,
  returns: v.id("submissions"),
});

export const adminSubmit = action({
  args: { ...submitArgs, teamId: v.id("teams") },
  handler: submitTrack,
  returns: v.id("submissions"),
});

export const adminForTeam = adminQuery({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      return null;
    }
    const submission = await findTeamSubmission(ctx, args.teamId);
    return {
      name: team.name,
      repoUrl: team.repoUrl ?? "",
      submission: submission ? await hydrateSubmission(ctx, submission) : null,
    };
  },
  returns: v.union(
    v.object({
      name: v.string(),
      repoUrl: v.string(),
      submission: v.union(submissionReturn, v.null()),
    }),
    v.null()
  ),
});

export const verifyRepo = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("No has iniciado sesión");
    }
    const parsed = parseGithubRepoUrl(args.url);
    if (!parsed.ok) {
      return { message: parsed.message, ok: false as const };
    }
    const checked = await inspectPublicGithubRepo(parsed.value);
    if (!checked.ok) {
      return { message: checked.message, ok: false as const };
    }
    return { message: "Repo público", ok: true as const, url: checked.url };
  },
  returns: v.object({
    message: v.string(),
    ok: v.boolean(),
    url: v.optional(v.string()),
  }),
});

const publicSubmissionReturn = v.object({
  _id: v.id("submissions"),
  challenges: v.array(challengeSummary),
  description: v.string(),
  name: v.string(),
  status: submissionStatusValidator,
  submittedAt: v.optional(v.number()),
  teamId: v.optional(v.id("teams")),
  teamLogoUrl: v.optional(v.string()),
  teamName: v.optional(v.string()),
  updatedAt: v.number(),
  urls: urlsValidator,
});

export const listPublic = onboardedQuery({
  args: {},
  handler: async (ctx) => {
    const submissions = await ctx.db.query("submissions").collect();
    const rows = [];
    for (const submission of submissions) {
      if (submission.status === "draft" && !submission.name.trim()) {
        continue;
      }
      const hydrated = await hydrateSubmission(ctx, submission);
      rows.push({
        _id: hydrated._id,
        teamId: hydrated.teamId,
        teamLogoUrl: hydrated.teamLogoUrl,
        teamName: hydrated.teamName,
        name: hydrated.name,
        description:
          hydrated.status === "submitted" ? hydrated.description : "",
        urls: hydrated.urls,
        challenges: hydrated.challenges,
        status: hydrated.status,
        updatedAt: hydrated.updatedAt,
        submittedAt: hydrated.submittedAt,
      });
    }
    return rows.toSorted((a, b) => {
      if (a.status !== b.status) {
        return a.status === "submitted" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "es");
    });
  },
  returns: v.array(publicSubmissionReturn),
});

export const adminList = adminQuery({
  args: {},
  handler: async (ctx) => {
    const submissions = await ctx.db.query("submissions").collect();
    const rows = await Promise.all(
      submissions.map((row) => hydrateSubmission(ctx, row))
    );
    return rows.toSorted((a, b) => b.updatedAt - a.updatedAt);
  },
  returns: v.array(submissionReturn),
});
