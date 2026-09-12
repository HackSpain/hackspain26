import { v } from "convex/values";
import { isAdmin, isJudge } from "./lib/auth";
import {
  adminMutation,
  adminQuery,
  judgeMutation,
  judgeQuery,
} from "./lib/customFunctions";
import {
  assertGroupCount,
  assertScore,
  assignRanks,
  assignmentFromRow,
  compareRanking,
  contextKey,
  countGroups,
  DEFAULT_GENERAL_GROUP_COUNT,
  JUDGING_SETTINGS_KEY,
  pickBalancedGroup,
  submissionInContext,
  visibleGeneralGroups,
} from "./lib/judging";
import { urlsValidator } from "./lib/urls";
import {
  judgingContextValidator,
  roleValidator,
  type JudgingContext,
} from "./lib/validators";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const challengeSummary = v.object({
  _id: v.id("tracks"),
  label: v.string(),
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
  generalGroup: v.optional(v.number()),
  members: v.array(v.string()),
  name: v.string(),
  perks: v.array(perkSummary),
  teamName: v.optional(v.string()),
  techStack: v.array(v.string()),
  urls: urlsValidator,
};

const judgingItem = v.object({
  ...projectMeta,
  average: v.union(v.number(), v.null()),
  myScore: v.union(v.number(), v.null()),
  scoreCount: v.union(v.number(), v.null()),
});

const rankingItem = v.object({
  ...projectMeta,
  average: v.union(v.number(), v.null()),
  canScore: v.boolean(),
  myScore: v.union(v.number(), v.null()),
  rank: v.union(v.number(), v.null()),
  scoreCount: v.union(v.number(), v.null()),
});

const assignmentSummary = v.union(
  v.object({
    group: v.number(),
    kind: v.literal("general"),
  }),
  v.object({
    kind: v.literal("track"),
    label: v.string(),
    slug: v.string(),
    trackId: v.id("tracks"),
  })
);

const staffPerson = v.object({
  _id: v.id("users"),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  role: roleValidator,
});

type Catalog = {
  membersByTeam: Map<Id<"teams">, string[]>;
  perksById: Map<Id<"perks">, Doc<"perks">>;
  submitted: Doc<"submissions">[];
  teamsById: Map<Id<"teams">, Doc<"teams">>;
  tracksById: Map<Id<"tracks">, Doc<"tracks">>;
};

type DbCtx = QueryCtx | MutationCtx;

async function generalGroupCount(ctx: DbCtx): Promise<number> {
  const doc = await ctx.db
    .query("judgingSettings")
    .withIndex("by_key", (q) => q.eq("key", JUDGING_SETTINGS_KEY))
    .unique();
  return doc?.generalGroupCount ?? DEFAULT_GENERAL_GROUP_COUNT;
}

async function storedGeneralGroups(ctx: DbCtx): Promise<number[]> {
  const [submitted, assignments] = await Promise.all([
    ctx.db
      .query("submissions")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .collect(),
    ctx.db.query("judgingAssignments").collect(),
  ]);
  const groups = [];
  for (const row of submitted) {
    if (row.generalGroup !== undefined) {
      groups.push(row.generalGroup);
    }
  }
  for (const row of assignments) {
    const assigned = assignmentFromRow(row);
    if (assigned?.kind === "general") {
      groups.push(assigned.group);
    }
  }
  return groups;
}

async function assertVisibleGeneralGroup(
  ctx: DbCtx,
  group: number
): Promise<void> {
  const [groupCount, stored] = await Promise.all([
    generalGroupCount(ctx),
    storedGeneralGroups(ctx),
  ]);
  if (!visibleGeneralGroups(groupCount, stored).includes(group)) {
    throw new Error("Ese grupo general no existe");
  }
}

function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function loadCatalog(ctx: QueryCtx): Promise<Catalog> {
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
    const name = userName || member.identifier;
    const list = membersByTeam.get(member.teamId) ?? [];
    list.push(name);
    membersByTeam.set(member.teamId, list);
  }
  return {
    membersByTeam,
    perksById: new Map(perks.map((perk) => [perk._id, perk])),
    submitted,
    teamsById: new Map(teams.map((team) => [team._id, team])),
    tracksById: new Map(tracks.map((track) => [track._id, track])),
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
        slug: track.slug,
      });
    }
  }
  const perks = [];
  for (const perkId of submission.perkIds) {
    const perk = catalog.perksById.get(perkId);
    if (perk) {
      perks.push({
        _id: perk._id,
        company: perk.company,
        title: perk.title,
      });
    }
  }
  const team = submission.teamId
    ? catalog.teamsById.get(submission.teamId)
    : undefined;
  return {
    _id: submission._id,
    challenges,
    description: submission.description,
    generalGroup: submission.generalGroup,
    members: submission.teamId
      ? (catalog.membersByTeam.get(submission.teamId) ?? [])
      : [],
    name: submission.name,
    perks,
    teamName: team?.name,
    techStack: submission.techStack ?? [],
    urls: submission.urls,
  };
}

