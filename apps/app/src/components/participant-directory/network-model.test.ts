import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildNetwork,
  ENTITY_KINDS,
  initialPoints,
  networkNeighbors,
  networkSprings,
  tickForces,
} from "./network-model";
import type { DirectoryParticipant } from "./types";

const person: DirectoryParticipant = {
  city: "Madrid",
  displayName: "Ana",
  id: "a",
  role: "Developer",
  skills: ["React"],
  interests: ["IA"],
  university: "UPM",
};
const peer = { ...person, displayName: "Bruno", id: "b" };
const kinds = new Set(ENTITY_KINDS);

test("people link to shared city and university nodes, never to each other", () => {
  const isolated = { ...person, id: "c", city: "", university: undefined };
  const network = buildNetwork([person, peer, isolated]);
  assert.equal(network.participants.length, 3);
  assert.equal(network.entities.length, 2);
  assert.equal(network.edges.length, 4);
  assert.deepEqual(
    new Set(network.edges.map((edge) => edge.kind)),
    new Set(["city", "university"]),
  );
  for (const edge of network.edges) {
    assert.ok(network.participants.some((p) => p.id === edge.source));
    assert.ok(network.entities.some((entity) => entity.id === edge.target));
  }
  assert.ok(initialPoints(network).some((point) => point.id === isolated.id));
  assert.equal(networkNeighbors(network, isolated.id, kinds).length, 0);
});

test("entity identities normalize accents and spaces but keep distinct categories", () => {
  const a = { ...person, city: " Málaga ", university: "Málaga" };
  const b = { ...peer, city: "MALAGA", university: "malaga" };
  const network = buildNetwork([a, b, a]);
  assert.equal(network.participants.length, 2);
  assert.equal(network.entities.length, 2);
  assert.equal(network.edges.length, 4);
  assert.notEqual(network.entities[0].id, network.entities[1].id);
  assert.ok(network.entities.every((entity) => entity.memberIds.length === 2));
  assert.deepEqual(buildNetwork([b, a]), network);
});

test("entity selection shows members; person selection traverses shared entities with filters", () => {
  const cityPeer = { ...peer, id: "c", university: "Other" };
  const network = buildNetwork([person, peer, cityPeer]);
  const madrid = network.entities.find((entity) => entity.kind === "city");
  assert.ok(madrid);
  assert.equal(networkNeighbors(network, madrid.id, kinds).length, 3);
  const neighbors = networkNeighbors(network, person.id, kinds);
  assert.deepEqual(
    neighbors.map(({ person: p }) => p.id),
    ["b", "c"],
  );
  assert.equal(neighbors[0].links.length, 2);
  assert.deepEqual(
    networkNeighbors(network, person.id, new Set(["university"])).map(
      ({ person: p }) => p.id,
    ),
    ["b"],
  );
  assert.equal(
    networkNeighbors(network, madrid.id, new Set(["university"])).length,
    0,
  );
  assert.equal(networkNeighbors(network, person.id, new Set()).length, 0);
});

test("membership count grows linearly even when everyone shares all attributes", () => {
  const people = Array.from({ length: 262 }, (_, i) => ({
    ...person,
    id: `p${i}`,
  }));
  const network = buildNetwork(people);
  assert.equal(network.entities.length, 2);
  assert.equal(network.edges.length, 524);
  assert.equal(networkSprings(network).length, 524);
  assert.ok(
    network.entities.every((entity) => entity.memberIds.length === 262),
  );
});

test("layout includes both node types, is deterministic and respects pinned nodes", () => {
  const network = buildNetwork([person, peer]);
  const points = initialPoints(network);
  assert.equal(points.length, 4);
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
  assert.equal(initialPoints(buildNetwork([])).length, 0);
});

test("company, degree and team are entities; same team names do not merge distinct teams", () => {
  const a = {
    ...person,
    company: "Nébula",
    degree: "Informática",
    team: { id: "one", name: "Órbita" },
  };
  const b = {
    ...peer,
    company: "nebula",
    degree: "informatica",
    team: { id: "two", name: "Órbita" },
  };
  const network = buildNetwork([a, b]);
  assert.equal(network.entities.length, 6);
  assert.equal(network.edges.length, 10);
  assert.deepEqual(
    new Set(network.entities.map((entity) => entity.kind)),
    kinds,
  );
  const teams = network.entities.filter((entity) => entity.kind === "team");
  assert.equal(teams.length, 2);
  assert.ok(teams.every((entity) => entity.memberIds.length === 1));
  assert.equal(networkNeighbors(network, a.id, new Set(["team"])).length, 0);
  assert.equal(
    networkNeighbors(network, a.id, new Set(["company", "degree"]))[0].links
      .length,
    2,
  );
});
