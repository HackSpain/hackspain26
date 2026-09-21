"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { githubHeaders, hasGithubAuth } from "./lib/github";
import {
  githubProfileIsStale,
  githubProfileValidator,
  missingGithubProfile,
  normalizeGithubLogin,
  profileFromGraphql,
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

async function loadProfile(username: string, fetchedAt: number): Promise<GithubProfile> {
  if (!hasGithubAuth()) {
    throw new Error("GitHub no está configurado.");
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
  if (response.status === 403 || response.status === 429) {
    throw new Error("GitHub pide esperar.");
  }
  if (!response.ok) {
    throw new Error("GitHub no responde.");
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
