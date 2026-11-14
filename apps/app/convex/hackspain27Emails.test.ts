import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { MutationCtx } from "./_generated/server";
import { subscribe } from "./hackspain27Emails";

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
  const rows: { _id: string; email: string }[] = [];
  const db = {
    query() {
      return {
        withIndex(
          _index: string,
          filter: (q: { eq: (field: string, value: string) => void }) => void
        ) {
          let email = "";
          filter({
            eq(_field, value) {
              email = value;
            },
          });
          return {
            unique: async () => rows.find((row) => row.email === email) ?? null,
          };
        },
      };
    },
    async insert(_table: string, fields: { email: string }) {
      const id = `row-${rows.length + 1}`;
      rows.push({ _id: id, ...fields });
      return id;
    },
  };
  return { ctx: { db } as unknown as MutationCtx, rows };
}

test("subscribe refuses calls without the landing's secret", async () => {
  const { ctx, rows } = fakeCtx();
  await assert.rejects(
    subscribe._handler(ctx, { email: "ada@example.com", secret: "wrong" }),
    /Unauthorized/
  );
  assert.equal(rows.length, 0);
});

test("subscribe stores each normalized email once", async () => {
  const { ctx, rows } = fakeCtx();
  await subscribe._handler(ctx, { email: " Ada@Example.com ", secret });
  await subscribe._handler(ctx, { email: "ada@example.com", secret });
  assert.deepEqual(
    rows.map((row) => row.email),
    ["ada@example.com"]
  );
  await assert.rejects(
    subscribe._handler(ctx, { email: "not-an-email", secret }),
    /Email inválido/
  );
});
