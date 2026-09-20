import { v } from "convex/values";
import {
  adminMutation,
  adminQuery,
  catalogQuery,
  judgeMutation,
  judgeQuery,
} from "./lib/customFunctions";
import {
  assertLambda,
  assertPairingCounts,
  assertThreshold,
  assessmentScore,
  assessmentWriteKind,
  calibrationConnected,
  DEFAULT_DISAGREEMENT_THRESHOLD,
  DEFAULT_LAMBDA,
  estimateGenerosity,
  isFlagged,
  JUDGING_ROUND_KEY,
  JUDGING_SETTINGS_KEY,
  judgingComplete,
  pairingProblems,
  pairProjects,
  prepareDraft,
  prepareSubmission,
  rankProjects,
  requireAssignedJudge,
  resolveConflicts,
  seededShuffle,
  totalAssessments,
  validatePairs,
} from "./lib/judging";
import type {
  Conflict,
  Pair,
  PairedObservation,
  PartialScores,
} from "./lib/judging";
import { teamLogoUrlFor } from "./lib/team";
import { urlOf, urlsValidator } from "./lib/urls";
import { grantsJudging, isSponsorType, userTypeFor } from "./lib/userTypes";
import {
  assessmentStatusValidator,
  scoreValueValidator,
} from "./lib/validators";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type DbCtx = QueryCtx | MutationCtx;

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

const projectMeta = {
  _id: v.id("submissions"),
  challenges: v.array(challengeSummary),
  description: v.string(),
  members: v.array(v.string()),
  name: v.string(),
  perks: v.array(perkSummary),
  teamLogoUrl: v.optional(v.string()),
  teamName: v.optional(v.string()),
  techStack: v.array(v.string()),
  urls: urlsValidator,
};

const scoreFields = {
  craftsmanship: v.optional(scoreValueValidator),
  problemSolving: v.optional(scoreValueValidator),
  creativity: v.optional(scoreValueValidator),
  overall: v.optional(scoreValueValidator),
};

const ownAssessment = v.object({
  ...scoreFields,
  ownCriteriaComment: v.string(),
  rawScore: v.union(v.number(), v.null()),
  status: assessmentStatusValidator,
  submittedAt: v.optional(v.number()),
  updatedAt: v.number(),
});

const judgeRef = v.object({
  _id: v.id("users"),
  name: v.string(),
});

const adminAssessment = v.object({
  ...scoreFields,
  adjustedScore: v.union(v.number(), v.null()),
  judge: judgeRef,
  ownCriteriaComment: v.string(),
  rawScore: v.union(v.number(), v.null()),
  status: assessmentStatusValidator,
  submittedAt: v.optional(v.number()),
});

const adminProject = v.object({
  ...projectMeta,
  assessments: v.array(adminAssessment),
  calibratedMean: v.union(v.number(), v.null()),
  difference: v.union(v.number(), v.null()),
  flagged: v.boolean(),
  judges: v.array(judgeRef),
  rank: v.union(v.number(), v.null()),
  rawMean: v.union(v.number(), v.null()),
  submittedCount: v.number(),
});

const adminJudge = v.object({
  _id: v.id("users"),
  assigned: v.number(),
  drafts: v.number(),
  email: v.optional(v.string()),
  generosity: v.union(v.number(), v.null()),
  name: v.string(),
  submitted: v.number(),
});

type Catalog = {
  membersByTeam: Map<Id<"teams">, string[]>;
  perksById: Map<Id<"perks">, Doc<"perks">>;
  submitted: Doc<"submissions">[];
  teamsById: Map<Id<"teams">, Doc<"teams">>;
  tracksById: Map<Id<"tracks">, Doc<"tracks">>;
  usersById: Map<Id<"users">, Doc<"users">>;
};

type Settings = { disagreementThreshold: number; lambda: number };

function judgeName(user: Doc<"users"> | undefined): string {
  return user?.name?.trim() || user?.email || "Juez";
}

function scoresOf(row: Doc<"assessments">): PartialScores {
  return {
    craftsmanship: row.craftsmanship,
    creativity: row.creativity,
    overall: row.overall,
    problemSolving: row.problemSolving,
  };
}

