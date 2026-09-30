import assert from "node:assert/strict";
import { test } from "node:test";
import type { Doc, Id } from "./_generated/dataModel";
import {
  describeEvent,
  githubEventInWindow,
  githubFeedPollWindow,
  pollTargetsForTeam,
} from "./githubFeed";

test("GitHub polling follows the scheduled window and six-hour API delay", () => {
  const startsAt = Date.parse("2026-09-18T16:00:00Z");
  const endsAt = Date.parse("2026-09-20T16:00:00Z");
  const window = { startsAt, endsAt };
  assert.equal(githubFeedPollWindow({}, startsAt), null);
  assert.equal(githubFeedPollWindow(window, startsAt - 1), null);
  assert.deepEqual(githubFeedPollWindow(window, startsAt), window);
  assert.deepEqual(githubFeedPollWindow(window, endsAt), window);
  assert.deepEqual(
    githubFeedPollWindow(window, endsAt + (6 * 60 + 3) * 60_000 - 1),
    window
  );
  assert.equal(
    githubFeedPollWindow(window, endsAt + (6 * 60 + 3) * 60_000),
    null
  );
  assert.equal(
    githubFeedPollWindow({ startsAt, endsAt: startsAt }, startsAt),
    null
  );
});

test("late GitHub polls only include activity that occurred during the event", () => {
  const window = { startsAt: 100, endsAt: 200 };
  assert.equal(githubEventInWindow(99, window), false);
  assert.equal(githubEventInWindow(100, window), true);
  assert.equal(githubEventInWindow(199, window), true);
  assert.equal(githubEventInWindow(200, window), false);
  assert.equal(githubEventInWindow(Number.NaN, window), false);
});

test("every linked team repository gets its own conditional poll target", () => {
  const team = {
    _id: "team" as Id<"teams">,
    githubEtag: "legacy-primary",
    githubEtags: { "org/secondary": "secondary" },
    observedRepoUrls: ["https://github.com/org/observed"],
    repoUrl: "https://github.com/org/primary",
    repoUrls: [
      "https://github.com/org/primary",
      "https://github.com/org/secondary",
    ],
  } satisfies Pick<
    Doc<"teams">,
    | "_id"
    | "githubEtag"
    | "githubEtags"
    | "observedRepoUrls"
    | "repoUrl"
    | "repoUrls"
  >;

  assert.deepEqual(
    pollTargetsForTeam(team, "https://github.com/org/submission"),
    [
      { etag: undefined, repo: "org/submission", teamId: team._id },
      { etag: "legacy-primary", repo: "org/primary", teamId: team._id },
      { etag: "secondary", repo: "org/secondary", teamId: team._id },
    ]
  );
});

test("a locally observed repo is only a fallback without official configuration", () => {
  const team = {
    _id: "team" as Id<"teams">,
    observedRepoUrls: ["https://github.com/org/observed"],
  } as Pick<
    Doc<"teams">,
    | "_id"
    | "githubEtag"
    | "githubEtags"
    | "observedRepoUrls"
    | "repoUrl"
    | "repoUrls"
  >;
  assert.deepEqual(pollTargetsForTeam(team), [
    { etag: undefined, repo: "org/observed", teamId: team._id },
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