function scoresBySubmission(rows: Doc<"judgingScores">[]) {
  const grouped = new Map<string, Doc<"judgingScores">[]>();
  for (const row of rows) {
    const listFor = grouped.get(row.submissionId) ?? [];
    listFor.push(row);
    grouped.set(row.submissionId, listFor);
  }
  return grouped;
}

async function assignmentsForUser(
  ctx: DbCtx,
  userId: Id<"users">
): Promise<JudgingContext[]> {
  const rows = await ctx.db
    .query("judgingAssignments")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const seen = new Set<string>();
  const assignments: JudgingContext[] = [];
  for (const row of rows) {
    const assigned = assignmentFromRow(row);
    if (!assigned) {
      continue;
    }
    const { kind, key } = contextKey(assigned);
    const token = `${kind}:${key}`;
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    assignments.push(assigned);
  }
  return assignments;
}

async function assignedToContext(
  ctx: DbCtx,
  userId: Id<"users">,
  context: JudgingContext
): Promise<boolean> {
  const { kind, key } = contextKey(context);
  const byContext = await ctx.db
    .query("judgingAssignments")
    .withIndex("by_user_and_context", (q) =>
      q.eq("userId", userId).eq("contextKind", kind).eq("contextKey", key)
    )
    .unique();
  if (byContext) {
    return true;
  }
  if (context.kind !== "general") {
    return false;
  }
  const legacy = await ctx.db
    .query("judgingAssignments")
    .withIndex("by_user_and_group", (q) =>
      q.eq("userId", userId).eq("group", context.group)
    )
    .unique();
  return legacy !== null;
}

async function assignmentsForContext(
  ctx: DbCtx,
  context: JudgingContext
): Promise<Doc<"judgingAssignments">[]> {
  const { kind, key } = contextKey(context);
  const byContext = await ctx.db
    .query("judgingAssignments")
    .withIndex("by_context", (q) =>
      q.eq("contextKind", kind).eq("contextKey", key)
    )
    .collect();
  if (context.kind !== "general") {
    return byContext;
  }
  const byGroup = await ctx.db
    .query("judgingAssignments")
    .withIndex("by_group", (q) => q.eq("group", context.group))
    .collect();
  const seen = new Set(byContext.map((row) => row._id));
  const merged = [...byContext];
  for (const row of byGroup) {
    if (!seen.has(row._id)) {
      merged.push(row);
    }
  }
  return merged;
}

async function findAssignment(
  ctx: DbCtx,
  userId: Id<"users">,
  context: JudgingContext
): Promise<Doc<"judgingAssignments"> | null> {
  const { kind, key } = contextKey(context);
  const byContext = await ctx.db
    .query("judgingAssignments")
    .withIndex("by_user_and_context", (q) =>
      q.eq("userId", userId).eq("contextKind", kind).eq("contextKey", key)
    )
    .unique();
  if (byContext) {
    return byContext;
  }
  if (context.kind !== "general") {
    return null;
  }
  return await ctx.db
    .query("judgingAssignments")
    .withIndex("by_user_and_group", (q) =>
      q.eq("userId", userId).eq("group", context.group)
    )
    .unique();
}

