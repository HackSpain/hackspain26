import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { currentEditionId } from "./editions";
import {
  assessmentScore,
  assertPairingCounts,
  DEFAULT_DISAGREEMENT_THRESHOLD,
  DEFAULT_LAMBDA,
  JUDGING_ROUND_KEY,
  JUDGING_SETTINGS_KEY,
  pairProjects,
  requireAssignedJudge,
  resolveConflicts,
  seededShuffle,
  validatePairs,
} from "./judging";
import type { Conflict, Pair, PartialScores } from "./judging";
import { teamLogoUrlFor } from "./team";
import { urlOf } from "./urls";
import { grantsJudging, userTypeFor } from "./userTypes";

type DbCtx = QueryCtx | MutationCtx;

export type Catalog = {
  membersByTeam: Map<Id<"teams">, string[]>;
  perksById: Map<Id<"perks">, Doc<"perks">>;
  submitted: Doc<"submissions">[];
  teamsById: Map<Id<"teams">, Doc<"teams">>;
  tracksById: Map<Id<"tracks">, Doc<"tracks">>;
  usersById: Map<Id<"users">, Doc<"users">>;
};

export async function loadJudgePool(
  ctx: DbCtx,
  editionId: Id<"editions">
): Promise<Doc<"users">[]> {
  const [types, participations] = await Promise.all([
    ctx.db.query("userTypes").collect(),
    ctx.db
      .query("participations")
      .withIndex("by_edition", (q) => q.eq("editionId", editionId))
      .collect(),
  ]);
  const judgingTypeIds = new Set(
    types
      .filter((type) => grantsJudging({ role: "user" }, type))
      .map((type) => type._id)
  );
  const pool = new Map<Id<"users">, Doc<"users">>();
  for (const row of participations) {
    if (!row.userId || !judgingTypeIds.has(row.roleId)) {
      continue;
    }
    const user = await ctx.db.get(row.userId);
    if (user && user.role !== "admin") {
      pool.set(user._id, user);
    }
  }
  return [...pool.values()].toSorted((a, b) => a._id.localeCompare(b._id));
}

export async function loadCatalog(
  ctx: DbCtx,
  editionId: Id<"editions">
): Promise<Catalog> {
  const [submissions, tracks, teams, perks, members, users] = await Promise.all(
    [
      ctx.db
        .query("submissions")
        .withIndex("by_edition", (q) => q.eq("editionId", editionId))
        .collect(),
      ctx.db
        .query("tracks")
        .withIndex("by_edition", (q) => q.eq("editionId", editionId))
        .collect(),
      ctx.db
        .query("teams")
        .withIndex("by_edition", (q) => q.eq("editionId", editionId))
        .collect(),
      ctx.db
        .query("perks")
        .withIndex("by_edition", (q) => q.eq("editionId", editionId))
        .collect(),
      ctx.db
        .query("teamMembers")
        .withIndex("by_edition", (q) => q.eq("editionId", editionId))
        .collect(),
      ctx.db.query("users").collect(),
    ]
  );
  const usersById = new Map(users.map((user) => [user._id, user]));
  const membersByTeam = new Map<Id<"teams">, string[]>();
  for (const member of members) {
    if (member.status !== "member") {
      continue;
    }
    const userName = member.userId
      ? usersById.get(member.userId)?.name?.trim()
      : undefined;
    const list = membersByTeam.get(member.teamId) ?? [];
    list.push(userName || member.identifier);
    membersByTeam.set(member.teamId, list);
  }
  return {
    membersByTeam,
    perksById: new Map(perks.map((perk) => [perk._id, perk])),
    submitted: submissions
      .filter((row) => row.status === "submitted")
      .toSorted((a, b) => a._id.localeCompare(b._id)),
    teamsById: new Map(teams.map((team) => [team._id, team])),
    tracksById: new Map(tracks.map((track) => [track._id, track])),
    usersById,
  };
}

export type Settings = { disagreementThreshold: number; lambda: number };

export function judgeName(user: Doc<"users"> | undefined): string {
  return user?.name?.trim() || user?.email || "Juez";
}

export function scoresOf(row: Doc<"assessments">): PartialScores {
  return {
    craftsmanship: row.craftsmanship,
    creativity: row.creativity,
    overall: row.overall,
    problemSolving: row.problemSolving,
  };
}

export function submittedScore(row: Doc<"assessments">): number | null {
  return assessmentScore({ ...scoresOf(row), status: row.status });
}

