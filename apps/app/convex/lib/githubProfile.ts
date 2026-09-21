import { v } from "convex/values";

export const GITHUB_PROFILE_FRESH_MS = 6 * 60 * 60 * 1000;
export const GITHUB_PROFILE_MISSING_MS = 24 * 60 * 60 * 1000;
export const GITHUB_FEED_SHOWN = 3;
export const GITHUB_REPOS_SHOWN = 4;

const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

export const githubLanguageValidator = v.object({
  bytes: v.number(),
  name: v.string(),
});

export const githubRepoValidator = v.object({
  description: v.optional(v.string()),
  forks: v.number(),
  language: v.optional(v.string()),
  name: v.string(),
  stars: v.number(),
  url: v.string(),
});

export const githubOrgValidator = v.object({
  login: v.string(),
  url: v.string(),
});

export const githubDayValidator = v.object({
  count: v.number(),
  date: v.string(),
});

export const githubYearValidator = v.object({
  commits: v.number(),
  contributions: v.number(),
  issues: v.number(),
  pullRequests: v.number(),
  reviews: v.number(),
});

export const githubProfileFields = {
  bio: v.optional(v.string()),
  blog: v.optional(v.string()),
  calendar: v.array(githubDayValidator),
  company: v.optional(v.string()),
  createdAt: v.optional(v.number()),
  fetchedAt: v.number(),
  followers: v.number(),
  following: v.number(),
  hireable: v.optional(v.boolean()),
  languages: v.array(githubLanguageValidator),
  location: v.optional(v.string()),
  login: v.string(),
  missing: v.boolean(),
  name: v.optional(v.string()),
  orgs: v.array(githubOrgValidator),
  pinned: v.array(githubRepoValidator),
  publicGists: v.number(),
  publicRepos: v.number(),
  repos: v.array(githubRepoValidator),
  twitter: v.optional(v.string()),
  url: v.string(),
  username: v.string(),
  year: v.optional(githubYearValidator),
};

export const githubProfileValidator = v.object(githubProfileFields);

export const githubHackathonEventValidator = v.object({
  count: v.number(),
  event: v.string(),
});

export const githubHackathonItemValidator = v.object({
  at: v.number(),
  event: v.string(),
  repo: v.string(),
  text: v.string(),
  url: v.string(),
});

export const githubHackathonValidator = v.object({
  events: v.array(githubHackathonEventValidator),
  recent: v.array(githubHackathonItemValidator),
  total: v.number(),
});

export type GithubLanguage = { bytes: number; name: string };
export type GithubRepo = {
  description?: string;
  forks: number;
  language?: string;
  name: string;
  stars: number;
  url: string;
};
export type GithubProfile = {
  bio?: string;
  blog?: string;
  calendar: { count: number; date: string }[];
  company?: string;
  createdAt?: number;
  fetchedAt: number;
  followers: number;
  following: number;
  hireable?: boolean;
  languages: GithubLanguage[];
  location?: string;
  login: string;
  missing: boolean;
  name?: string;
  orgs: { login: string; url: string }[];
  pinned: GithubRepo[];
  publicGists: number;
  publicRepos: number;
  repos: GithubRepo[];
  twitter?: string;
  url: string;
  username: string;
  year?: {
    commits: number;
    contributions: number;
    issues: number;
    pullRequests: number;
    reviews: number;
  };
};

export function normalizeGithubLogin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  let login = trimmed.replace(/^@/, "");
  try {
    const parsed = new URL(
      /^https?:\/\//i.test(login) ? login : `https://${login}`,
    );
    if (/(^|\.)github\.com$/i.test(parsed.hostname)) {
      const first = parsed.pathname.split("/").find(Boolean);
      if (!first) {
        return null;
      }
      login = first;
    }
  } catch {
    // Bare logins are fine.
  }
  login = login.replace(/\/+$/, "");
  if (!GITHUB_LOGIN.test(login)) {
    return null;
  }
  return login.toLowerCase();
}

export function githubProfileIsStale(
  profile: { fetchedAt: number; missing: boolean } | null,
  now: number,
): boolean {
  if (!profile) {
    return true;
  }
  const ttl = profile.missing
    ? GITHUB_PROFILE_MISSING_MS
    : GITHUB_PROFILE_FRESH_MS;
  return now - profile.fetchedAt >= ttl;
}

export function aggregateLanguages(
  repos: { languages: GithubLanguage[] }[],
): GithubLanguage[] {
  const bytes = new Map<string, number>();
  for (const repo of repos) {
    for (const language of repo.languages) {
      if (!language.name || language.bytes <= 0) {
        continue;
      }
      bytes.set(language.name, (bytes.get(language.name) ?? 0) + language.bytes);
    }
  }
  return [...bytes.entries()]
    .map(([name, total]) => ({ bytes: total, name }))
    .toSorted((a, b) => b.bytes - a.bytes)
    .slice(0, 8);
}

