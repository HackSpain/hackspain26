import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aggregateLanguages,
  flattenCalendar,
  githubProfileIsStale,
  GITHUB_PROFILE_FRESH_MS,
  missingGithubProfile,
  normalizeGithubLogin,
  profileFromGraphql,
  profileFromRest,
} from "./githubProfile";

test("github logins come from handles, urls, or the bare name", () => {
  assert.equal(normalizeGithubLogin("mrloldev"), "mrloldev");
  assert.equal(normalizeGithubLogin("@MrlolDev"), "mrloldev");
  assert.equal(
    normalizeGithubLogin("https://github.com/mrloldev"),
    "mrloldev",
  );
  assert.equal(normalizeGithubLogin("github.com/mrloldev/"), "mrloldev");
  assert.equal(normalizeGithubLogin("-bad"), null);
  assert.equal(normalizeGithubLogin("not a user"), null);
});

test("language bytes from several repos add up", () => {
  assert.deepEqual(
    aggregateLanguages([
      {
        languages: [
          { bytes: 10, name: "TypeScript" },
          { bytes: 4, name: "CSS" },
        ],
      },
      { languages: [{ bytes: 5, name: "TypeScript" }] },
    ]),
    [
      { bytes: 15, name: "TypeScript" },
      { bytes: 4, name: "CSS" },
    ],
  );
});

test("missing profiles stay cached longer than found ones", () => {
  const now = 1_000_000;
  assert.equal(githubProfileIsStale(null, now), true);
  assert.equal(
    githubProfileIsStale({ fetchedAt: now - GITHUB_PROFILE_FRESH_MS + 1, missing: false }, now),
    false,
  );
  assert.equal(
    githubProfileIsStale({ fetchedAt: now - GITHUB_PROFILE_FRESH_MS, missing: false }, now),
    true,
  );
  assert.equal(
    githubProfileIsStale({ fetchedAt: now - GITHUB_PROFILE_FRESH_MS, missing: true }, now),
    false,
  );
});

test("the GraphQL user payload becomes a directory profile", () => {
  const profile = profileFromGraphql(
    {
      bio: "  hola  ",
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: 40,
          weeks: [
            {
              contributionDays: [
                { contributionCount: 2, date: "2026-01-01" },
              ],
            },
          ],
        },
        totalCommitContributions: 12,
        totalIssueContributions: 1,
        totalPullRequestContributions: 3,
        totalPullRequestReviewContributions: 4,
      },
      createdAt: "2020-01-02T00:00:00Z",
      followers: { totalCount: 9 },
      gists: { totalCount: 1 },
      isHireable: true,
      login: "Ada",
      name: "Ada",
      organizations: { nodes: [{ login: "hackspain", url: "https://github.com/hackspain" }] },
      pinnedItems: {
        nodes: [
          {
            forkCount: 1,
            nameWithOwner: "ada/app",
            primaryLanguage: { name: "TypeScript" },
            stargazerCount: 8,
            url: "https://github.com/ada/app",
          },
        ],
      },
      repositories: { totalCount: 11 },
      topRepos: {
        nodes: [
          {
            isFork: true,
            languages: { edges: [{ node: { name: "Go" }, size: 99 }] },
            nameWithOwner: "ada/fork",
            url: "https://github.com/ada/fork",
          },
          {
            isFork: false,
            languages: {
              edges: [
                { node: { name: "TypeScript" }, size: 20 },
                { node: { name: "CSS" }, size: 5 },
              ],
            },
            nameWithOwner: "ada/app",
            primaryLanguage: { name: "TypeScript" },
            stargazerCount: 8,
            url: "https://github.com/ada/app",
          },
        ],
      },
      url: "https://github.com/Ada",
    },
    "ada",
    50,
  );
  assert.equal(profile.login, "Ada");
  assert.equal(profile.bio, "hola");
  assert.equal(profile.followers, 9);
  assert.equal(profile.hireable, true);
  assert.equal(profile.year?.commits, 12);
  assert.deepEqual(profile.calendar, [{ count: 2, date: "2026-01-01" }]);
  assert.deepEqual(profile.languages, [
    { bytes: 20, name: "TypeScript" },
    { bytes: 5, name: "CSS" },
  ]);
  assert.equal(profile.repos.length, 1);
  assert.equal(profile.pinned[0]?.name, "ada/app");
  assert.equal(flattenCalendar([]).length, 0);
  assert.equal(missingGithubProfile("ada", 1).missing, true);
});

test("the REST user payload becomes a directory profile", () => {
  const profile = profileFromRest(
    {
      bio: "hola",
      blog: "ada.dev",
      created_at: "2020-01-02T00:00:00Z",
      followers: 9,
      hireable: true,
      html_url: "https://github.com/Ada",
      login: "Ada",
      name: "Ada",
      public_gists: 1,
      public_repos: 11,
      twitter_username: "ada",
    },
    [
      {
        fork: true,
        full_name: "ada/fork",
        html_url: "https://github.com/ada/fork",
      },
      {
        description: "app",
        fork: false,
        forks_count: 1,
        full_name: "ada/app",
        html_url: "https://github.com/ada/app",
        language: "TypeScript",
        stargazers_count: 8,
      },
    ],
    [{ html_url: "https://github.com/hackspain", login: "hackspain" }],
    "ada",
    50,
  );
  assert.equal(profile.login, "Ada");
  assert.equal(profile.followers, 9);
  assert.equal(profile.hireable, true);
  assert.equal(profile.repos.length, 1);
  assert.equal(profile.repos[0]?.name, "ada/app");
  assert.equal(profile.orgs[0]?.login, "hackspain");
  assert.equal(profile.calendar.length, 0);
  assert.equal(profile.twitter, "ada");
});
