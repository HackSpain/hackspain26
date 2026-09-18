import { test } from "node:test";
import assert from "node:assert/strict";
import { placeClusters, stickySlots } from "@/components/participant-directory/network-model";
import type { Cluster } from "@/components/participant-directory/network-model";
import { demoFormation, formationEvents, formationStats } from "./tv-teams";
import type { FormationPerson } from "./tv-teams";

const person = (id: string, team?: string): FormationPerson => ({ id, name: id.toUpperCase(), team: team ? { id: team, name: `Equipo ${team}` } : undefined });

test("the first person into a team founds it, the rest join, and leaving is not news", () => {
  const before = [person("a"), person("b"), person("c", "x"), person("d", "x")];
  const after = [person("a", "y"), person("b", "y"), person("c", "x"), person("d"), person("e", "x")];
  assert.deepEqual(
    formationEvents(before, after, 7).map((event) => [event.personId, event.kind, event.team]),
    [["a", "new", "Equipo y"], ["b", "join", "Equipo y"], ["e", "join", "Equipo x"]],
  );
  assert.deepEqual(formationEvents(after, after, 8), []);
});

test("stats count people with and without a team, and the teams that exist", () => {
  assert.deepEqual(formationStats([person("a", "x"), person("b", "x"), person("c", "y"), person("d")]), { loose: 1, placed: 3, teams: 2, total: 4 });
  assert.deepEqual(formationStats([]), { loose: 0, placed: 0, teams: 0, total: 0 });
});

test("the demo starts with nobody placed, places one person per step and starts over", () => {
  assert.equal(formationStats(demoFormation(0)).placed, 0);
  assert.equal(formationStats(demoFormation(10)).placed, 10);
  assert.equal(formationEvents(demoFormation(10), demoFormation(11), 1).length, 1);
  assert.equal(formationStats(demoFormation(96)).loose, 0);
  assert.equal(formationStats(demoFormation(96 + 12)).placed, 0);
});

test("a cluster keeps its slot while others come and go, and the centre is reserved", () => {
  const first = stickySlots(new Map(), ["loose", "a", "b", "c"], "loose");
  assert.deepEqual([...first], [["loose", 0], ["a", 1], ["b", 2], ["c", 3]]);
  // b dissolves, d appears: a and c stay put, d takes the freed slot.
  const second = stickySlots(first, ["loose", "c", "a", "d"], "loose");
  assert.deepEqual([second.get("a"), second.get("c"), second.get("d")], [1, 3, 2]);
  // Without anybody loose the centre stays empty rather than going to a team.
  assert.equal(Math.min(...stickySlots(new Map(), ["a", "b"]).values()), 1);
});

test("a team that grows stays where it was instead of trading places", () => {
  const cluster = (id: string, members: number): Cluster => ({ id, label: id, lens: "team", loose: false, memberIds: Array.from({ length: members }, (_, index) => `${id}-${index}`) });
  const slots = [1, 2, 3, 4, 5];
  const before = placeClusters(["a", "b", "c", "d", "e"].map((id) => cluster(id, 2)), 2, { flatten: true, slots });
  const after = placeClusters(["a", "b", "c", "d", "e"].map((id) => cluster(id, id === "e" ? 4 : 2)), 2, { flatten: true, slots });
  for (const [index, place] of after.entries()) {
    const moved = Math.hypot(place.x - (before[index]?.x ?? 0), place.y - (before[index]?.y ?? 0));
    assert.ok(moved < 120, `${place.id} moved ${Math.round(moved)}`);
  }
});