export function flattenCalendar(weeks: unknown[]): { count: number; date: string }[] {
  return weeks.flatMap((week) => {
    if (!week || typeof week !== "object" || !("contributionDays" in week)) {
      return [];
    }
    const days = (week as { contributionDays: unknown }).contributionDays;
    if (!Array.isArray(days)) {
      return [];
    }
    return days.flatMap((day) => {
      if (!day || typeof day !== "object") {
        return [];
      }
      const row = day as { contributionCount?: unknown; date?: unknown };
      if (
        typeof row.contributionCount !== "number" ||
        typeof row.date !== "string"
      ) {
        return [];
      }
      return [{ count: row.contributionCount, date: row.date }];
    });
  });
}

export function missingGithubProfile(
  username: string,
  fetchedAt: number,
): GithubProfile {
  return {
    calendar: [],
    fetchedAt,
    followers: 0,
    following: 0,
    languages: [],
    login: username,
    missing: true,
    orgs: [],
    pinned: [],
    publicGists: 0,
    publicRepos: 0,
    repos: [],
    url: `https://github.com/${username}`,
    username,
  };
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function countOf(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "totalCount" in value &&
    typeof value.totalCount === "number"
  ) {
    return value.totalCount;
  }
  return typeof value === "number" ? value : 0;
}

function repoFromNode(node: unknown): GithubRepo | null {
  if (!node || typeof node !== "object") {
    return null;
  }
  const row = node as {
    description?: unknown;
    forkCount?: unknown;
    name?: unknown;
    nameWithOwner?: unknown;
    primaryLanguage?: { name?: unknown } | null;
    stargazerCount?: unknown;
    url?: unknown;
  };
  const name =
    optionalString(row.nameWithOwner) ?? optionalString(row.name);
  const url = optionalString(row.url);
  if (!name || !url) {
    return null;
  }
  return {
    description: optionalString(row.description),
    forks: typeof row.forkCount === "number" ? row.forkCount : 0,
    language: optionalString(row.primaryLanguage?.name),
    name,
    stars: typeof row.stargazerCount === "number" ? row.stargazerCount : 0,
    url,
  };
}

export function profileFromGraphql(
  user: Record<string, unknown>,
  username: string,
  fetchedAt: number,
): GithubProfile {
  const login = optionalString(user.login) ?? username;
  const pinnedNodes =
    user.pinnedItems &&
    typeof user.pinnedItems === "object" &&
    "nodes" in user.pinnedItems &&
    Array.isArray(user.pinnedItems.nodes)
      ? user.pinnedItems.nodes
      : [];
  const repoNodes =
    user.topRepos &&
    typeof user.topRepos === "object" &&
    "nodes" in user.topRepos &&
    Array.isArray(user.topRepos.nodes)
      ? user.topRepos.nodes
      : [];
  const orgNodes =
    user.organizations &&
    typeof user.organizations === "object" &&
    "nodes" in user.organizations &&
    Array.isArray(user.organizations.nodes)
      ? user.organizations.nodes
      : [];
  const languages = aggregateLanguages(
    repoNodes.flatMap((node) => {
      if (!node || typeof node !== "object") {
        return [];
      }
      const row = node as {
        isFork?: unknown;
        languages?: { edges?: { size?: unknown; node?: { name?: unknown } }[] };
      };
      if (row.isFork) {
        return [];
      }
      return [
        {
          languages: (row.languages?.edges ?? []).flatMap((edge) => {
            const name = optionalString(edge?.node?.name);
            const bytes = typeof edge?.size === "number" ? edge.size : 0;
            return name ? [{ bytes, name }] : [];
          }),
        },
      ];
    }),
  );
  const yearRaw =
    user.contributionsCollection &&
    typeof user.contributionsCollection === "object"
      ? (user.contributionsCollection as Record<string, unknown>)
      : undefined;
  const calendarRaw =
    yearRaw?.contributionCalendar &&
    typeof yearRaw.contributionCalendar === "object"
      ? (yearRaw.contributionCalendar as Record<string, unknown>)
      : undefined;
  const year = yearRaw
    ? {
        commits:
          typeof yearRaw.totalCommitContributions === "number"
            ? yearRaw.totalCommitContributions
            : 0,
        contributions:
          typeof calendarRaw?.totalContributions === "number"
            ? calendarRaw.totalContributions
            : 0,
        issues:
          typeof yearRaw.totalIssueContributions === "number"
            ? yearRaw.totalIssueContributions
            : 0,
        pullRequests:
          typeof yearRaw.totalPullRequestContributions === "number"
            ? yearRaw.totalPullRequestContributions
            : 0,
        reviews:
          typeof yearRaw.totalPullRequestReviewContributions === "number"
            ? yearRaw.totalPullRequestReviewContributions
            : 0,
      }
    : undefined;
  const weeks =
    calendarRaw && Array.isArray(calendarRaw.weeks) ? calendarRaw.weeks : [];
  const createdAt =
    typeof user.createdAt === "string" ? Date.parse(user.createdAt) : undefined;
  return {
    bio: optionalString(user.bio),
    blog: optionalString(user.websiteUrl),
    calendar: flattenCalendar(weeks),
    company: optionalString(user.company),
    createdAt: Number.isFinite(createdAt) ? createdAt : undefined,
    fetchedAt,
    followers: countOf(user.followers),
    following: countOf(user.following),
    hireable:
      typeof user.isHireable === "boolean" ? user.isHireable : undefined,
    languages,
    location: optionalString(user.location),
    login,
    missing: false,
    name: optionalString(user.name),
    orgs: orgNodes.flatMap((node) => {
      const loginName = optionalString(
        node && typeof node === "object" && "login" in node
          ? node.login
          : undefined,
      );
      const url = optionalString(
        node && typeof node === "object" && "url" in node ? node.url : undefined,
      );
      return loginName
        ? [{ login: loginName, url: url ?? `https://github.com/${loginName}` }]
        : [];
    }),
    pinned: pinnedNodes.flatMap((node) => {
      const repo = repoFromNode(node);
      return repo ? [repo] : [];
    }),
    publicGists: countOf(user.gists),
    publicRepos: countOf(user.repositories),
    repos: repoNodes.flatMap((node) => {
      if (
        node &&
        typeof node === "object" &&
        "isFork" in node &&
        node.isFork
      ) {
        return [];
      }
      const repo = repoFromNode(node);
      return repo ? [repo] : [];
    }).slice(0, 6),
    twitter: optionalString(user.twitterUsername),
    url: optionalString(user.url) ?? `https://github.com/${login}`,
    username,
    year,
  };
}

