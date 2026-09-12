import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { requireOnboarded } from "./lib/auth";
import { onboardedQuery } from "./lib/customFunctions";
import { repoSlug } from "./lib/github";
import { stackCategory, STACK_SCAN_TTL_MS } from "./lib/stack";
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

function isFresh(at: number | undefined, now: number): boolean {
  return at !== undefined && now - at < STACK_SCAN_TTL_MS;
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
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const user = await requireOnboarded(ctx);
    const membership = await membershipForUser(ctx, user._id);
    const team = membership ? await ctx.db.get(membership.teamId) : null;
    const submission = await findOwnedSubmission(ctx, user._id);
    return {
      submissionFresh: isFresh(submission?.techStackAt, args.now),
      submissionId: submission?._id,
      submissionRepo: urlOf(submission?.urls, "repo"),
      teamFresh: isFresh(team?.techStackAt, args.now),
      teamId: team?._id,
      teamRepos: teamRepoList(team),
      token: user.githubAccessToken ?? null,
    };
  },
  returns: scanContextReturn,
});

export const record = internalMutation({
  args: {
    repoUrls: v.array(v.string()),
    submissionId: v.optional(v.id("submissions")),
    teamId: v.optional(v.id("teams")),
    techStack: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const scanned = new Set(
      args.repoUrls.map((url) => repoSlug(url)).filter((slug) => slug !== null)
    );
    let wrote = 0;
    if (args.teamId) {
      const team = await ctx.db.get(args.teamId);
      const teamSlugs = teamRepoList(team).map((url) => repoSlug(url));
      if (team && teamSlugs.some((slug) => slug && scanned.has(slug))) {
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
      if (submission && submissionSlug && scanned.has(submissionSlug)) {
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

export const histogram = onboardedQuery({
  args: {},
  handler: async (ctx) => {
    const [submitted, teams] = await Promise.all([
      ctx.db
        .query("submissions")
        .withIndex("by_status", (q) => q.eq("status", "submitted"))
        .collect(),
      ctx.db.query("teams").collect(),
    ]);
    const usedTeams = new Set<string>();
    const stacks: string[][] = [];
    for (const submission of submitted) {
      if (!submission.techStack || submission.techStack.length === 0) {
        continue;
      }
      stacks.push(submission.techStack);
      if (submission.teamId) {
        usedTeams.add(submission.teamId);
      }
    }
    for (const team of teams) {
      if (usedTeams.has(team._id)) {
        continue;
      }
      if (!team.techStack || team.techStack.length === 0) {
        continue;
      }
      stacks.push(team.techStack);
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
    return { rows, total: stacks.length };
  },
  returns: v.object({
    rows: v.array(histogramRow),
    total: v.number(),
  }),
});
