import { test } from "node:test";
import assert from "node:assert/strict";
import { connectionsFor, searchHaystack, sharedAffinities } from "./affinities";
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
  assert.deepEqual(
    sharedAffinities(anchor, { ...peer, skills: ["react", "REACT", " "] })
      .filter((item) => item.kind === "skills"),
    [{ kind: "skills", value: "React" }]
  );
});

test("search haystack includes team and project names", () => {
  const blob = searchHaystack({
    ...anchor,
    projectName: "Molino",
    team: { id: "t1", name: "Los Molinos" },
  });
  assert.ok(blob.includes("molino"));
  assert.ok(blob.includes("los molinos"));
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
