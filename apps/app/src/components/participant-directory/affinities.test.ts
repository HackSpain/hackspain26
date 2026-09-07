import { test } from "node:test";
import assert from "node:assert/strict";
import { connectionsFor, sharedAffinities } from "./affinities";
import type { DirectoryParticipant } from "./types";

const anchor: DirectoryParticipant = {
  city: " Málaga ",
  displayName: "Álex",
  id: "anchor",
  interests: ["Educación"],
  role: "Developer",
  skills: ["React", "react", "TypeScript"],
  university: "Universidad de Málaga",
};
const peer: DirectoryParticipant = {
  city: "malaga",
  displayName: "Nora",
  id: "peer",
  interests: ["educacion"],
  role: "Designer",
  skills: ["REACT"],
  university: "universidad de malaga",
};

test("normalizes accents, case and whitespace without counting duplicate skills", () => {
  const shared = sharedAffinities(anchor, peer);
  assert.equal(shared.length, 4);
  assert.deepEqual(
    shared.map((item) => item.kind),
    ["university", "city", "skills", "interests"]
  );
});

test("never links a profile to itself or matches missing data", () => {
  assert.deepEqual(sharedAffinities(anchor, anchor), []);
  const empty = {
    ...anchor,
    city: " ",
    interests: [],
    skills: [],
    university: undefined,
  };
  assert.deepEqual(sharedAffinities(empty, { ...empty, id: "other" }), []);
});

test("ranks concrete shared categories and excludes unrelated people", () => {
  const skillOnly = {
    ...peer,
    city: "Bilbao",
    id: "skills",
    interests: [],
    university: undefined,
  };
  const unrelated = { ...skillOnly, id: "unrelated", skills: ["Go"] };
  assert.deepEqual(
    connectionsFor(anchor, [anchor, skillOnly, unrelated, peer]).map(
      (item) => item.participant.id
    ),
    ["peer", "skills"]
  );
});

test("filters by relationship and searches university with accent-insensitive matching", () => {
  const results = connectionsFor(anchor, [peer], "university", "MÁLAGA");
  assert.equal(results.length, 1);
  assert.deepEqual(
    results[0].affinities.map((item) => item.kind),
    ["university"]
  );
  assert.equal(connectionsFor(anchor, [peer], "all", "no existe").length, 0);
});