function submittedScore(row: Doc<"assessments">): number | null {
  return assessmentScore({ ...scoresOf(row), status: row.status });
}

function randomSeed(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

async function loadSettingsDoc(ctx: DbCtx): Promise<Doc<"judgingSettings"> | null> {
  return await ctx.db
    .query("judgingSettings")
    .withIndex("by_key", (q) => q.eq("key", JUDGING_SETTINGS_KEY))
    .unique();
}

async function loadSettings(ctx: DbCtx): Promise<Settings> {
  const doc = await loadSettingsDoc(ctx);
  return {
    disagreementThreshold:
      doc?.disagreementThreshold ?? DEFAULT_DISAGREEMENT_THRESHOLD,
    lambda: doc?.lambda ?? DEFAULT_LAMBDA,
  };
}

async function loadRound(ctx: DbCtx): Promise<Doc<"judgingRounds"> | null> {
  return await ctx.db
    .query("judgingRounds")
    .withIndex("by_key", (q) => q.eq("key", JUDGING_ROUND_KEY))
    .unique();
}

/**
 * Everyone whose user type grants scoring. Sponsors share the judging tab
 * as a read-only catalog and stay out of the pairings. Admins organise.
 */
async function loadJudgePool(ctx: DbCtx): Promise<Doc<"users">[]> {
  const [legacy, types] = await Promise.all([
    ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "judge"))
      .collect(),
    ctx.db.query("userTypes").collect(),
  ]);
  const pool = new Map<Id<"users">, Doc<"users">>();
  for (const user of legacy) {
    if (isSponsorType(await userTypeFor(ctx, user))) {
      continue;
    }
    pool.set(user._id, user);
  }
  for (const type of types) {
    if (!grantsJudging({ role: "user" }, type) || isSponsorType(type)) {
      continue;
    }
    const rows = await ctx.db
      .query("users")
      .withIndex("by_user_type", (q) => q.eq("userTypeId", type._id))
      .collect();
    for (const user of rows) {
      pool.set(user._id, user);
    }
  }
  return [...pool.values()]
    .filter((user) => user.role !== "admin")
    .toSorted((a, b) => a._id.localeCompare(b._id));
}

async function isPoolJudge(ctx: DbCtx, user: Doc<"users">): Promise<boolean> {
  if (user.role === "admin") {
    return false;
  }
  const type = await userTypeFor(ctx, user);
  if (isSponsorType(type)) {
    return false;
  }
  return user.role === "judge" || grantsJudging(user, type);
}

async function loadCatalog(ctx: DbCtx): Promise<Catalog> {
  const [submitted, tracks, teams, perks, members, users] = await Promise.all([
    ctx.db
      .query("submissions")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .collect(),
    ctx.db.query("tracks").collect(),
    ctx.db.query("teams").collect(),
    ctx.db.query("perks").collect(),
    ctx.db.query("teamMembers").collect(),
    ctx.db.query("users").collect(),
  ]);
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
    submitted: submitted.toSorted((a, b) => a._id.localeCompare(b._id)),
    teamsById: new Map(teams.map((team) => [team._id, team])),
    tracksById: new Map(tracks.map((track) => [track._id, track])),
    usersById,
  };
}

function videoForTrack(
  submission: Doc<"submissions">,
  trackId: Id<"tracks">
): string | undefined {
  const recorded = submission.trackVideos?.find((row) => row.trackId === trackId);
  if (recorded?.videoUrl) {
    return recorded.videoUrl;
  }
  if (submission.challengeIds.includes(trackId)) {
    return urlOf(submission.urls, "video");
  }
  return undefined;
}

