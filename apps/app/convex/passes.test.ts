import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { MutationCtx } from "./_generated/server";
import {
  arrivals,
  checkInParticipantRecord,
  scan,
  undoCheckIn,
} from "./passes";
import { dropCheckInMetadata } from "./migrations";
import { TEST_EDITION_ID, testEditionRow } from "./lib/testFixtures";
import { reconcileArrivals } from "../src/lib/arrival-queue";

type Row = Record<string, unknown> & { _id: string; table: string };

let restoreNow: (() => void) | undefined;
afterEach(() => {
  restoreNow?.();
  restoreNow = undefined;
});

function passesContext() {
  let now = Date.parse("2026-09-18T12:00:00Z");
  const originalNow = Date.now.bind(Date);
  Date.now = () => now;
  restoreNow = () => {
    Date.now = originalNow;
  };
  const rows = new Map<string, Row>([
    [
      "edition",
      {
        ...testEditionRow(),
        table: "editions",
      } as Row,
    ],
    ["operator", { _id: "operator", table: "users", role: "admin" }],
  ]);
  for (const [index, code] of ["AB7K", "CD8M"].entries()) {
    const suffix = String(index);
    rows.set(`signup${suffix}`, {
      _id: `signup${suffix}`,
      attendanceStatus: "attending",
      editionId: TEST_EDITION_ID,
      email: `person${suffix}@example.com`,
      fullName: `Persona ${suffix}`,
      status: "accepted",
      table: "participations",
      userId: `user${suffix}`,
    });
    rows.set(`user${suffix}`, {
      _id: `user${suffix}`,
      table: "users",
      name: `Persona ${suffix}`,
      email: `person${suffix}@example.com`,
      image: "https://example.com/avatar.png",
      directory: {
        role: "Developer",
        city: "Madrid",
        company: "Acme",
        university: "",
        skills: ["React"],
      },
    });
    rows.set(`pass${suffix}`, {
      _id: `pass${suffix}`,
      table: "eventPasses",
      userId: `user${suffix}`,
      signupId: `signup${suffix}`,
      editionId: TEST_EDITION_ID,
      status: "active",
      code,
      createdAt: now - 1000,
      updatedAt: now - 1000,
    });
  }
  // Only the DB operations used by admin check-in and its public TV projection.
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: "operator" }) },
    db: {
      query(table: string) {
        let matches = [...rows.values()].filter((row) => row.table === table);
        return {
          withIndex(
            _name: string,
            filter: (q: { eq: (field: string, value: unknown) => void }) => void
          ) {
            const range = {
              eq(field: string, value: unknown) {
                matches = matches.filter((row) => row[field] === value);
                return range;
              },
            };
            filter(range);
            return {
              collect: async () => matches,
              unique: async () => matches[0] ?? null,
            };
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
      async insert(table: string, fields: Record<string, unknown>) {
        const id = `${table}${rows.size}`;
        rows.set(id, { ...fields, _id: id, table });
        return id;
      },
      async replace(id: string, fields: Record<string, unknown>) {
        const row = rows.get(id);
        assert.ok(row);
        rows.set(id, { ...fields, _id: id, table: row.table });
      },
    },
  } as unknown as MutationCtx;
  return {
    ctx,
    rows,
    tick: () => {
      now += 1000;
    },
  };
}

test("admin code scan persists check-in and supplies the real TV profile", async () => {
  const { ctx, rows, tick } = passesContext();
  const baseline = await arrivals._handler(ctx, {});
  assert.deepEqual(baseline.entries, []);
  tick();
  const result = await scan._handler(ctx, { value: " ab7k " });
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
  assert.equal(
    reconcileArrivals({ pending: [], seen: new Set() }, snapshot.entries)
      .pending[0].id,
    person.id
  );
});

test("two admin scans queue both arrivals and a repeated code never replays", async () => {
  const { ctx, tick } = passesContext();
  const { serverTime: since } = await arrivals._handler(ctx, {});
  tick();
  await scan._handler(ctx, { value: "AB7K" });
  await scan._handler(ctx, { value: "CD8M" });
  const first = await arrivals._handler(ctx, { since });
  const queue = reconcileArrivals(
    { pending: [], seen: new Set() },
    first.entries
  );
  assert.deepEqual(
    queue.pending.map((person) => person.name),
    ["Persona 0", "Persona 1"]
  );
  tick();
  assert.equal(
    (await scan._handler(ctx, { value: "AB7K" })).status,
    "already_checked_in"
  );
  const next = await arrivals._handler(ctx, { since });
  assert.equal(next.checkedIn, 2);
  assert.deepEqual(
    reconcileArrivals(
      { ...queue, pending: queue.pending.slice(1) },
      next.entries
    ).pending,
    queue.pending.slice(1)
  );
});

test("unknown codes do not reach the screen and admin undo withdraws an arrival", async () => {
  const { ctx, tick } = passesContext();
  const { serverTime: since } = await arrivals._handler(ctx, {});
  tick();
  await assert.rejects(scan._handler(ctx, { value: "ZZZZ" }), /desconocida/);
  assert.deepEqual((await arrivals._handler(ctx, { since })).entries, []);
  const result = await scan._handler(ctx, { value: "AB7K" });
  await undoCheckIn._handler(ctx, { passId: result.passId });
  assert.deepEqual((await arrivals._handler(ctx, { since })).entries, []);
});

test("legacy cleanup removes only operator metadata and can run twice", async () => {
  const { ctx, rows } = passesContext();
  await scan._handler(ctx, { value: "AB7K" });
  const pass = rows.get("pass0");
  assert.ok(pass);
  const checkedInAt = pass.checkedInAt;
  Object.assign(pass, { checkedInBy: "staff", checkedInVia: "reception_url" });
  assert.equal(await dropCheckInMetadata._handler(ctx, {}), 1);
  const clean = rows.get("pass0");
  assert.equal(clean?.checkedInAt, checkedInAt);
  assert.equal(clean?.code, "AB7K");
  assert.equal(clean?.userId, "user0");
  assert.equal("checkedInBy" in (clean ?? {}), false);
  assert.equal("checkedInVia" in (clean ?? {}), false);
  assert.equal(await dropCheckInMetadata._handler(ctx, {}), 0);
});

test("admin ficha check-in marks the existing pass and can run twice", async () => {
  const { ctx, rows } = passesContext();
  const result = await checkInParticipantRecord(ctx, {
    signupId: "signup0" as never,
  });
  assert.equal(result.status, "checked_in");
  assert.equal(rows.get("pass0")?.checkedInAt, result.checkedInAt);
  const again = await checkInParticipantRecord(ctx, {
    signupId: "signup0" as never,
  });
  assert.equal(again.status, "already_checked_in");
  assert.equal(again.checkedInAt, result.checkedInAt);
});

test("admin ficha check-in issues a pass when the person has none", async () => {
  const { ctx, rows } = passesContext();
  rows.delete("pass0");
  const result = await checkInParticipantRecord(ctx, {
    signupId: "signup0" as never,
  });
  assert.equal(result.status, "checked_in");
  const created = [...rows.values()].find(
    (row) => row.table === "eventPasses" && row.userId === "user0"
  );
  assert.ok(created);
  assert.equal(created.checkedInAt, result.checkedInAt);
  assert.equal(created.status, "active");
});

test("admin ficha check-in can recover a cancelled attendee", async () => {
  const { ctx, rows } = passesContext();
  const participation = rows.get("signup0");
  assert.ok(participation);
  participation.attendanceStatus = "cancelled";
  const result = await checkInParticipantRecord(ctx, {
    userId: "user0" as never,
  });
  assert.equal(result.status, "checked_in");
  assert.equal(rows.get("signup0")?.attendanceStatus, "attending");
});