function repoFromRest(node: unknown): GithubRepo | null {
  if (!node || typeof node !== "object") {
    return null;
  }
  const row = node as {
    description?: unknown;
    fork?: unknown;
    forks_count?: unknown;
    full_name?: unknown;
    html_url?: unknown;
    language?: unknown;
    stargazers_count?: unknown;
  };
  if (row.fork) {
    return null;
  }
  const name = optionalString(row.full_name);
  const url = optionalString(row.html_url);
  if (!name || !url) {
    return null;
  }
  return {
    description: optionalString(row.description),
    forks: typeof row.forks_count === "number" ? row.forks_count : 0,
    language: optionalString(row.language),
    name,
    stars: typeof row.stargazers_count === "number" ? row.stargazers_count : 0,
    url,
  };
}

export function profileFromRest(
  user: Record<string, unknown>,
  repos: unknown[],
  orgs: unknown[],
  username: string,
  fetchedAt: number,
): GithubProfile {
  const login = optionalString(user.login) ?? username;
  const createdAt =
    typeof user.created_at === "string" ? Date.parse(user.created_at) : undefined;
  return {
    bio: optionalString(user.bio),
    blog: optionalString(user.blog),
    calendar: [],
    company: optionalString(user.company),
    createdAt: Number.isFinite(createdAt) ? createdAt : undefined,
    fetchedAt,
    followers: typeof user.followers === "number" ? user.followers : 0,
    following: typeof user.following === "number" ? user.following : 0,
    hireable: typeof user.hireable === "boolean" ? user.hireable : undefined,
    languages: [],
    location: optionalString(user.location),
    login,
    missing: false,
    name: optionalString(user.name),
    orgs: orgs.flatMap((node) => {
      if (!node || typeof node !== "object") {
        return [];
      }
      const row = node as { html_url?: unknown; login?: unknown };
      const loginName = optionalString(row.login);
      return loginName
        ? [
            {
              login: loginName,
              url: optionalString(row.html_url) ?? `https://github.com/${loginName}`,
            },
          ]
        : [];
    }),
    pinned: [],
    publicGists: typeof user.public_gists === "number" ? user.public_gists : 0,
    publicRepos: typeof user.public_repos === "number" ? user.public_repos : 0,
    repos: repos.flatMap((node) => {
      const repo = repoFromRest(node);
      return repo ? [repo] : [];
    }).slice(0, 6),
    twitter: optionalString(user.twitter_username),
    url: optionalString(user.html_url) ?? `https://github.com/${login}`,
    username,
  };
}
