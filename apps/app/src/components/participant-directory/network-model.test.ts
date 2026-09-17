import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildNetwork,
  initialPoints,
  networkSprings,
  normalize,
  tickForces,
} from "./network-model";
import type { DirectoryParticipant } from "./types";

const person: DirectoryParticipant = {
  city: "Madrid",
  company: "Nébula Labs",
  displayName: "Ana",
  id: "a",
  role: "Developer",
  skills: ["React"],
  team: { id: "one", name: "Órbita" },
  university: "UPM",
};
const peer: DirectoryParticipant = {
  ...person,
  company: " nebula labs ",
  displayName: "Bruno",
  id: "b",
  university: undefined,
};

test("people hang off shared hubs and never link to each other", () => {
  const isolated: DirectoryParticipant = {
    city: "Bilbao",
    displayName: "Clara",
    id: "c",
    role: "Designer",
    skills: [],
  };
  const network = buildNetwork([person, peer, isolated]);
  assert.equal(network.participants.length, 3);
  assert.deepEqual(
    network.hubs.map((hub) => [hub.id, hub.members]),
    [
      ["team:one", ["a", "b"]],
      ["university:upm", ["a"]],
      ["company:nebula labs", ["a", "b"]],
    ]
  );
  assert.equal(network.hubs[2].label, "Nébula Labs");
  assert.equal(network.edges.length, 5);
  assert.ok(
    network.edges.every(
      (edge) =>
        network.participants.some((p) => p.id === edge.person) &&
        network.hubs.some((hub) => hub.id === edge.hub)
    )
  );
});

test("teams match by stable id, never merely by display name", () => {
  const otherTeam = { ...peer, team: { id: "two", name: "Órbita" } };
  const teams = buildNetwork([person, otherTeam]).hubs.filter(
    (hub) => hub.kind === "team"
  );
  assert.equal(teams.length, 2);
  assert.equal(normalize("  Órbita  "), "orbita");
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
      (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
    )
  );
});

test("people settle closer to their own hubs than to other hubs", () => {
  const people = Array.from({ length: 6 }, (_, index) => ({
    ...person,
    company: undefined,
    id: `person-${index}`,
    team: {
      id: index < 3 ? "one" : "two",
      name: index < 3 ? "Órbita" : "Prisma",
    },
    university: undefined,
  }));
  const network = buildNetwork(people);
  const points = new Map(
    initialPoints(network).map((point) => [point.id, point])
  );
  const distance = (a: string, b: string) => {
    const p = points.get(a) ?? { x: 0, y: 0 },
      q = points.get(b) ?? { x: 0, y: 0 };
    return Math.hypot(p.x - q.x, p.y - q.y);
  };
  for (const member of people) {
    const own = distance(member.id, `team:${member.team.id}`);
    const other = distance(
      member.id,
      member.team.id === "one" ? "team:two" : "team:one"
    );
    assert.ok(own < other * 0.6, `${member.id} sits with its team`);
  }
  const ids = people.map((p) => p.id);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      assert.ok(distance(ids[i], ids[j]) > 40, "people stay selectable");
    }
  }
});
