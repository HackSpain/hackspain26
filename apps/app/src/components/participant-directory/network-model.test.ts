import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildNetwork,
  initialPoints,
  networkSprings,
  tickForces,
} from "./network-model";
import type { DirectoryParticipant } from "./types";

const person: DirectoryParticipant = {
  id: "a",
  displayName: "Ana",
  city: "Madrid",
  role: "Developer",
  skills: ["React", "TypeScript"],
  company: "Nébula",
  degree: "Informática",
  university: "UPM",
  team: { id: "one", name: "Órbita" },
};
const peer = { ...person, id: "b", displayName: "Bruno", company: "nebula" };

test("global graph retains isolated people and preserves every relationship type for each pair", () => {
  const isolated = {
    id: "c",
    displayName: "Clara",
    city: "Bilbao",
    role: "Designer",
    skills: [],
  };
  const network = buildNetwork([person, peer, isolated]);
  assert.equal(network.participants.length, 3);
  assert.deepEqual(
    new Set(network.edges.map((edge) => edge.kind)),
    new Set(["city", "company", "degree", "university", "team", "skills"]),
  );
  assert.equal(network.edges.length, 6);
  assert.ok(
    network.edges.every((edge) => edge.source === "a" && edge.target === "b"),
  );
  assert.deepEqual(
    network.edges.find((edge) => edge.kind === "skills")?.values,
    ["React", "TypeScript"],
  );
});

test("teams match by stable id, never merely by display name", () => {
  const otherTeam = { ...peer, team: { id: "two", name: "Órbita" } };
  assert.equal(
    buildNetwork([person, otherTeam]).edges.some(
      (edge) => edge.kind === "team",
    ),
    false,
  );
  assert.equal(networkSprings(buildNetwork([person, peer]))[0].team, true);
});

test("force layout is deterministic regardless of input order and keeps dragged nodes pinned", () => {
  const network = buildNetwork([person, peer]);
  const points = initialPoints(network);
  assert.deepEqual(points, initialPoints(buildNetwork([peer, person])));
  const original = { ...points[0] };
  tickForces(points, networkSprings(network), 0.5, points[0].id);
  assert.equal(points[0].x, original.x);
  assert.equal(points[0].y, original.y);
  assert.ok(
    points.every(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
    ),
  );
  assert.ok(
    Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) > 50,
  );
});

test("team members cluster tightly even when every person shares other affinities", () => {
  const people = Array.from({ length: 6 }, (_, index) => ({
    ...person,
    id: `person-${index}`,
    team: {
      id: index < 3 ? "one" : "two",
      name: index < 3 ? "Órbita" : "Prisma",
    },
  }));
  const points = initialPoints(buildNetwork(people));
  const within: number[] = [],
    between: number[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const distance = Math.hypot(
        points[i].x - points[j].x,
        points[i].y - points[j].y,
      );
      (people[i].team.id === people[j].team.id ? within : between).push(
        distance,
      );
    }
  }
  const mean = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(mean(within) < mean(between) * 0.45);
  assert.ok(
    Math.min(...within) > 45,
    "teammates remain individually selectable",
  );
});
