"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import { githubHeaders, hasGithubAuth, repoSlug } from "./lib/github";
import { canonicalizeTags, detectStack, selectStackFiles } from "./lib/stack";

const MAX_FILE_BYTES = 80_000;
const MAX_REPOS = 5;

type GitHubRepo = { default_branch?: string };
type GitHubTree = {
  tree?: { path?: string; type?: string }[];
};

async function githubJson<T>(
  url: string,
  token: string | null
): Promise<{ ok: true; value: T } | { ok: false; status: number }> {
  const response = await fetch(url, {
    headers: githubHeaders({ token, userAgent: "hackspain-stack" }),
  });
  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get("x-ratelimit-remaining") ?? "?";
    console.warn(`github stack: ${response.status} (remaining ${remaining})`);
    return { ok: false, status: response.status };
  }
  if (!response.ok) {
    return { ok: false, status: response.status };
  }
  return { ok: true, value: (await response.json()) as T };
}

async function githubText(
  url: string,
  token: string | null
): Promise<{ ok: true; value: string } | { ok: false; status: number }> {
  const headers = githubHeaders({ token, userAgent: "hackspain-stack" });
  headers.accept = "application/vnd.github.raw";
  const response = await fetch(url, { headers });
  if (!response.ok) {
    return { ok: false, status: response.status };
  }
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > MAX_FILE_BYTES) {
    return { ok: false, status: 413 };
  }
  return { ok: true, value: (await response.text()).slice(0, MAX_FILE_BYTES) };
}

async function scanOneRepo(
  repoUrl: string,
  token: string | null
): Promise<string[]> {
  const repo = repoSlug(repoUrl);
  if (!repo) {
    return [];
  }
  const repoInfo = await githubJson<GitHubRepo>(
    `https://api.github.com/repos/${repo}`,
    token
  );
  if (!repoInfo.ok) {
    console.warn(`github stack: repo ${repo} answered ${repoInfo.status}`);
    return [];
  }
  const branch = repoInfo.value.default_branch ?? "main";
  const tree = await githubJson<GitHubTree>(
    `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token
  );
  if (!tree.ok) {
    console.warn(`github stack: tree ${repo} answered ${tree.status}`);
    return [];
  }
  const paths = (tree.value.tree ?? [])
    .filter((entry) => entry.type === "blob" && entry.path)
    .map((entry) => entry.path as string);
  const files = [];
  for (const path of selectStackFiles(paths)) {
    const body = await githubText(
      `https://api.github.com/repos/${repo}/contents/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      token
    );
    if (body.ok) {
      files.push({ content: body.value, path });
    }
  }
  const languages = await githubJson<Record<string, number>>(
    `https://api.github.com/repos/${repo}/languages`,
    token
  );
  return detectStack({
    files,
    languages: languages.ok ? languages.value : undefined,
    paths,
  });
}

async function detectRepos(
  repoUrls: string[],
  token: string | null
): Promise<string[]> {
  const unique = [...new Set(repoUrls.filter((url) => repoSlug(url)))].slice(
    0,
    MAX_REPOS
  );
  const stacks: string[][] = [];
  for (const repoUrl of unique) {
    try {
      stacks.push(await scanOneRepo(repoUrl, token));
    } catch (error) {
      console.warn(
        `github stack: ${repoSlug(repoUrl) ?? "repo"} failed`,
        error instanceof Error ? error.message : "error"
      );
    }
  }
  return canonicalizeTags(stacks.flat());
}

export const scan = internalAction({
  args: {
    force: v.optional(v.boolean()),
    repoUrls: v.array(v.string()),
    submissionId: v.optional(v.id("submissions")),
    teamId: v.optional(v.id("teams")),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const target = await ctx.runQuery(internal.stack.scanContext, {
      now: Date.now(),
      submissionId: args.submissionId,
      teamId: args.teamId,
      userId: args.userId,
    });
    const watchingTeam = target.teamRepos.length > 0;
    const watchingSubmission = Boolean(target.submissionRepo);
    const fresh =
      (watchingTeam ? target.teamFresh : true) &&
      (watchingSubmission ? target.submissionFresh : true);
    if (!args.force && fresh) {
      return { scanned: false, tags: 0 };
    }
    if (!hasGithubAuth(target.token)) {
      console.warn(
        "github stack: no participant token and no GITHUB_TOKEN fallback; skipping"
      );
      return { scanned: false, tags: 0 };
    }
    const techStack = await detectRepos(args.repoUrls, target.token);
    await ctx.runMutation(internal.stack.record, {
      repoUrls: args.repoUrls,
      submissionId: args.submissionId,
      teamId: args.teamId,
      techStack,
    });
    return { scanned: true, tags: techStack.length };
  },
  returns: v.object({
    scanned: v.boolean(),
    tags: v.number(),
  }),
});

export const mine = action({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, _args) => {
    const target = await ctx.runQuery(internal.stack.myContext, {
      now: Date.now(),
    });
    const repoUrls = [
      ...target.teamRepos,
      ...(target.submissionRepo ? [target.submissionRepo] : []),
    ];
    if (repoUrls.length === 0) {
      return { scanned: false, techStack: [] };
    }
    if (!hasGithubAuth(target.token)) {
      return { scanned: false, techStack: [] };
    }
    const techStack = await detectRepos(repoUrls, target.token);
    await ctx.runMutation(internal.stack.record, {
      repoUrls,
      submissionId: target.submissionId as Id<"submissions"> | undefined,
      teamId: target.teamId as Id<"teams"> | undefined,
      techStack,
    });
    return { scanned: true, techStack };
  },
  returns: v.object({
    scanned: v.boolean(),
    techStack: v.array(v.string()),
  }),
});