async function assertContext(
  ctx: DbCtx,
  context: JudgingContext
): Promise<void> {
  if (context.kind === "general") {
    await assertVisibleGeneralGroup(ctx, context.group);
    return;
  }
  const track = await ctx.db.get(context.trackId);
  if (!track) {
    throw new Error("Reto no encontrado");
  }
}

async function canScoreContext(
  ctx: DbCtx,
  user: Doc<"users">,
  context: JudgingContext
): Promise<boolean> {
  if (isAdmin(user)) {
    return true;
  }
  return await assignedToContext(ctx, user._id, context);
}

async function listStaffUsers(ctx: QueryCtx): Promise<Doc<"users">[]> {
  const [judges, admins] = await Promise.all([
    ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "judge"))
      .collect(),
    ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect(),
  ]);
  const seen = new Set<string>();
  const people = [];
  for (const user of [...judges, ...admins]) {
    if (seen.has(user._id) || !isJudge(user)) {
      continue;
    }
    seen.add(user._id);
    people.push(user);
  }
  return people.toSorted((a, b) =>
    (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "", "es")
  );
}

function staffFields(user: Doc<"users">) {
  return {
    _id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export const meta = judgeQuery({
  args: {},
  handler: async (ctx) => {
    const [groupCount, tracks, catalog, mine, assignmentRows] = await Promise.all([
      generalGroupCount(ctx),
      ctx.db.query("tracks").collect(),
      ctx.db
        .query("submissions")
        .withIndex("by_status", (q) => q.eq("status", "submitted"))
        .collect(),
      assignmentsForUser(ctx, ctx.user._id),
      ctx.db.query("judgingAssignments").collect(),
    ]);
    const stored = [];
    let submittedMissingGroup = false;
    for (const row of catalog) {
      if (row.generalGroup === undefined) {
        submittedMissingGroup = true;
        continue;
      }
      stored.push(row.generalGroup);
    }
    for (const row of assignmentRows) {
      const assigned = assignmentFromRow(row);
      if (assigned?.kind === "general") {
        stored.push(assigned.group);
      }
    }
    const allGroups = visibleGeneralGroups(groupCount, stored);
    const tracksById = new Map(tracks.map((track) => [track._id, track]));
    const trackList = tracks
      .toSorted(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "es")
      )
      .map((track) => ({
        _id: track._id,
        label: track.label,
        slug: track.slug,
      }));
    const myAssignments = [];
    for (const assigned of mine) {
      if (assigned.kind === "general") {
        myAssignments.push(assigned);
        continue;
      }
      const track = tracksById.get(assigned.trackId);
      if (track) {
        myAssignments.push({
          kind: "track" as const,
          label: track.label,
          slug: track.slug,
          trackId: track._id,
        });
      }
    }
    const mineGeneral = mine
      .filter((row) => row.kind === "general")
      .map((row) => row.group)
      .toSorted((a, b) => a - b);
    return {
      generalGroupCount: groupCount,
      generalGroups: isAdmin(ctx.user) ? allGroups : mineGeneral,
      isAdmin: isAdmin(ctx.user),
      myAssignments,
      submittedMissingGroup,
      tracks: trackList,
    };
  },
  returns: v.object({
    generalGroupCount: v.number(),
    generalGroups: v.array(v.number()),
    isAdmin: v.boolean(),
    myAssignments: v.array(assignmentSummary),
    submittedMissingGroup: v.boolean(),
    tracks: v.array(challengeSummary),
  }),
});

export const list = judgeQuery({
  args: {
    context: judgingContextValidator,
  },
  handler: async (ctx, args) => {
    await assertContext(ctx, args.context);
    if (!(await canScoreContext(ctx, ctx.user, args.context))) {
      return [];
    }

    const { kind, key } = contextKey(args.context);
    const [catalog, scores] = await Promise.all([
      loadCatalog(ctx),
      ctx.db
        .query("judgingScores")
        .withIndex("by_context", (q) =>
          q.eq("contextKind", kind).eq("contextKey", key)
        )
        .collect(),
    ]);

    const grouped = scoresBySubmission(scores);
    const admin = isAdmin(ctx.user);
    const items = [];
    for (const submission of catalog.submitted) {
      if (!submissionInContext(submission, args.context)) {
        continue;
      }
      const rows = grouped.get(submission._id) ?? [];
      const mine = rows.find((row) => row.judgeId === ctx.user._id);
      items.push({
        ...projectFields(submission, catalog),
        average: admin ? mean(rows.map((row) => row.score)) : null,
        myScore: mine?.score ?? null,
        scoreCount: admin ? rows.length : null,
      });
    }

    return items.toSorted((a, b) => {
      if ((a.myScore === null) !== (b.myScore === null)) {
        return a.myScore === null ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "es");
    });
  },
  returns: v.array(judgingItem),
});

export const ranking = judgeQuery({
  args: {
    context: judgingContextValidator,
  },
  handler: async (ctx, args) => {
    await assertContext(ctx, args.context);
    const allowed = await canScoreContext(ctx, ctx.user, args.context);
    if (!allowed) {
      return [];
    }

    const trackId =
      args.context.kind === "track" ? args.context.trackId : null;
    const [catalog, scores] = await Promise.all([
      loadCatalog(ctx),
      ctx.db
        .query("judgingScores")
        .withIndex("by_context", (q) =>
          trackId === null
            ? q.eq("contextKind", "general")
            : q.eq("contextKind", "track").eq("contextKey", trackId)
        )
        .collect(),
    ]);
    const grouped = scoresBySubmission(scores);
    const admin = isAdmin(ctx.user);
    const items = [];
    for (const submission of catalog.submitted) {
      if (trackId && !submission.challengeIds.includes(trackId)) {
        continue;
      }
      const rows = grouped.get(submission._id) ?? [];
      const mine = rows.find((row) => row.judgeId === ctx.user._id);
      items.push({
        ...projectFields(submission, catalog),
        average: admin ? mean(rows.map((row) => row.score)) : null,
        canScore: submissionInContext(submission, args.context),
        myScore: mine?.score ?? null,
        scoreCount: admin ? rows.length : null,
      });
    }

    if (!admin) {
      return items
        .map((item) => ({ ...item, rank: null }))
        .toSorted((a, b) => {
          if ((a.myScore === null) !== (b.myScore === null)) {
            return a.myScore === null ? 1 : -1;
          }
          if (
            a.myScore !== null &&
            b.myScore !== null &&
            a.myScore !== b.myScore
          ) {
            return b.myScore - a.myScore;
          }
          return a.name.localeCompare(b.name, "es");
        });
    }

    return assignRanks(items.toSorted(compareRanking));
  },
  returns: v.array(rankingItem),
});

export const setScore = judgeMutation({
  args: {
    context: judgingContextValidator,
    score: v.number(),
    submissionId: v.id("submissions"),
  },
  handler: async (ctx, args) => {
    assertScore(args.score);
    await assertContext(ctx, args.context);
    if (!(await canScoreContext(ctx, ctx.user, args.context))) {
      throw new Error("No estás asignado a este grupo");
    }

    const submission = await ctx.db.get(args.submissionId);
    if (!submission || submission.status !== "submitted") {
      throw new Error("Proyecto no encontrado");
    }
    if (!submissionInContext(submission, args.context)) {
      throw new Error("Este proyecto no está en este grupo");
    }

    const { kind, key } = contextKey(args.context);
    const existing = await ctx.db
      .query("judgingScores")
      .withIndex("by_judge_submission", (q) =>
        q.eq("judgeId", ctx.user._id).eq("submissionId", args.submissionId)
      )
      .collect();
    const match = existing.find(
      (row) => row.contextKind === kind && row.contextKey === key
    );
    const now = Date.now();
    if (match) {
      await ctx.db.patch(match._id, { score: args.score, updatedAt: now });
      return null;
    }
    await ctx.db.insert("judgingScores", {
      contextKey: key,
      contextKind: kind,
      createdAt: now,
      judgeId: ctx.user._id,
      score: args.score,
      submissionId: args.submissionId,
      updatedAt: now,
    });
    return null;
  },
  returns: v.null(),
});

export const ensureGeneralGroups = judgeMutation({
  args: {},
  handler: async (ctx) => {
    const groupCount = await generalGroupCount(ctx);
    const submitted = await ctx.db
      .query("submissions")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .collect();
    const missing = submitted
      .filter((row) => row.generalGroup === undefined)
      .toSorted((a, b) => a._id.localeCompare(b._id));
    if (missing.length === 0) {
      return { assigned: 0 };
    }
    const counts = countGroups(submitted, groupCount);
    for (const row of missing) {
      const group = pickBalancedGroup(counts, groupCount);
      await ctx.db.patch(row._id, { generalGroup: group });
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return { assigned: missing.length };
  },
  returns: v.object({ assigned: v.number() }),
});

export const setGeneralGroupCount = adminMutation({
  args: {
    generalGroupCount: v.number(),
  },
  handler: async (ctx, args) => {
    assertGroupCount(args.generalGroupCount);
    const existing = await ctx.db
      .query("judgingSettings")
      .withIndex("by_key", (q) => q.eq("key", JUDGING_SETTINGS_KEY))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        generalGroupCount: args.generalGroupCount,
        updatedAt: now,
      });
      return null;
    }
    await ctx.db.insert("judgingSettings", {
      generalGroupCount: args.generalGroupCount,
      key: JUDGING_SETTINGS_KEY,
      updatedAt: now,
    });
    return null;
  },
  returns: v.null(),
});

