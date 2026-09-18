import assert from "node:assert/strict";
import { test } from "node:test";
import type { Arrival } from "./arrival-queue";
import { reconcileArrivals } from "./arrival-queue";

function arrival(id: string, checkedInAt: number): Arrival {
  return { id, checkedInAt, name: id, number: 1, image: null, role: "Hacker", city: "", company: "", university: "", skills: [] };
}

test("simultaneous check-ins queue in order and repeated snapshots do not duplicate them", () => {
  const entries = [arrival("b", 20), arrival("a", 10)];
  const first = reconcileArrivals({ pending: [], seen: new Set() }, entries);
  assert.deepEqual(first.pending.map((entry) => entry.id), ["a", "b"]);
  assert.deepEqual(reconcileArrivals(first, entries).pending, first.pending);
});

test("completed presentations are not replayed after reconnect or a profile edit", () => {
  const a = arrival("a", 10);
  const first = reconcileArrivals({ pending: [], seen: new Set() }, [a]);
  const next = reconcileArrivals({ ...first, pending: [] }, [{ ...a, name: "Updated" }, arrival("b", 20)]);
  assert.deepEqual(next.pending.map((entry) => entry.id), ["b"]);
});

test("undo removes an active or queued arrival; a new check-in can enter again", () => {
  const first = reconcileArrivals({ pending: [], seen: new Set() }, [arrival("pass:10", 10), arrival("other:20", 20)]);
  const undone = reconcileArrivals(first, [arrival("other:20", 20)]);
  assert.deepEqual(undone.pending.map((entry) => entry.id), ["other:20"]);
  const checkedAgain = reconcileArrivals(undone, [arrival("other:20", 20), arrival("pass:30", 30)]);
  assert.deepEqual(checkedAgain.pending.map((entry) => entry.id), ["other:20", "pass:30"]);
});
