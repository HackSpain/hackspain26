import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { requireOnboarded } from "./lib/auth";
import { onboardedQuery } from "./lib/customFunctions";
import { repoSlug } from "./lib/github";
import {
  isHandSet,
  STACK_BACKGROUND_TTL_MS,
  stackCategory,
  STACK_SCAN_TTL_MS,
} from "./lib/stack";
import { findOwnedSubmission, membershipForUser } from "./lib/team";
import { urlOf } from "./lib/urls";

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

export async function scheduleStackScan(
  ctx: MutationCtx,
  args: {
    force?: boolean;
    repoUrls?: string[];
    submissionId?: Id<"submissions">;
    teamId?: Id<"teams">;
    userId: Id<"users">;
  }
): Promise<void> {
  const repoUrls = (args.repoUrls ?? []).filter((url) => repoSlug(url));
  if (repoUrls.length === 0) {
    return;
  }
  await ctx.scheduler.runAfter(0, internal.stackDetect.scan, {
    force: args.force,
    repoUrls,
    submissionId: args.submissionId,
    teamId: args.teamId,
    userId: args.userId,
  });
}

const scanContextReturn = v.object({
  submissionFresh: v.boolean(),
  submissionId: v.optional(v.id("submissions")),
  submissionRepo: v.optional(v.string()),
  teamFresh: v.boolean(),
  teamId: v.optional(v.id("teams")),
  teamRepos: v.array(v.string()),
  token: v.union(v.string(), v.null()),
});

function isFresh(
  at: number | undefined,
  now: number,
  ttlMs = STACK_SCAN_TTL_MS
): boolean {
  return at !== undefined && now - at < ttlMs;
}

export const scanContext = internalQuery({
  args: {
    now: v.number(),
    submissionId: v.optional(v.id("submissions")),
    teamId: v.optional(v.id("teams")),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    const team = args.teamId ? await ctx.db.get(args.teamId) : null;
    const submission = args.submissionId
      ? await ctx.db.get(args.submissionId)
      : null;
    return {
      submissionFresh: isFresh(submission?.techStackAt, args.now),
      submissionId: submission?._id,
      submissionRepo: urlOf(submission?.urls, "repo"),
      teamFresh: isFresh(team?.techStackAt, args.now),
      teamId: team?._id,
      teamRepos: teamRepoList(team),
      token: user?.githubAccessToken ?? null,
    };
  },
  returns: scanContextReturn,
});

export const myContext = internalQuery({
  args: { background: v.optional(v.boolean()), now: v.number() },
  handler: async (ctx, args) => {
    const user = await requireOnboarded(ctx);
    const membership = await membershipForUser(ctx, user._id);
    const team = membership ? await ctx.db.get(membership.teamId) : null;
    const submission = await findOwnedSubmission(ctx, user._id);
    const ttlMs = args.background ? STACK_BACKGROUND_TTL_MS : undefined;
    return {
      submissionFresh: isFresh(submission?.techStackAt, args.now, ttlMs),
      submissionId: submission?._id,
      submissionRepo: urlOf(submission?.urls, "repo"),
      teamFresh:
        isFresh(team?.techStackAt, args.now, ttlMs) ||
        (args.background === true && isHandSet(team)),
      teamId: team?._id,
      teamRepos: teamRepoList(team),
      token: user.githubAccessToken ?? null,
    };
  },
  returns: scanContextReturn,
});

export const record = internalMutation({
  args: {
    /** A scan nobody asked for by name: leave hand-typed stacks alone. */
    keepHandSet: v.optional(v.boolean()),
    repoUrls: v.array(v.string()),
    submissionId: v.optional(v.id("submissions")),
    teamId: v.optional(v.id("teams")),
    techStack: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // A private repo, a rate limit or an empty repo all come back as nothing.
    // None of them is a reason to wipe a stack that is already there.
    if (args.techStack.length === 0) {
      return 0;
    }
    const now = Date.now();
    const scanned = new Set(
      args.repoUrls.map((url) => repoSlug(url)).filter((slug) => slug !== null)
    );
    let wrote = 0;
    if (args.teamId) {
      const team = await ctx.db.get(args.teamId);
      const teamSlugs = teamRepoList(team).map((url) => repoSlug(url));
      if (
        team &&
        !(args.keepHandSet && isHandSet(team)) &&
        teamSlugs.some((slug) => slug && scanned.has(slug))
      ) {
        await ctx.db.patch(args.teamId, {
          techStack: args.techStack,
          techStackAt: now,
          techStackSource: "repo",
          updatedAt: now,
        });
        wrote++;
      }
    }
    if (args.submissionId) {
      const submission = await ctx.db.get(args.submissionId);
      const submissionSlug = repoSlug(urlOf(submission?.urls, "repo"));
      if (
        submission &&
        !(args.keepHandSet && isHandSet(submission)) &&
        submissionSlug &&
        scanned.has(submissionSlug)
      ) {
        await ctx.db.patch(args.submissionId, {
          techStack: args.techStack,
          techStackAt: now,
          techStackSource: "repo",
        });
        wrote++;
      }
    }
    return wrote;
  },
  returns: v.number(),
});

