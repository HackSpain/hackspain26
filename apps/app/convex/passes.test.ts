import assert from "node:assert/strict";
import { test } from "node:test";
import type { TestContext } from "node:test";
import type { MutationCtx } from "./_generated/server";
import { arrivals, staffScan, staffUndoCheckIn } from "./passes";
import { dropCheckInMetadata } from "./migrations";
import { reconcileArrivals } from "../src/lib/arrival-queue";

type Row = Record<string, unknown> & { _id: string; table: string };

function reception(t: TestContext) {
  let now = Date.parse("2026-09-18T12:00:00Z");
  t.mock.method(Date, "now", () => now);
  const rows = new Map<string, Row>([
    ["settings", { _id: "settings", table: "eventSettings", key: "main", phase: "live" }],
  ]);
  for (const [index, code] of ["AB7K", "CD8M"].entries()) {
    const suffix = String(index);
    rows.set(`signup${suffix}`, {
      _id: `signup${suffix}`, table: "signups", accepted: true,
      fullName: `Persona ${suffix}`, email: `person${suffix}@example.com`,
    });
    rows.set(`user${suffix}`, {
      _id: `user${suffix}`, table: "users", name: `Persona ${suffix}`,
      email: `person${suffix}@example.com`, attendanceStatus: "attending",
      image: "https://example.com/avatar.png",
      directory: { role: "Developer", city: "Madrid", company: "Acme", university: "", skills: ["React"] },
    });
    rows.set(`pass${suffix}`, {
      _id: `pass${suffix}`, table: "eventPasses", userId: `user${suffix}`,
      signupId: `signup${suffix}`, status: "active", code, createdAt: now - 1000, updatedAt: now - 1000,
    });
  }
  // Only the DB operations used by reception and its public TV projection.
  const ctx = {
    db: {
      query(table: string) {
        let matches = [...rows.values()].filter((row) => row.table === table);
        return {
          withIndex(_name: string, filter: (q: { eq: (field: string, value: unknown) => void }) => void) {
            filter({ eq(field, value) { matches = matches.filter((row) => row[field] === value); } });
            return { unique: async () => matches[0] ?? null };
          },
          collect: async () => matches,
        };
      },
      get: async (id: string) => rows.get(id) ?? null,
      async patch(id: string, fields: Record<string, unknown>) {
        const row = rows.get(id);
        assert.ok(row);
        Object.assign(row, fields);
      },
      async replace(id: string, fields: Record<string, unknown>) {
        const row = rows.get(id);
        assert.ok(row);
        rows.set(id, { ...fields, _id: id, table: row.table });
      },
    },
  } as unknown as MutationCtx;
  return { ctx, rows, tick: () => { now += 1000; } };
}

test("validating a reception code persists check-in and supplies the real TV profile", async (t) => {
  const { ctx, rows, tick } = reception(t);
  const baseline = await arrivals._handler(ctx, {});
  assert.deepEqual(baseline.entries, []);
  tick();
  const result = await staffScan._handler(ctx, { value: " ab7k " });
  assert.equal(result.status, "checked_in");
  const pass = rows.get("pass0");
  assert.equal(pass?.checkedInAt, result.checkedInAt);
  assert.equal("checkedInBy" in (pass ?? {}), false);
  assert.equal("checkedInVia" in (pass ?? {}), false);

  const snapshot = await arrivals._handler(ctx, { since: baseline.serverTime });
  assert.equal(snapshot.entries.length, 1);
  const [person] = snapshot.entries;
  assert.equal(person.name, "Persona 0");
  assert.equal(person.company, "Acme");
  assert.equal(person.image, "https://example.com/avatar.png");
  assert.equal("code" in person, false);
  assert.equal("email" in person, false);
  assert.equal(reconcileArrivals({ pending: [], seen: new Set() }, snapshot.entries).pending[0].id, person.id);
});

test("two reception desks queue both arrivals and a repeated code never replays", async (t) => {
  const { ctx, tick } = reception(t);
  const { serverTime: since } = await arrivals._handler(ctx, {});
  tick();
  await staffScan._handler(ctx, { value: "AB7K" });
  await staffScan._handler(ctx, { value: "CD8M" });
  const first = await arrivals._handler(ctx, { since });
  const queue = reconcileArrivals({ pending: [], seen: new Set() }, first.entries);
  assert.deepEqual(queue.pending.map((person) => person.name), ["Persona 0", "Persona 1"]);
  tick();
  assert.equal((await staffScan._handler(ctx, { value: "AB7K" })).status, "already_checked_in");
  const next = await arrivals._handler(ctx, { since });
  assert.equal(next.checkedIn, 2);
  assert.deepEqual(reconcileArrivals({ ...queue, pending: queue.pending.slice(1) }, next.entries).pending, queue.pending.slice(1));
});

test("unknown codes do not reach the screen and undo withdraws an arrival", async (t) => {
  const { ctx, tick } = reception(t);
  const { serverTime: since } = await arrivals._handler(ctx, {});
  tick();
  await assert.rejects(staffScan._handler(ctx, { value: "ZZZZ" }), /desconocida/);
  assert.deepEqual((await arrivals._handler(ctx, { since })).entries, []);
  const result = await staffScan._handler(ctx, { value: "AB7K" });
  await staffUndoCheckIn._handler(ctx, { passId: result.passId });
  assert.deepEqual((await arrivals._handler(ctx, { since })).entries, []);
});

test("legacy cleanup removes only operator metadata and can run twice", async (t) => {
  const { ctx, rows } = reception(t);
  await staffScan._handler(ctx, { value: "AB7K" });
  const pass = rows.get("pass0");
  assert.ok(pass);
  const checkedInAt = pass.checkedInAt;
  Object.assign(pass, { checkedInBy: "staff", checkedInVia: "reception_url" });
  assert.equal(await dropCheckInMetadata._handler(ctx, {}), 1);
  const clean = rows.get("pass0");
  assert.equal(clean?.checkedInAt, checkedInAt);
  assert.equal(clean?.code, "AB7K");
  assert.equal(clean?.userId, "user0");
  assert.equal(clean?.signupId, "signup0");
  assert.equal("checkedInBy" in (clean ?? {}), false);
  assert.equal("checkedInVia" in (clean ?? {}), false);
  assert.equal(await dropCheckInMetadata._handler(ctx, {}), 0);
});
