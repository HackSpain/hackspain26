import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  apply,
  cancel,
  confirm,
  findSharedBadge,
  lookupCancellation,
  lookupConfirmation,
  requestCancellation,
  saveBadgePhoto,
  subscribe,
} from "./landing";
import {
  TEST_EDITION_ID,
  TEST_HACKER_ROLE_ID,
  testEditionRow,
  testHackerRole,
} from "./lib/testFixtures";

const secret = "test-subscribe-secret";
const originalSecret = process.env.SUBSCRIBE_SECRET;
const TOKEN = "11111111-1111-4111-8111-111111111111";
const PHOTO = `data:image/jpeg;base64,${"A".repeat(16)}`;

before(() => {
  process.env.SUBSCRIBE_SECRET = secret;
});
after(() => {
  if (originalSecret === undefined) {
    delete process.env.SUBSCRIBE_SECRET;
  } else {
    process.env.SUBSCRIBE_SECRET = originalSecret;
  }
});

function fakeCtx(
  extra: {
    participations?: Record<string, unknown>[];
    userTypes?: Record<string, unknown>[];
  } = {}
) {
  const tables: Record<string, Record<string, unknown>[]> = {
    editions: [testEditionRow()],
    participations: extra.participations ?? [],
    userTypes: extra.userTypes ?? [testHackerRole()],
    users: [],
  };
  const scheduled: unknown[] = [];
  const db = {
    query(table: string) {
      let selected = [...(tables[table] ?? [])];
      const query = {
        withIndex(
          _index: string,
          filter: (q: {
            eq: (field: string, value: unknown) => unknown;
          }) => void
        ) {
          const range = {
            eq(field: string, value: unknown) {
              selected = selected.filter((row) => row[field] === value);
              return range;
            },
          };
          filter(range);
          return query;
        },
        unique: async () => selected[0] ?? null,
        first: async () => selected[0] ?? null,
        collect: async () => selected,
      };
      return query;
    },
    async get(id: string) {
      for (const rows of Object.values(tables)) {
        const row = rows.find((candidate) => candidate._id === id);
        if (row) {
          return row;
        }
      }
      return null;
    },
    async insert(table: string, fields: Record<string, unknown>) {
      const id = `${table}-${(tables[table] ?? []).length + 1}`;
      (tables[table] ??= []).push({ _id: id, ...fields });
      return id;
    },
    async patch(id: string, fields: Record<string, unknown>) {
      for (const rows of Object.values(tables)) {
        const row = rows.find((candidate) => candidate._id === id);
        if (row) {
          Object.assign(row, fields);
          return;
        }
      }
    },
  };
  return {
    ctx: {
      db,
      scheduler: {
        runAfter: async (_delay: number, fn: unknown, args: unknown) => {
          scheduled.push({ args, fn });
          return "job";
        },
      },
    } as unknown as MutationCtx & QueryCtx,
    scheduled,
    tables,
  };
}

test("subscribe refuses calls without the landing's secret", async () => {
  const { ctx, tables } = fakeCtx();
  await assert.rejects(
    subscribe._handler(ctx, { email: "ada@example.com", secret: "wrong" }),
    /Unauthorized/
  );
  assert.equal(tables.participations.length, 0);
});

test("subscribe stores each normalized email once", async () => {
  const { ctx, tables } = fakeCtx();
  await subscribe._handler(ctx, { email: " Ada@Example.com ", secret });
  await subscribe._handler(ctx, { email: "ada@example.com", secret });
  assert.deepEqual(
    tables.participations.map((row) => row.email),
    ["ada@example.com"]
  );
  assert.equal(tables.participations[0]?.editionId, TEST_EDITION_ID);
  assert.equal(tables.participations[0]?.roleId, TEST_HACKER_ROLE_ID);
  assert.equal(tables.participations[0]?.status, "interested");
  await assert.rejects(
    subscribe._handler(ctx, { email: "not-an-email", secret }),
    /Email inválido/
  );
});

test("apply inserts an applied participation for an open role", async () => {
  const { ctx, tables, scheduled } = fakeCtx();
  await apply._handler(ctx, {
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    githubUrl: "https://github.com/ada",
    roleSlug: "hacker",
    secret,
  });
  assert.equal(tables.participations.length, 1);
  assert.equal(tables.participations[0]?.status, "applied");
  assert.equal(tables.participations[0]?.fullName, "Ada Lovelace");
  assert.equal(tables.participations[0]?.roleId, TEST_HACKER_ROLE_ID);
  assert.equal(tables.participations[0]?.editionId, TEST_EDITION_ID);
  assert.equal(typeof tables.participations[0]?.managementToken, "string");
  assert.equal(scheduled.length, 1);
});

test("apply upgrades an interested row and refuses a second application", async () => {
  const { ctx, tables } = fakeCtx();
  await subscribe._handler(ctx, { email: "ada@example.com", secret });
  await apply._handler(ctx, {
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    roleSlug: "hacker",
    secret,
  });
  assert.equal(tables.participations.length, 1);
  assert.equal(tables.participations[0]?.status, "applied");
  await assert.rejects(
    apply._handler(ctx, {
      email: "ada@example.com",
      fullName: "Ada Lovelace",
      roleSlug: "hacker",
      secret,
    }),
    /Ya hay una solicitud/
  );
});

test("apply writes waitlist when the edition is in waitlist mode", async () => {
  const { ctx, tables } = fakeCtx();
  tables.editions[0] = { ...tables.editions[0], applicationsMode: "waitlist" };
  await apply._handler(ctx, {
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    roleSlug: "hacker",
    secret,
  });
  assert.equal(tables.participations[0]?.status, "waitlist");
});

