"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { githubHeaders } from "./lib/github";
import {
  githubProfileIsStale,
  githubProfileValidator,
  missingGithubProfile,
  normalizeGithubLogin,
  profileFromGraphql,
  profileFromRest,
} from "./lib/githubProfile";
import type { GithubProfile } from "./lib/githubProfile";

const PROFILE_QUERY = `query($login: String!) {
  user(login: $login) {
    login
    name
    bio
    company
    location
    websiteUrl
    twitterUsername
    url
    createdAt
    isHireable
    followers { totalCount }
    following { totalCount }
    repositories(privacy: PUBLIC) { totalCount }
    gists { totalCount }
    organizations(first: 8) { nodes { login url } }
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes {
        ... on Repository {
          nameWithOwner
          description
          url
          stargazerCount
          forkCount
          primaryLanguage { name }
        }
      }
    }
    topRepos: repositories(
      first: 12
      ownerAffiliations: OWNER
      privacy: PUBLIC
      orderBy: { field: PUSHED_AT, direction: DESC }
    ) {
      nodes {
        nameWithOwner
        description
        url
        stargazerCount
        forkCount
        isFork
        primaryLanguage { name }
        languages(first: 8, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name } }
        }
      }
    }
    contributionsCollection {
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionCount date } }
      }
    }
  }
}`;

type GraphqlBody = {
  data?: { user?: Record<string, unknown> | null };
  errors?: { type?: string; message?: string }[];
};

function githubWait(status: number): boolean {
  return status === 403 || status === 429;
}

async function loadGraphql(
  username: string,
  fetchedAt: number,
): Promise<GithubProfile | null> {
  if (!process.env.GITHUB_TOKEN) {
    return null;
  }
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      ...githubHeaders({ userAgent: "hackspain-directory" }),
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ query: PROFILE_QUERY, variables: { login: username } }),
  });
  if (githubWait(response.status)) {
    throw new Error("GitHub pide esperar.");
  }
  if (!response.ok) {
    return null;
  }
  const body = (await response.json()) as GraphqlBody;
  const notFound = body.errors?.some(
    (error) => error.type === "NOT_FOUND" || /could not resolve/i.test(error.message ?? ""),
  );
  if (!body.data?.user || notFound) {
    return missingGithubProfile(username, fetchedAt);
  }
  return profileFromGraphql(body.data.user, username, fetchedAt);
}

async function loadRest(
  username: string,
  fetchedAt: number,
): Promise<GithubProfile> {
  const headers = githubHeaders({ userAgent: "hackspain-directory" });
  const userResponse = await fetch(`https://api.github.com/users/${username}`, {
    headers,
  });
  if (githubWait(userResponse.status)) {
    throw new Error("GitHub pide esperar.");
  }
  if (userResponse.status === 404) {
    return missingGithubProfile(username, fetchedAt);
  }
  if (!userResponse.ok) {
    throw new Error("GitHub no responde.");
  }
  const user = (await userResponse.json()) as Record<string, unknown>;
  const [reposResponse, orgsResponse] = await Promise.all([
    fetch(
      `https://api.github.com/users/${username}/repos?sort=pushed&per_page=6&type=owner`,
      { headers },
    ),
    fetch(`https://api.github.com/users/${username}/orgs?per_page=8`, {
      headers,
    }),
  ]);
  if (githubWait(reposResponse.status) || githubWait(orgsResponse.status)) {
    throw new Error("GitHub pide esperar.");
  }
  const repos = reposResponse.ok ? ((await reposResponse.json()) as unknown) : [];
  const orgs = orgsResponse.ok ? ((await orgsResponse.json()) as unknown) : [];
  return profileFromRest(
    user,
    Array.isArray(repos) ? repos : [],
    Array.isArray(orgs) ? orgs : [],
    username,
    fetchedAt,
  );
}

async function loadProfile(username: string, fetchedAt: number): Promise<GithubProfile> {
  return (await loadGraphql(username, fetchedAt)) ?? (await loadRest(username, fetchedAt));
}

export const refresh = action({
  args: { username: v.string() },
  handler: async (ctx, args): Promise<GithubProfile> => {
    await ctx.runQuery(internal.directory.assertViewer, {});
    const username = normalizeGithubLogin(args.username);
    if (!username) {
      throw new Error("Ese GitHub no vale.");
    }
    const existing: GithubProfile | null = await ctx.runQuery(
      internal.directory.githubCached,
      { username },
    );
    const now = Date.now();
    if (existing && !githubProfileIsStale(existing, now)) {
      return existing;
    }
    const profile = await loadProfile(username, now);
    await ctx.runMutation(internal.directory.saveGithubProfile, profile);
    return profile;
  },
  returns: githubProfileValidator,
});
