import assert from "node:assert/strict";
import { test } from "node:test";
import { phaseRows, usageUsd } from "./event-data";
import {
  bucketTotals,
  filterSamples,
  getSamples,
  harnessRows,
  periodBuckets,
  TEAMS,
  sumSamples,
  teamRows,
  timeLabel,
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

const STARTS_AT = Date.parse("2026-09-18T16:45:00Z");
// 47 h 15 min in 24 buckets.
const TIMELINE = { bucketMinutes: 118.125, startsAt: STARTS_AT };

test("periods: the static layout keeps its last-N-buckets rule", () => {
  assert.deepEqual(periodBuckets("event"), { from: 0, to: 23 });
  assert.deepEqual(periodBuckets("6h"), { from: 12, to: 23 });
  assert.deepEqual(periodBuckets("1h"), { from: 22, to: 23 });
});

test("periods: on a real timeline they end at the bucket the clock is in", () => {
  // 17 h 15 min in: bucket 8.
  const now = Date.parse("2026-09-19T10:00:00Z");
  assert.deepEqual(periodBuckets("event", TIMELINE, now), { from: 0, to: 23 });
  assert.deepEqual(periodBuckets("1h", TIMELINE, now), { from: 8, to: 8 });
  // Six hours take four two-hour buckets.
  assert.deepEqual(periodBuckets("6h", TIMELINE, now), { from: 5, to: 8 });
});

test("periods: clamped before the start and after the end", () => {
  assert.deepEqual(periodBuckets("6h", TIMELINE, STARTS_AT - 1), {
    from: 0,
    to: 0,
  });
  assert.deepEqual(
    periodBuckets("1h", TIMELINE, Date.parse("2026-09-25T00:00:00Z")),
    { from: 23, to: 23 }
  );
});

test("time labels: real Madrid time on a timeline, the static day otherwise", () => {
  assert.ok(timeLabel(0, TIMELINE).includes("18:45"));
  assert.equal(timeLabel(0), "09:00");
  assert.equal(timeLabel(3), "10:30");
});