function projectFields(
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

async function requireAssignment(
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

async function findAssessment(
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

function ownAssessmentView(row: Doc<"assessments">) {
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

export const myQueue = judgeQuery({
  args: {},
  handler: async (ctx) => {
    const [round, assignments, assessments, catalog] = await Promise.all([
      loadRound(ctx),
      ctx.db
        .query("assessmentAssignments")
        .withIndex("by_judge", (q) => q.eq("judgeId", ctx.user._id))
        .collect(),
      ctx.db
        .query("assessments")
        .withIndex("by_judge", (q) => q.eq("judgeId", ctx.user._id))
        .collect(),
      loadCatalog(ctx),
    ]);
    const bySubmission = new Map(
      catalog.submitted.map((submission) => [submission._id, submission])
    );
    const assessmentBySubmission = new Map(
      assessments.map((row) => [row.submissionId, row])
    );
    const items = [];
    let submittedCount = 0;
    for (const assignment of assignments) {
      const submission = bySubmission.get(assignment.submissionId);
      if (!submission) {
        continue;
      }
      const row = assessmentBySubmission.get(submission._id);
      if (row?.status === "submitted") {
        submittedCount += 1;
      }
      items.push({
        ...projectFields(submission, catalog),
        assessment: row ? ownAssessmentView(row) : null,
      });
    }
    const order = (status: "draft" | "submitted" | undefined) => {
      if (status === "submitted") {
        return 2;
      }
      return status === "draft" ? 1 : 0;
    };
    return {
      hasRound: round !== null,
      items: items.toSorted(
        (a, b) =>
          order(a.assessment?.status) - order(b.assessment?.status) ||
          a.name.localeCompare(b.name, "es")
      ),
      submittedCount,
    };
  },
  returns: v.object({
    hasRound: v.boolean(),
    items: v.array(
      v.object({
        ...projectMeta,
        assessment: v.union(ownAssessment, v.null()),
      })
    ),
    submittedCount: v.number(),
  }),
});

export const trackCatalog = catalogQuery({
  args: { trackSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const catalog = await loadCatalog(ctx);
    const tracks = [...catalog.tracksById.values()]
      .filter((track) => track.active)
      .toSorted(
        (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "es")
      );
    const counts = new Map<Id<"tracks">, number>();
    for (const submission of catalog.submitted) {
      for (const challengeId of new Set(submission.challengeIds)) {
        counts.set(challengeId, (counts.get(challengeId) ?? 0) + 1);
      }
    }
    const wanted = args.trackSlug?.trim();
    const selectedTrack =
      (wanted ? tracks.find((track) => track.slug === wanted) : undefined) ??
      tracks[0] ??
      null;
    const selected = selectedTrack?._id ?? null;
    const items = [];
    if (selected) {
      for (const submission of catalog.submitted) {
        if (!submission.challengeIds.includes(selected)) {
          continue;
        }
        items.push(projectFields(submission, catalog, selected));
      }
    }
    return {
      items: items.toSorted((a, b) => a.name.localeCompare(b.name, "es")),
      selectedTrackId: selected,
      tracks: tracks.map((track) => ({
        _id: track._id,
        label: track.label,
        logoUrl: track.logoUrl,
        slug: track.slug,
        submittedCount: counts.get(track._id) ?? 0,
      })),
    };
  },
  returns: v.object({
    items: v.array(v.object(projectMeta)),
    selectedTrackId: v.union(v.id("tracks"), v.null()),
    tracks: v.array(
      v.object({
        ...challengeSummary.fields,
        submittedCount: v.number(),
      })
    ),
  }),
});

async function writeAssessment(
  ctx: MutationCtx,
  judgeId: Id<"users">,
  submissionId: Id<"submissions">,
  existing: Doc<"assessments"> | null,
  fields: Omit<
    Doc<"assessments">,
    "_id" | "_creationTime" | "createdAt" | "judgeId" | "submissionId"
  >
): Promise<void> {
  const now = Date.now();
  if (assessmentWriteKind(existing) === "replace" && existing) {
    await ctx.db.replace(existing._id, {
      ...fields,
      createdAt: existing.createdAt,
      judgeId,
      submissionId,
    });
    return;
  }
  await ctx.db.insert("assessments", {
    ...fields,
    createdAt: now,
    judgeId,
    submissionId,
  });
}

export const saveDraft = judgeMutation({
  args: {
    ...scoreFields,
    ownCriteriaComment: v.string(),
    submissionId: v.id("submissions"),
  },
  handler: async (ctx, args) => {
    const { submissionId, ownCriteriaComment, ...scores } = args;
    await requireAssignment(ctx, ctx.user._id, submissionId);
    const existing = await findAssessment(ctx, ctx.user._id, submissionId);
    const draft = prepareDraft(existing, { ownCriteriaComment, scores });
    await writeAssessment(ctx, ctx.user._id, submissionId, existing, {
      ...draft.scores,
      ownCriteriaComment: draft.ownCriteriaComment,
      status: draft.status,
      updatedAt: Date.now(),
    });
    return null;
  },
  returns: v.null(),
});

export const submit = judgeMutation({
  args: {
    craftsmanship: scoreValueValidator,
    creativity: scoreValueValidator,
    overall: scoreValueValidator,
    ownCriteriaComment: v.string(),
    problemSolving: scoreValueValidator,
    submissionId: v.id("submissions"),
  },
  handler: async (ctx, args) => {
    const { submissionId, ownCriteriaComment, ...scores } = args;
    const submission = prepareSubmission({ ownCriteriaComment, scores });
    await requireAssignment(ctx, ctx.user._id, submissionId);
    const existing = await findAssessment(ctx, ctx.user._id, submissionId);
    const now = Date.now();
    await writeAssessment(ctx, ctx.user._id, submissionId, existing, {
      ...submission.scores,
      ownCriteriaComment: submission.ownCriteriaComment,
      status: submission.status,
      submittedAt: now,
      updatedAt: now,
    });
    return null;
  },
  returns: v.null(),
});

// --- Organiser --------------------------------------------------------------

export const adminOverview = adminQuery({
  args: {},
  handler: async (ctx) => {
    const [settings, settingsDoc, round, pool, catalog, assignments, assessments, conflicts] =
      await Promise.all([
        loadSettings(ctx),
        loadSettingsDoc(ctx),
        loadRound(ctx),
        loadJudgePool(ctx),
        loadCatalog(ctx),
        ctx.db.query("assessmentAssignments").collect(),
        ctx.db.query("assessments").collect(),
        ctx.db.query("judgingConflicts").collect(),
      ]);

    const judgeIds: Id<"users">[] = round
      ? round.judgeIds
      : pool.map((user) => user._id);
    const judgeSet = new Set(judgeIds);
    const refOf = (judgeId: Id<"users">) => ({
      _id: judgeId,
      name: judgeName(catalog.usersById.get(judgeId)),
    });

    const assignmentsBySubmission = new Map<Id<"submissions">, Doc<"assessmentAssignments">[]>();
    const assignedPerJudge = new Map<Id<"users">, number>();
    for (const row of assignments) {
      const list = assignmentsBySubmission.get(row.submissionId) ?? [];
      list.push(row);
      assignmentsBySubmission.set(row.submissionId, list);
      assignedPerJudge.set(row.judgeId, (assignedPerJudge.get(row.judgeId) ?? 0) + 1);
    }

    const assessmentsBySubmission = new Map<Id<"submissions">, Doc<"assessments">[]>();
    const submittedPerJudge = new Map<Id<"users">, number>();
    const draftsPerJudge = new Map<Id<"users">, number>();
    let submittedTotal = 0;
    for (const row of assessments) {
      const list = assessmentsBySubmission.get(row.submissionId) ?? [];
      list.push(row);
      assessmentsBySubmission.set(row.submissionId, list);
      if (row.status === "submitted") {
        submittedTotal += 1;
        submittedPerJudge.set(row.judgeId, (submittedPerJudge.get(row.judgeId) ?? 0) + 1);
      } else {
        draftsPerJudge.set(row.judgeId, (draftsPerJudge.get(row.judgeId) ?? 0) + 1);
      }
    }

    const observations: PairedObservation<Id<"users">>[] = [];
    const scored = [];
    for (const submission of catalog.submitted) {
      const rows = (assessmentsBySubmission.get(submission._id) ?? []).toSorted(
        (a, b) => a.judgeId.localeCompare(b.judgeId)
      );
      const submitted = [];
      for (const row of rows) {
        const score = submittedScore(row);
        if (score !== null && judgeSet.has(row.judgeId)) {
          submitted.push({ judge: row.judgeId, score });
        }
      }
      if (submitted.length === 2) {
        const [a, b] = submitted as [
          (typeof submitted)[number],
          (typeof submitted)[number],
        ];
        observations.push({
          judgeA: a.judge,
          judgeB: b.judge,
          scoreA: a.score,
          scoreB: b.score,
        });
      }
      scored.push({ project: submission._id, assessments: submitted });
    }

    const generosity = round
      ? estimateGenerosity(judgeIds, observations, settings.lambda)
      : new Map<Id<"users">, number>();
    const results = rankProjects(scored, generosity);
    const resultBySubmission = new Map(results.map((result) => [result.project, result]));

    const projects = catalog.submitted.map((submission) => {
      const result = resultBySubmission.get(submission._id);
      const adjustedByJudge = new Map(
        (result?.assessments ?? []).map((row) => [row.judge, row.adjusted])
      );
      const rows = (assessmentsBySubmission.get(submission._id) ?? []).toSorted(
        (a, b) => a.judgeId.localeCompare(b.judgeId)
      );
      const judges = (assignmentsBySubmission.get(submission._id) ?? [])
        .toSorted((a, b) => a.slot - b.slot)
        .map((row) => refOf(row.judgeId));
      return {
        ...projectFields(submission, catalog),
        assessments: rows.map((row) => ({
          adjustedScore: adjustedByJudge.get(row.judgeId) ?? null,
          craftsmanship: row.craftsmanship,
          creativity: row.creativity,
          judge: refOf(row.judgeId),
          overall: row.overall,
          ownCriteriaComment: row.ownCriteriaComment,
          problemSolving: row.problemSolving,
          rawScore: submittedScore(row),
          status: row.status,
          submittedAt: row.submittedAt,
        })),
        calibratedMean: result?.calibratedMean ?? null,
        difference: result?.difference ?? null,
        flagged: isFlagged(result?.difference ?? null, settings.disagreementThreshold),
        judges,
        rank: result?.rank ?? null,
        rawMean: result?.rawMean ?? null,
        submittedCount: rows.filter((row) => row.status === "submitted").length,
      };
    });

    const judges = judgeIds.map((judgeId) => {
      const user = catalog.usersById.get(judgeId);
      return {
        _id: judgeId,
        assigned: assignedPerJudge.get(judgeId) ?? 0,
        drafts: draftsPerJudge.get(judgeId) ?? 0,
        email: user?.email,
        generosity: round ? (generosity.get(judgeId) ?? null) : null,
        name: judgeName(user),
        submitted: submittedPerJudge.get(judgeId) ?? 0,
      };
    });

    const submissionNames = new Map(
      catalog.submitted.map((submission) => [submission._id, submission.name])
    );

    const assignedProjects = round?.submissionIds.length ?? 0;
    const assessmentTotal = totalAssessments(assignedProjects);
    const pairing = pairingProblems(pool.length, catalog.submitted.length);
    let loadMin = 0;
    let loadMax = 0;
    if (pairing.length === 0) {
      const perJudge = Array.from({ length: pool.length }, () => 0);
      for (const pair of pairProjects(pool.length, catalog.submitted.length)) {
        for (const judge of pair.judges) {
          perJudge[judge] = (perJudge[judge] ?? 0) + 1;
        }
      }
      const used = perJudge.filter((count) => count > 0);
      loadMin = used.length > 0 ? Math.min(...used) : 0;
      loadMax = used.length > 0 ? Math.max(...used) : 0;
    }

    return {
      completion: {
        complete: round !== null && judgingComplete(submittedTotal, assessmentTotal),
        connected:
          round !== null && calibrationConnected(judgeIds, observations),
        submitted: submittedTotal,
        total: assessmentTotal,
      },
      conflicts: conflicts
        .map((conflict) => ({
          _id: conflict._id,
          judge: refOf(conflict.judgeId),
          note: conflict.note,
          projectName: submissionNames.get(conflict.submissionId) ?? "Proyecto",
          submissionId: conflict.submissionId,
        }))
        .toSorted((a, b) => a.judge.name.localeCompare(b.judge.name, "es")),
      judges,
      pool: {
        feasible: pairing.length === 0,
        judgeCount: pool.length,
        loadMax,
        loadMin,
        problems: pairing,
        projectCount: catalog.submitted.length,
      },
      projects: projects.toSorted((a, b) => {
        if ((a.rank === null) !== (b.rank === null)) {
          return a.rank === null ? 1 : -1;
        }
        if (a.rank !== null && b.rank !== null && a.rank !== b.rank) {
          return a.rank - b.rank;
        }
        return a.name.localeCompare(b.name, "es");
      }),
      round: round
        ? {
            canReset: assessments.length === 0,
            generatedAt: round.generatedAt,
            seed: round.seed,
            swaps: round.swaps,
          }
        : null,
      settings: {
        disagreementThreshold: settings.disagreementThreshold,
        lambda: settings.lambda,
        saved: settingsDoc !== null,
      },
    };
  },
  returns: v.object({
    completion: v.object({
      complete: v.boolean(),
      connected: v.boolean(),
      submitted: v.number(),
      total: v.number(),
    }),
    conflicts: v.array(
      v.object({
        _id: v.id("judgingConflicts"),
        judge: judgeRef,
        note: v.optional(v.string()),
        projectName: v.string(),
        submissionId: v.id("submissions"),
      })
    ),
    judges: v.array(adminJudge),
    pool: v.object({
      feasible: v.boolean(),
      judgeCount: v.number(),
      loadMax: v.number(),
      loadMin: v.number(),
      problems: v.array(v.string()),
      projectCount: v.number(),
    }),
    projects: v.array(adminProject),
    round: v.union(
      v.object({
        canReset: v.boolean(),
        generatedAt: v.number(),
        seed: v.string(),
        swaps: v.number(),
      }),
      v.null()
    ),
    settings: v.object({
      disagreementThreshold: v.number(),
      lambda: v.number(),
      saved: v.boolean(),
    }),
  }),
});

const unresolvedConflict = v.object({
  judge: judgeRef,
  projectName: v.string(),
  submissionId: v.id("submissions"),
});

const previewJudge = v.object({
  _id: v.id("users"),
  assigned: v.number(),
  name: v.string(),
  projects: v.array(v.string()),
});

type PlannedRound = {
  judgeIds: Id<"users">[];
  pairs: Pair[];
  seed: string;
  submissionIds: Id<"submissions">[];
  submitted: Doc<"submissions">[];
  swaps: number;
  unresolved: Conflict[];
  usersById: Map<Id<"users">, Doc<"users">>;
};

function mapUnresolved(plan: PlannedRound) {
  const namesBySubmission = new Map(
    plan.submitted.map((row) => [row._id, row.name])
  );
  return plan.unresolved.map((conflict) => {
    const judgeId = plan.judgeIds[conflict.judge] as Id<"users">;
    const submissionId = plan.submissionIds[conflict.project] as Id<"submissions">;
    return {
      judge: { _id: judgeId, name: judgeName(plan.usersById.get(judgeId)) },
      projectName: namesBySubmission.get(submissionId) ?? "Proyecto",
      submissionId,
    };
  });
}

function previewFromPlan(plan: PlannedRound) {
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

async function planAssignments(ctx: DbCtx, seed: string): Promise<PlannedRound> {
  const [pool, submitted, conflictRows, users] = await Promise.all([
    loadJudgePool(ctx),
    ctx.db
      .query("submissions")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .collect(),
    ctx.db.query("judgingConflicts").collect(),
    ctx.db.query("users").collect(),
  ]);
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
    throw new Error(`El reparto no cumple las garantías: ${problems.join("; ")}`);
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

async function wipeRound(
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

export const previewAssignments = adminQuery({
  args: { seed: v.string() },
  handler: async (ctx, args) => {
    const seed = args.seed.trim();
    if (!seed) {
      throw new Error("Indica una semilla para probar el reparto");
    }
    const plan = await planAssignments(ctx, seed);
    if (plan.unresolved.length > 0) {
      return { ok: false as const, unresolved: mapUnresolved(plan) };
    }
    return previewFromPlan(plan);
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      judges: v.array(previewJudge),
      seed: v.string(),
      swaps: v.number(),
    }),
    v.object({ ok: v.literal(false), unresolved: v.array(unresolvedConflict) })
  ),
});

export const generateAssignments = adminMutation({
  args: {
    replace: v.optional(v.boolean()),
    seed: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await loadRound(ctx);
    if (existing && args.replace !== true) {
      throw new Error("Las asignaciones ya están generadas. Usa replace para volver a repartir.");
    }

    const plan = await planAssignments(
      ctx,
      args.seed?.trim() || randomSeed()
    );
    if (plan.unresolved.length > 0) {
      return { ok: false as const, unresolved: mapUnresolved(plan) };
    }

    if (existing) {
      await wipeRound(ctx, existing);
    }

    const now = Date.now();
    const roundId = await ctx.db.insert("judgingRounds", {
      generatedAt: now,
      generatedBy: ctx.user._id,
      judgeIds: plan.judgeIds,
      key: JUDGING_ROUND_KEY,
      seed: plan.seed,
      submissionIds: plan.submissionIds,
      swaps: plan.swaps,
    });
    for (const pair of plan.pairs) {
      const submissionId = plan.submissionIds[pair.project] as Id<"submissions">;
      for (const slot of [0, 1] as const) {
        await ctx.db.insert("assessmentAssignments", {
          createdAt: now,
          judgeId: plan.judgeIds[pair.judges[slot]] as Id<"users">,
          roundId,
          slot,
          submissionId,
        });
      }
    }
    if (!(await loadSettingsDoc(ctx))) {
      await ctx.db.insert("judgingSettings", {
        disagreementThreshold: DEFAULT_DISAGREEMENT_THRESHOLD,
        key: JUDGING_SETTINGS_KEY,
        lambda: DEFAULT_LAMBDA,
        updatedAt: now,
      });
    }
    return { ok: true as const, seed: plan.seed, swaps: plan.swaps };
  },
  returns: v.union(
    v.object({ ok: v.literal(true), seed: v.string(), swaps: v.number() }),
    v.object({ ok: v.literal(false), unresolved: v.array(unresolvedConflict) })
  ),
});

export const resetAssignments = adminMutation({
  args: {},
  handler: async (ctx) => {
    const round = await loadRound(ctx);
    if (!round) {
      return null;
    }
    const anyAssessment = await ctx.db.query("assessments").first();
    if (anyAssessment) {
      throw new Error(
        "Ya hay evaluaciones guardadas; vuelve a repartir para borrarlas"
      );
    }
    await wipeRound(ctx, round);
    return null;
  },
  returns: v.null(),
});

export const updateSettings = adminMutation({
  args: {
    disagreementThreshold: v.optional(v.number()),
    lambda: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await loadSettingsDoc(ctx);
    const current = await loadSettings(ctx);
    const patch: Partial<Settings> = {};
    if (args.lambda !== undefined && args.lambda !== current.lambda) {
      assertLambda(args.lambda);
      patch.lambda = args.lambda;
    }
    if (args.disagreementThreshold !== undefined) {
      assertThreshold(args.disagreementThreshold);
      patch.disagreementThreshold = args.disagreementThreshold;
    }
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...patch, updatedAt: now });
      return null;
    }
    await ctx.db.insert("judgingSettings", {
      disagreementThreshold:
        patch.disagreementThreshold ?? current.disagreementThreshold,
      key: JUDGING_SETTINGS_KEY,
      lambda: patch.lambda ?? current.lambda,
      updatedAt: now,
    });
    return null;
  },
  returns: v.null(),
});

export const addConflict = adminMutation({
  args: {
    judgeId: v.id("users"),
    note: v.optional(v.string()),
    submissionId: v.id("submissions"),
  },
  handler: async (ctx, args) => {
    const [judge, submission, existing] = await Promise.all([
      ctx.db.get(args.judgeId),
      ctx.db.get(args.submissionId),
      ctx.db
        .query("judgingConflicts")
        .withIndex("by_judge_submission", (q) =>
          q.eq("judgeId", args.judgeId).eq("submissionId", args.submissionId)
        )
        .unique(),
    ]);
    if (!judge || !(await isPoolJudge(ctx, judge))) {
      throw new Error("Esa persona no es juez");
    }
    if (!submission || submission.status !== "submitted") {
      throw new Error("Proyecto no encontrado");
    }
    if (existing) {
      return null;
    }
    const note = args.note?.trim();
    await ctx.db.insert("judgingConflicts", {
      createdAt: Date.now(),
      createdBy: ctx.user._id,
      judgeId: args.judgeId,
      note: note || undefined,
      submissionId: args.submissionId,
    });
    return null;
  },
  returns: v.null(),
});

export const removeConflict = adminMutation({
  args: {
    conflictId: v.id("judgingConflicts"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.conflictId);
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
  returns: v.null(),
});