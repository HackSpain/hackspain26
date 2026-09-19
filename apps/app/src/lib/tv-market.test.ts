import { test } from "node:test";
import assert from "node:assert/strict";
import type { Sample, Team } from "@/app/insights/mock-data";
import { demoInsights, marketPeople, marketSeries, marketSides, marketSlides, marketTeams, marketTotals } from "./tv-market";

const team = (id: string, name: string): Team => ({
  color: "#000", description: "", id, members: 3, name, primary: "claude-code", project: "", secondary: "cursor", track: "",
});
const sample = (teamId: string, bucket: number, tokens: number, commits = 0): Sample => ({
  bucket, cachedTokens: 0, commits, harness: "claude-code", pullRequests: 0, sessions: 1, teamId, tokens,
});

test("a team that overtakes in the current bucket shows the places it climbed", () => {
  const rows = marketTeams(
    [sample("a", 0, 100), sample("b", 0, 60), sample("c", 0, 40), sample("c", 1, 90), sample("a", 1, 10)],
    [team("a", "Alfa"), team("b", "Beta"), team("c", "Gamma")],
  );
  assert.deepEqual(rows.map((row) => [row.id, row.rank, row.move]), [["c", 1, 2], ["a", 2, -1], ["b", 3, -1]]);
  assert.deepEqual(rows[0]?.trend, [40, 130]);
  assert.equal(rows[0]?.recent, 90);
});

test("a team with nothing before this bucket has no movement, and people without a team are not ranked", () => {
  const rows = marketTeams(
    [sample("a", 0, 50), sample("b", 1, 500), sample("no-team", 1, 900)],
    [team("a", "Alfa"), team("b", "Beta"), team("no-team", "Sin equipo")],
  );
  assert.deepEqual(rows.map((row) => [row.id, row.move]), [["b", 0], ["a", -1]]);
});

test("the series covers every bucket up to the current one and adds up", () => {
  const series = marketSeries([sample("a", 0, 10, 2), sample("a", 3, 5, 1)]);
  assert.equal(series.length, 4);
  assert.deepEqual(series.map((row) => row.tokens), [10, 0, 0, 5]);
  assert.equal(marketTotals(series).pushes, 3);
});

test("every ranking page gets a turn, with the charts in between", () => {
  assert.deepEqual(marketSlides(0, 7).map((slide) => slide.kind), ["pulso", "ranking", "herramientas", "stacks"]);
  const slides = marketSlides(30, 7);
  assert.deepEqual(slides.filter((slide) => slide.kind === "ranking").map((slide) => slide.page), [0, 1, 2, 3, 4]);
  assert.equal(slides.length, 8);
});

test("each individual ranking orders by its own metric and leaves out people with nothing on it", () => {
  const person = (id: string, tokens: number, pushes: number, pullRequests = 0) => ({ id, name: id, pullRequests, pushes, team: "", tokens });
  const people = [person("ana", 900, 1), person("blas", 0, 4, 2), person("cruz", 300, 0)];
  assert.deepEqual(marketPeople(people, "tokens", 8).map((row) => row.id), ["ana", "cruz"]);
  assert.deepEqual(marketPeople(people, "git", 8).map((row) => row.id), ["blas", "ana"]);
  assert.deepEqual(marketPeople(people, "git", 1).map((row) => row.id), ["blas"]);
});

test("the side column splits the feed in posts and GitHub, then gives one ranking its turn", () => {
  const both = { commits: 3, posts: 2 };
  assert.deepEqual(marketSides({ commits: 0, posts: 0 }, []), ["posts"]);
  assert.deepEqual(marketSides(both, []), ["posts", "commits"]);
  const onlyGit = [{ id: "gh:blas", name: "blas", pullRequests: 0, pushes: 2, team: "", tokens: 0 }];
  assert.deepEqual(marketSides({ commits: 3, posts: 0 }, onlyGit), ["commits", "git"]);
  assert.deepEqual(marketSides(both, demoInsights(0, 0).people), ["posts", "commits", "tokens", "posts", "commits", "git"]);
});

test("the demo is the same on every screen and only the bucket in progress moves", () => {
  const first = demoInsights(0, 1_000_000_000_000);
  const later = demoInsights(3, 1_000_000_000_000);
  const closed = (data: typeof first) => data.samples.filter((row) => row.bucket < 15).map((row) => row.tokens);
  assert.deepEqual(closed(first), closed(later));
  assert.notDeepEqual(marketTotals(marketSeries(first.samples)), marketTotals(marketSeries(later.samples)));
});
