import { v } from "convex/values";
import {
  adminMutation,
  adminQuery,
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
  JUDGE_COUNT,
  JUDGING_ROUND_KEY,
  JUDGING_SETTINGS_KEY,
  judgingComplete,
  pairProjects,
  prepareDraft,
  prepareSubmission,
  PROJECT_COUNT,
  rankProjects,
  requireAssignedJudge,
  resolveConflicts,
  seededShuffle,
  TOTAL_ASSESSMENTS,
  validatePairs,
} from "./lib/judging";
import type {
  Conflict,
  PairedObservation,
  PartialScores,
} from "./lib/judging";
import { teamLogoUrlFor } from "./lib/team";
import { urlsValidator } from "./lib/urls";
import { canJudge, grantsJudging } from "./lib/userTypes";
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
  ownCriteria: v.optional(scoreValueValidator),
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
    ownCriteria: row.ownCriteria,
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
 * The 13 people who judge: everyone whose user type grants judging plus the
 * legacy `judge` role. Admins organise and are left out even though the
 * gates let them open /judging.
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
    pool.set(user._id, user);
  }
  for (const type of types) {
    if (!grantsJudging({ role: "user" }, type)) {
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
  return user.role === "judge" || (await canJudge(ctx, user));
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

function projectFields(submission: Doc<"submissions">, catalog: Catalog) {
  const challenges = [];
  for (const trackId of submission.challengeIds) {
    const track = catalog.tracksById.get(trackId);
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
    urls: submission.urls,
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

async function anySubmittedAssessment(ctx: DbCtx): Promise<boolean> {
  const first = await ctx.db
    .query("assessments")
    .withIndex("by_status", (q) => q.eq("status", "submitted"))
    .first();
  return first !== null;
}

function ownAssessmentView(row: Doc<"assessments">) {
  return {
    craftsmanship: row.craftsmanship,
    creativity: row.creativity,
    ownCriteria: row.ownCriteria,
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
    ownCriteria: scoreValueValidator,
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
    const [settings, settingsDoc, round, pool, catalog, assignments, assessments, conflicts, started] =
      await Promise.all([
        loadSettings(ctx),
        loadSettingsDoc(ctx),
        loadRound(ctx),
        loadJudgePool(ctx),
        loadCatalog(ctx),
        ctx.db.query("assessmentAssignments").collect(),
        ctx.db.query("assessments").collect(),
        ctx.db.query("judgingConflicts").collect(),
        anySubmittedAssessment(ctx),
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
          ownCriteria: row.ownCriteria,
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

    return {
      completion: {
        complete: round !== null && judgingComplete(submittedTotal),
        connected:
          round !== null && calibrationConnected(judgeIds, observations),
        submitted: submittedTotal,
        total: TOTAL_ASSESSMENTS,
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
        judgeCount: pool.length,
        projectCount: catalog.submitted.length,
        requiredJudges: JUDGE_COUNT,
        requiredProjects: PROJECT_COUNT,
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
        lambdaLocked: started,
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
      judgeCount: v.number(),
      projectCount: v.number(),
      requiredJudges: v.number(),
      requiredProjects: v.number(),
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
      lambdaLocked: v.boolean(),
      saved: v.boolean(),
    }),
  }),
});

const unresolvedConflict = v.object({
  judge: judgeRef,
  projectName: v.string(),
  submissionId: v.id("submissions"),
});

export const generateAssignments = adminMutation({
  args: {
    seed: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await loadRound(ctx);
    if (existing) {
      throw new Error("Las asignaciones ya están generadas y no se regeneran");
    }
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

    const seed = args.seed?.trim() || randomSeed();
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

    if (unresolved.length > 0) {
      const usersById = new Map(users.map((user) => [user._id, user]));
      const namesBySubmission = new Map(submitted.map((row) => [row._id, row.name]));
      return {
        ok: false as const,
        unresolved: unresolved.map((conflict) => {
          const judgeId = judgeIds[conflict.judge] as Id<"users">;
          const submissionId = submissionIds[conflict.project] as Id<"submissions">;
          return {
            judge: { _id: judgeId, name: judgeName(usersById.get(judgeId)) },
            projectName: namesBySubmission.get(submissionId) ?? "Proyecto",
            submissionId,
          };
        }),
      };
    }

    const now = Date.now();
    const roundId = await ctx.db.insert("judgingRounds", {
      generatedAt: now,
      generatedBy: ctx.user._id,
      judgeIds,
      key: JUDGING_ROUND_KEY,
      seed,
      submissionIds,
      swaps,
    });
    for (const pair of pairs) {
      const submissionId = submissionIds[pair.project] as Id<"submissions">;
      for (const slot of [0, 1] as const) {
        await ctx.db.insert("assessmentAssignments", {
          createdAt: now,
          judgeId: judgeIds[pair.judges[slot]] as Id<"users">,
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
    return { ok: true as const, seed, swaps };
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
        "Ya hay evaluaciones guardadas; las asignaciones no se pueden borrar"
      );
    }
    const rows = await ctx.db
      .query("assessmentAssignments")
      .withIndex("by_round", (q) => q.eq("roundId", round._id))
      .collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    await ctx.db.delete(round._id);
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
      if (await anySubmittedAssessment(ctx)) {
        throw new Error(
          "Lambda se fija antes de empezar a juzgar; ya hay evaluaciones enviadas"
        );
      }
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