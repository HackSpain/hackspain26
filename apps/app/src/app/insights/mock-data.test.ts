import assert from "node:assert/strict";
import { test } from "node:test";
import { phaseRows, usageUsd } from "./event-data";
import {
  bucketTotals,
  filterSamples,
  getSamples,
  harnessRows,
  TEAMS,
  sumSamples,
  teamRows,
} from "./mock-data";
import type { Sample } from "./mock-data";

test("bucket totals keep first-seen order, combine repeats and handle no samples", () => {
  const sample: Sample = {
    bucket: 0,
    cachedTokens: 2,
    commits: 1,
    harness: "codex",
    pullRequests: 1,
    sessions: 1,
    teamId: "test-team",
    tokens: 10,
  };
  const rows = [
    { ...sample, bucket: 3, tokens: 10 },
    { ...sample, bucket: 1, tokens: 20 },
    { ...sample, bucket: 3, tokens: 30 },
  ];
  assert.deepEqual(bucketTotals(rows), [
    sumSamples([rows[0], rows[2]]),
    sumSamples([rows[1]]),
  ]);
  assert.deepEqual(bucketTotals([]), []);
});

test("unconnected insights have no fictional teams or activity and numeric zero totals", () => {
  const samples = filterSamples(getSamples(), "event", "all");
  const zero = { cachedTokens: 0, commits: 0, pullRequests: 0, sessions: 0, tokens: 0 };
  assert.deepEqual(samples, []);
  assert.deepEqual(TEAMS, []);
  assert.deepEqual(teamRows(samples), []);
  assert.deepEqual(sumSamples(samples), zero);
  for (const tool of harnessRows(samples)) {
    for (const metric of Object.keys(zero) as (keyof typeof zero)[]) {
      assert.equal(tool[metric], 0);
    }
    assert.equal(tool.teams, 0);
  }
  assert.equal(usageUsd(sumSamples(samples)), 0);
  for (const phase of phaseRows(samples)) {
    assert.equal(phase.cost, 0);
    assert.equal(phase.hourlyTokens, 0);
  }
});