test("apply refuses when applications are closed", async () => {
  const { ctx, tables } = fakeCtx();
  tables.editions[0] = { ...tables.editions[0], applicationsMode: "closed" };
  await assert.rejects(
    apply._handler(ctx, {
      email: "ada@example.com",
      fullName: "Ada Lovelace",
      roleSlug: "hacker",
      secret,
    }),
    /cerradas/
  );
});

test("apply refuses a role that is not open", async () => {
  const { ctx } = fakeCtx({
    userTypes: [testHackerRole({ openForApplications: false })],
  });
  await assert.rejects(
    apply._handler(ctx, {
      email: "ada@example.com",
      fullName: "Ada Lovelace",
      roleSlug: "hacker",
      secret,
    }),
    /no admite solicitudes/
  );
});

test("confirm only moves accepted to confirmed", async () => {
  const { ctx } = fakeCtx({
    participations: [
      {
        _id: "p1",
        editionId: TEST_EDITION_ID,
        email: "ada@example.com",
        fullName: "Ada Lovelace",
        githubUsername: "ada",
        managementToken: TOKEN,
        roleId: TEST_HACKER_ROLE_ID,
        status: "accepted",
      },
    ],
  });
  const lookup = await lookupConfirmation._handler(ctx, {
    secret,
    token: TOKEN,
  });
  assert.equal(lookup.state, "confirm");
  const confirmed = await confirm._handler(ctx, { secret, token: TOKEN });
  assert.equal(confirmed.state, "confirmed");
  assert.equal(confirmed.githubHandle, "ada");
  const again = await confirm._handler(ctx, { secret, token: TOKEN });
  assert.equal(again.state, "confirmed");
});

test("cancel writes cancelled status and attendance", async () => {
  const { ctx, tables } = fakeCtx({
    participations: [
      {
        _id: "p1",
        editionId: TEST_EDITION_ID,
        email: "ada@example.com",
        fullName: "Ada Lovelace",
        managementToken: TOKEN,
        roleId: TEST_HACKER_ROLE_ID,
        status: "confirmed",
      },
    ],
  });
  const view = await cancel._handler(ctx, { secret, token: TOKEN });
  assert.equal(view.state, "cancelled");
  assert.equal(tables.participations[0]?.status, "cancelled");
  assert.equal(tables.participations[0]?.attendanceStatus, "cancelled");
  const already = await lookupCancellation._handler(ctx, {
    secret,
    token: TOKEN,
  });
  assert.equal(already.state, "already_cancelled");
});

test("requestCancellation schedules one email and respects the cooldown", async () => {
  const { ctx, scheduled } = fakeCtx({
    participations: [
      {
        _id: "p1",
        editionId: TEST_EDITION_ID,
        email: "ada@example.com",
        fullName: "Ada Lovelace",
        roleId: TEST_HACKER_ROLE_ID,
        status: "applied",
      },
    ],
  });
  await requestCancellation._handler(ctx, {
    email: "ada@example.com",
    secret,
  });
  assert.equal(scheduled.length, 1);
  await requestCancellation._handler(ctx, {
    email: "ada@example.com",
    secret,
  });
  assert.equal(scheduled.length, 1);
});

test("saveBadgePhoto only stores a photo on a confirmed place", async () => {
  const { ctx, tables } = fakeCtx({
    participations: [
      {
        _id: "p1",
        editionId: TEST_EDITION_ID,
        email: "ada@example.com",
        fullName: "Ada Lovelace",
        managementToken: TOKEN,
        roleId: TEST_HACKER_ROLE_ID,
        status: "confirmed",
      },
    ],
  });
  const saved = await saveBadgePhoto._handler(ctx, {
    photo: PHOTO,
    secret,
    token: TOKEN,
  });
  assert.equal(typeof saved.version, "number");
  assert.equal(tables.participations[0]?.badgePhoto, PHOTO);
  await assert.rejects(
    saveBadgePhoto._handler(ctx, {
      photo: "not-a-photo",
      secret,
      token: TOKEN,
    }),
    /Foto inválida/
  );
});

test("findSharedBadge returns a unique confirmed name", async () => {
  const { ctx } = fakeCtx({
    participations: [
      {
        _id: "p1",
        badgePhoto: PHOTO,
        badgePhotoUpdatedAt: 99,
        editionId: TEST_EDITION_ID,
        email: "ada@example.com",
        fullName: "Ada Lovelace",
        githubUsername: "ada",
        roleId: TEST_HACKER_ROLE_ID,
        status: "confirmed",
      },
      {
        _id: "p2",
        editionId: TEST_EDITION_ID,
        email: "other@example.com",
        fullName: "Ada Lovelace",
        githubUsername: "other",
        roleId: TEST_HACKER_ROLE_ID,
        status: "accepted",
      },
    ],
  });
  const badge = await findSharedBadge._handler(ctx, {
    fullName: "Ada Lovelace",
    secret,
  });
  assert.equal(badge?.githubHandle, "ada");
  assert.equal(badge?.photoVersion, 99);
  const byHandle = await findSharedBadge._handler(ctx, {
    fullName: "Ada Lovelace",
    githubHandle: "ada",
    secret,
  });
  assert.equal(byHandle?.githubHandle, "ada");
  const missing = await findSharedBadge._handler(ctx, {
    fullName: "Nobody",
    secret,
  });
  assert.equal(missing, null);
});
