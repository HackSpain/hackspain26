import assert from "node:assert/strict";
import { test } from "node:test";
import { demoClosingData, figure, summarize } from "./closing-summary";

test("figure compacts to three digits and a unit", () => {
  assert.equal(figure(342), "342");
  assert.equal(figure(9999), "9.999");
  assert.equal(figure(16_590), "16,6 k");
  assert.equal(figure(456_000), "456 k");
  assert.equal(figure(999_960), "1 M");
  assert.equal(figure(9_600_000), "9,6 M");
  assert.equal(figure(2_345_000_000), "2,3 B");
  assert.equal(figure(13_866_711_702), "13,9 B");
});

test("the special mention goes to the person with the most tokens", () => {
  const { burner, people } = summarize(demoClosingData());
  assert.equal(burner?.name, "t0kenl0rd_99");
  assert.equal(people[0]?.name, burner?.name);
  assert.ok(burner && burner.lead > 1 && burner.share > 0 && burner.share < 1);
  const data = demoClosingData();
  data.insights.people = [];
  assert.equal(summarize(data).burner, null);
});

test("totals match the per-bucket series", () => {
  const summary = summarize(demoClosingData());
  const perBucket = summary.timeline.tokens.reduce((sum, value) => sum + value, 0);
  assert.equal(perBucket, summary.usage.tokens);
  assert.equal(summary.hero.find((stat) => stat.label === "Tokens")?.value, perBucket);
});

test("Madrid's small hours count as night", () => {
  // The demo window starts Saturday 11:00, so bucket 13 is 00:00 and bucket 20 is 07:00.
  const { timeline } = summarize(demoClosingData());
  assert.equal(timeline.night.indexOf(true), 13);
  assert.equal(timeline.night.lastIndexOf(true), 19);
  assert.ok(timeline.nightShare > 0 && timeline.nightShare < 0.2);
});

test("every mention names a team, and usage without a team earns none", () => {
  const summary = summarize(demoClosingData());
  assert.equal(summary.awards.length, 6);
  assert.ok(summary.awards.every((award) => award.team.startsWith("Equipo")));
  const data = demoClosingData();
  data.insights.samples = data.insights.samples.map((row) => ({ ...row, teamId: "" }));
  data.insights.activity = [];
  assert.deepEqual(summarize(data).awards, []);
});