const RESCAN_GAP_MS = 2000;

/**
 * Re-scan every linked repo, for when the detector learns something new (a
 * stored stack is otherwise only refreshed when its repo changes or the
 * project is submitted). Run it by hand: `npx convex run stack:rescanAll`.
 * Hand-typed stacks are left as they are.
 * Spaced out so the shared fallback token is not drained in one burst.
 */
export const rescanAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const [submissions, teams] = await Promise.all([
      ctx.db.query("submissions").collect(),
      ctx.db.query("teams").collect(),
    ]);
    const submissionByTeam = new Map<string, Doc<"submissions">>();
    for (const submission of submissions) {
      if (submission.teamId && !submissionByTeam.has(submission.teamId)) {
        submissionByTeam.set(submission.teamId, submission);
      }
    }
    const jobs: {
      repoUrls: string[];
      submissionId?: Id<"submissions">;
      teamId?: Id<"teams">;
      userId: Id<"users">;
    }[] = [];
    for (const team of teams) {
      const submission = submissionByTeam.get(team._id);
      const submissionRepo = urlOf(submission?.urls, "repo");
      jobs.push({
        repoUrls: [
          ...teamRepoList(team),
          ...(submissionRepo ? [submissionRepo] : []),
        ],
        submissionId: submission?._id,
        teamId: team._id,
        userId: team.ownerId,
      });
    }
    for (const submission of submissions) {
      const repo = urlOf(submission.urls, "repo");
      if (!submission.teamId && repo) {
        jobs.push({
          repoUrls: [repo],
          submissionId: submission._id,
          userId: submission.submittedBy,
        });
      }
    }
    let scheduled = 0;
    for (const job of jobs) {
      const repoUrls = job.repoUrls.filter((url) => repoSlug(url));
      if (repoUrls.length === 0) {
        continue;
      }
      await ctx.scheduler.runAfter(
        scheduled * RESCAN_GAP_MS,
        internal.stackDetect.scan,
        { ...job, force: true, keepHandSet: true, repoUrls }
      );
      scheduled++;
    }
    return scheduled;
  },
  returns: v.number(),
});

const histogramRow = v.object({
  category: v.union(
    v.literal("Frontend"),
    v.literal("Backend"),
    v.literal("Datos"),
    v.literal("Otras")
  ),
  count: v.number(),
  name: v.string(),
});

export const histogramReturn = v.object({
  /** How many of `total` came from a repo scan rather than typed by hand. */
  auto: v.number(),
  rows: v.array(histogramRow),
  total: v.number(),
});

type Stacked = Pick<Doc<"teams">, "techStack" | "techStackSource">;

/**
 * One stack per project: the submitted project's, else the team's, else a
 * draft's. The draft matters: a scan of a repo that is only on the draft
 * lands there and nowhere else.
 */
export async function stackHistogram(ctx: QueryCtx) {
  const [submissions, teams] = await Promise.all([
    ctx.db.query("submissions").collect(),
    ctx.db.query("teams").collect(),
  ]);
  const usedTeams = new Set<string>();
  const stacks: string[][] = [];
  let auto = 0;
  const take = (doc: Stacked, teamId: string | undefined): void => {
    if (!doc.techStack || doc.techStack.length === 0) {
      return;
    }
    if (teamId) {
      if (usedTeams.has(teamId)) {
        return;
      }
      usedTeams.add(teamId);
    }
    stacks.push(doc.techStack);
    auto += doc.techStackSource === "repo" ? 1 : 0;
  };
  for (const submission of submissions) {
    if (submission.status === "submitted") {
      take(submission, submission.teamId);
    }
  }
  for (const team of teams) {
    take(team, team._id);
  }
  for (const submission of submissions) {
    if (submission.status !== "submitted") {
      take(submission, submission.teamId);
    }
  }
  const counts = new Map<string, number>();
  for (const stack of stacks) {
    for (const tag of new Set(stack)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const rows = [...counts.entries()]
    .map(([name, count]) => ({
      category: stackCategory(name),
      count,
      name,
    }))
    .toSorted(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, "es")
    );
  return { auto, rows, total: stacks.length };
}

export const histogram = onboardedQuery({
  args: {},
  handler: async (ctx) => await stackHistogram(ctx),
  returns: histogramReturn,
});
