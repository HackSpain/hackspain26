import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { MutationCtx } from "./_generated/server";
import { subscribe } from "./hackspain27Emails";
import {
  TEST_EDITION_ID,
  TEST_HACKER_ROLE_ID,
  testEditionRow,
  testHackerRole,
} from "./lib/testFixtures";

const secret = "test-subscribe-secret";
const originalSecret = process.env.SUBSCRIBE_SECRET;
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

function fakeCtx() {
  const tables: Record<string, Record<string, unknown>[]> = {
    editions: [testEditionRow()],
    participations: [],
    userTypes: [testHackerRole()],
    users: [],
  };
  const db = {
    query(table: string) {
      let selected = tables[table] ?? [];
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
      };
      return query;
    },
    async insert(table: string, fields: Record<string, unknown>) {
      const id = `${table}-${(tables[table] ?? []).length + 1}`;
      (tables[table] ??= []).push({ _id: id, ...fields });
      return id;
    },
  };
  return { ctx: { db } as unknown as MutationCtx, tables };
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
