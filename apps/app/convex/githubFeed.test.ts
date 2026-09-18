import assert from "node:assert/strict";
import { test } from "node:test";
import type { Doc, Id } from "./_generated/dataModel";
import { describeEvent, pollTargetsForTeam } from "./githubFeed";

test("every linked team repository gets its own conditional poll target", () => {
  const team = {
    _id: "team" as Id<"teams">,
    githubEtag: "legacy-primary",
    githubEtags: { "org/secondary": "secondary" },
    repoUrl: "https://github.com/org/primary",
    repoUrls: [
      "https://github.com/org/primary",
      "https://github.com/org/secondary",
    ],
  } satisfies Pick<
    Doc<"teams">,
    "_id" | "githubEtag" | "githubEtags" | "repoUrl" | "repoUrls"
  >;

  assert.deepEqual(pollTargetsForTeam(team), [
    { etag: "legacy-primary", repo: "org/primary", teamId: team._id },
    { etag: "secondary", repo: "org/secondary", teamId: team._id },
  ]);
});

test("GitHub API events are stored with the canonical feed event names", () => {
  assert.equal(
    describeEvent("org/repo", {
      actor: { login: "sam" },
      created_at: "2026-09-18T20:00:00Z",
      id: "push-1",
      payload: { head: "abcdef0123", ref: "refs/heads/main" },
      type: "PushEvent",
    })?.event,
    "push"
  );
  assert.equal(
    describeEvent("org/repo", {
      actor: { login: "sam" },
      created_at: "2026-09-18T20:00:00Z",
      id: "pr-1",
      payload: {
        action: "opened",
        number: 4,
        pull_request: { number: 4, title: "Test" },
      },
      type: "PullRequestEvent",
    })?.event,
    "pull_request"
  );
});