export function randomSeed(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

export async function loadSettingsDoc(
  ctx: DbCtx
): Promise<Doc<"judgingSettings"> | null> {
  return await ctx.db
    .query("judgingSettings")
    .withIndex("by_key", (q) => q.eq("key", JUDGING_SETTINGS_KEY))
    .unique();
}

export async function loadSettings(ctx: DbCtx): Promise<Settings> {
  const doc = await loadSettingsDoc(ctx);
  return {
    disagreementThreshold:
      doc?.disagreementThreshold ?? DEFAULT_DISAGREEMENT_THRESHOLD,
    lambda: doc?.lambda ?? DEFAULT_LAMBDA,
  };
}

export async function loadRound(
  ctx: DbCtx
): Promise<Doc<"judgingRounds"> | null> {
  return await ctx.db
    .query("judgingRounds")
    .withIndex("by_key", (q) => q.eq("key", JUDGING_ROUND_KEY))
    .unique();
}

export async function isPoolJudge(
  ctx: DbCtx,
  user: Doc<"users">
): Promise<boolean> {
  if (user.role === "admin") {
    return false;
  }
  const type = await userTypeFor(ctx, user);
  return user.role === "judge" || grantsJudging(user, type);
}

function videoForTrack(
  submission: Doc<"submissions">,
  trackId: Id<"tracks">
): string | undefined {
  const recorded = submission.trackVideos?.find(
    (row) => row.trackId === trackId
  );
  if (recorded?.videoUrl) {
    return recorded.videoUrl;
  }
  if (submission.challengeIds.includes(trackId)) {
    return urlOf(submission.urls, "video");
  }
  return undefined;
}

export function projectFields(
  submission: Doc<"submissions">,
  catalog: Catalog,
  trackId?: Id<"tracks">
) {
  const challenges = [];
  for (const challengeId of submission.challengeIds) {
    const track = catalog.tracksById.get(challengeId);
    if (track) {
      challenges.push({
        _id: track._id,
        label: track.label,
        logoUrl: track.logoUrl,
        slug: track.slug,
      });
    }
  }
  const perks = [];
  for (const perkId of submission.perkIds) {
    const perk = catalog.perksById.get(perkId);
    if (perk) {
      perks.push({ _id: perk._id, company: perk.company, title: perk.title });
    }
  }
  const team = submission.teamId
    ? catalog.teamsById.get(submission.teamId)
    : undefined;
  const videoUrl = trackId
    ? videoForTrack(submission, trackId)
    : urlOf(submission.urls, "video");
  const urls =
    videoUrl && urlOf(submission.urls, "video") !== videoUrl
      ? [
          ...submission.urls.filter((entry) => entry.kind !== "video"),
          { kind: "video" as const, url: videoUrl },
        ]
      : submission.urls;
  return {
    _id: submission._id,
    challenges,
    description: submission.description,
    members: submission.teamId
      ? (catalog.membersByTeam.get(submission.teamId) ?? [])
      : [],
    name: submission.name,
    perks,
    teamLogoUrl: teamLogoUrlFor(team),
    teamName: team?.name,
    techStack: submission.techStack?.length
      ? submission.techStack
      : (team?.techStack ?? []),
    urls,
  };
}

export async function requireAssignment(
  ctx: DbCtx,
  judgeId: Id<"users">,
  submissionId: Id<"submissions">
): Promise<void> {
  const row = await ctx.db
    .query("assessmentAssignments")
    .withIndex("by_judge_submission", (q) =>
      q.eq("judgeId", judgeId).eq("submissionId", submissionId)
    )
    .unique();
  requireAssignedJudge(row, judgeId);
}

export async function findAssessment(
  ctx: DbCtx,
  judgeId: Id<"users">,
  submissionId: Id<"submissions">
): Promise<Doc<"assessments"> | null> {
  return await ctx.db
    .query("assessments")
    .withIndex("by_judge_submission", (q) =>
      q.eq("judgeId", judgeId).eq("submissionId", submissionId)
    )
    .unique();
}

export function ownAssessmentView(row: Doc<"assessments">) {
  return {
    craftsmanship: row.craftsmanship,
    creativity: row.creativity,
    overall: row.overall,
    ownCriteriaComment: row.ownCriteriaComment,
    problemSolving: row.problemSolving,
    rawScore: submittedScore(row),
    status: row.status,
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
  };
}

export type PlannedRound = {
  judgeIds: Id<"users">[];
  pairs: Pair[];
  seed: string;
  submissionIds: Id<"submissions">[];
  submitted: Doc<"submissions">[];
  swaps: number;
  unresolved: Conflict[];
  usersById: Map<Id<"users">, Doc<"users">>;
};

export function mapUnresolved(plan: PlannedRound) {
  const namesBySubmission = new Map(
    plan.submitted.map((row) => [row._id, row.name])
  );
  return plan.unresolved.map((conflict) => {
    const judgeId = plan.judgeIds[conflict.judge] as Id<"users">;
    const submissionId = plan.submissionIds[
      conflict.project
    ] as Id<"submissions">;
    return {
      judge: { _id: judgeId, name: judgeName(plan.usersById.get(judgeId)) },
      projectName: namesBySubmission.get(submissionId) ?? "Proyecto",
      submissionId,
    };
  });
}

export function previewFromPlan(plan: PlannedRound) {
  const namesBySubmission = new Map(
    plan.submitted.map((row) => [row._id, row.name])
  );
  const projectsByJudge = new Map<Id<"users">, string[]>();
  for (const judgeId of plan.judgeIds) {
    projectsByJudge.set(judgeId, []);
  }
  for (const pair of plan.pairs) {
    const submissionId = plan.submissionIds[pair.project] as Id<"submissions">;
    const name = namesBySubmission.get(submissionId) ?? "Proyecto";
    for (const slot of pair.judges) {
      const judgeId = plan.judgeIds[slot] as Id<"users">;
      projectsByJudge.get(judgeId)?.push(name);
    }
  }
  return {
    ok: true as const,
    judges: plan.judgeIds
      .map((judgeId) => {
        const projects = (projectsByJudge.get(judgeId) ?? []).toSorted((a, b) =>
          a.localeCompare(b, "es")
        );
        return {
          _id: judgeId,
          assigned: projects.length,
          name: judgeName(plan.usersById.get(judgeId)),
          projects,
        };
      })
      .toSorted((a, b) => a.name.localeCompare(b.name, "es")),
    seed: plan.seed,
    swaps: plan.swaps,
  };
}

export async function planAssignments(
  ctx: DbCtx,
  seed: string
): Promise<PlannedRound> {
  const editionId = await currentEditionId(ctx);
  const [pool, submissions, conflictRows, users] = await Promise.all([
    loadJudgePool(ctx, editionId),
    ctx.db
      .query("submissions")
      .withIndex("by_edition", (q) => q.eq("editionId", editionId))
      .collect(),
    ctx.db
      .query("judgingConflicts")
      .withIndex("by_edition", (q) => q.eq("editionId", editionId))
      .collect(),
    ctx.db.query("users").collect(),
  ]);
  const submitted = submissions.filter((row) => row.status === "submitted");
  assertPairingCounts(pool.length, submitted.length);

  const judgeIds = seededShuffle(
    pool.map((user) => user._id),
    `${seed}:judges`
  );
  const submissionIds = seededShuffle(
    submitted.map((row) => row._id).toSorted((a, b) => a.localeCompare(b)),
    `${seed}:projects`
  );
  const judgeIndex = new Map(judgeIds.map((id, i) => [id, i]));
  const projectIndex = new Map(submissionIds.map((id, i) => [id, i]));

  const conflicts: Conflict[] = [];
  for (const row of conflictRows) {
    const judge = judgeIndex.get(row.judgeId);
    const project = projectIndex.get(row.submissionId);
    if (judge !== undefined && project !== undefined) {
      conflicts.push({ judge, project });
    }
  }

  const initial = pairProjects(judgeIds.length, submissionIds.length);
  const { pairs, swaps, unresolved } = resolveConflicts(
    initial,
    conflicts,
    judgeIds.length,
    submissionIds.length
  );
  const problems = validatePairs(pairs, judgeIds.length, submissionIds.length);
  if (problems.length > 0) {
    throw new Error(
      `El reparto no cumple las garantías: ${problems.join("; ")}`
    );
  }

  return {
    judgeIds,
    pairs,
    seed,
    submissionIds,
    submitted,
    swaps,
    unresolved,
    usersById: new Map(users.map((user) => [user._id, user])),
  };
}

export async function wipeRound(
  ctx: MutationCtx,
  round: Doc<"judgingRounds">
): Promise<void> {
  const [assignments, assessments] = await Promise.all([
    ctx.db
      .query("assessmentAssignments")
      .withIndex("by_round", (q) => q.eq("roundId", round._id))
      .collect(),
    ctx.db.query("assessments").collect(),
  ]);
  for (const row of assignments) {
    await ctx.db.delete(row._id);
  }
  for (const row of assessments) {
    await ctx.db.delete(row._id);
  }
  await ctx.db.delete(round._id);
}