export const groupRoster = adminQuery({
  args: {
    context: judgingContextValidator,
  },
  handler: async (ctx, args) => {
    await assertContext(ctx, args.context);
    const [staff, assignedRows] = await Promise.all([
      listStaffUsers(ctx),
      assignmentsForContext(ctx, args.context),
    ]);
    const assignedIds = new Set(assignedRows.map((row) => row.userId));
    const assigned = [];
    const available = [];
    for (const user of staff) {
      const person = staffFields(user);
      if (assignedIds.has(user._id)) {
        assigned.push(person);
      } else {
        available.push(person);
      }
    }
    return { assigned, available };
  },
  returns: v.object({
    assigned: v.array(staffPerson),
    available: v.array(staffPerson),
  }),
});

export const addJudgeToGroup = adminMutation({
  args: {
    context: judgingContextValidator,
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await assertContext(ctx, args.context);
    const user = await ctx.db.get(args.userId);
    if (!user || !isJudge(user)) {
      throw new Error("Esa persona no es juez");
    }
    const existing = await findAssignment(ctx, args.userId, args.context);
    if (existing) {
      return null;
    }
    const { kind, key } = contextKey(args.context);
    await ctx.db.insert("judgingAssignments", {
      contextKey: key,
      contextKind: kind,
      createdAt: Date.now(),
      group: args.context.kind === "general" ? args.context.group : undefined,
      userId: args.userId,
    });
    return null;
  },
  returns: v.null(),
});

export const removeJudgeFromGroup = adminMutation({
  args: {
    context: judgingContextValidator,
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await findAssignment(ctx, args.userId, args.context);
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
  returns: v.null(),
});

export const ensureAssignmentShape = judgeMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("judgingAssignments").collect();
    let patched = 0;
    for (const row of rows) {
      if (row.contextKind && row.contextKey) {
        continue;
      }
      const assigned = assignmentFromRow(row);
      if (!assigned) {
        continue;
      }
      const { kind, key } = contextKey(assigned);
      await ctx.db.patch(row._id, {
        contextKind: kind,
        contextKey: key,
      });
      patched += 1;
    }
    return { patched };
  },
  returns: v.object({ patched: v.number() }),
});
