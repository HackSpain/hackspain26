import { expect, test } from "bun:test";
import { mergePeople, pickPeople } from "./people";

const usage = [
  { tokens: 900, userId: "u-ana" },
  { tokens: 500, userId: "u-blas" },
  { tokens: 100, userId: "u-cruz" },
];
const actors = [
  { login: "cruz-dev", pullRequests: 1, pushes: 9, teamId: "t1" },
  { login: "stranger", pullRequests: 0, pushes: 4, teamId: "t2" },
  { login: "ana", pullRequests: 0, pushes: 2, teamId: "t1" },
];
const teams = [
  { id: "t1", name: "Los Compiladores" },
  { id: "t2", name: "Tortilla Stack" },
];

test("only the top of each metric is looked up by name", () => {
  expect(pickPeople(usage, actors, 2)).toEqual({
    logins: ["cruz-dev", "stranger"],
    userIds: ["u-ana", "u-blas"],
  });
});

test("a picked person carries both metrics even when they only top one", () => {
  const picked = pickPeople(usage, actors, 2);
  const rows = mergePeople(
    usage,
    actors,
    [
      { id: "u-ana", login: "ana", name: "Ana", photoUrl: "https://files.test/ana", team: "Los Compiladores" },
      { id: "u-blas", name: "Blas", team: "" },
      { id: "u-cruz", login: "cruz-dev", name: "Cruz", team: "" },
    ],
    picked,
    teams
  );
  expect(rows).toEqual([
    // Third by pushes, so not picked by login, but her pushes still show.
    { id: "u-ana", name: "Ana", photoUrl: "https://files.test/ana", pullRequests: 0, pushes: 2, team: "Los Compiladores", tokens: 900 },
    { id: "u-blas", name: "Blas", pullRequests: 0, pushes: 0, team: "", tokens: 500 },
    // Third by tokens; without a membership the team comes from the repo.
    { id: "u-cruz", name: "Cruz", pullRequests: 1, pushes: 9, team: "Los Compiladores", tokens: 100 },
    // Nobody linked this GitHub account: the login and its public avatar stand in, with no tokens.
    { id: "gh:stranger", name: "stranger", photoUrl: "https://github.com/stranger.png?size=128", pullRequests: 0, pushes: 4, team: "Tortilla Stack", tokens: 0 },
  ]);
});

test("without usage the ranking keeps its GitHub half", () => {
  const picked = pickPeople([], actors, 8);
  expect(mergePeople([], actors, [], picked, teams).map((row) => row.id)).toEqual([
    "gh:cruz-dev",
    "gh:stranger",
    "gh:ana",
  ]);
});
