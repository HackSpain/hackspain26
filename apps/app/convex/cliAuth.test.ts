import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { MutationCtx } from "./_generated/server";
import { start } from "./cliAuth";
import {
  START_LIMIT_PER_IP,
  START_WINDOW_MS,
  signStart,
  startIdentityKey,
} from "./lib/cliAuthStart";

const bridgeSecret = "test-bridge-secret-with-at-least-32-characters";
const originalBridgeSecret = process.env.CLI_AUTH_BRIDGE_SECRET;
before(() => {
  process.env.CLI_AUTH_BRIDGE_SECRET = bridgeSecret;
});
after(() => {
  if (originalBridgeSecret === undefined) {
    delete process.env.CLI_AUTH_BRIDGE_SECRET;
  } else {
    process.env.CLI_AUTH_BRIDGE_SECRET = originalBridgeSecret;
  }
});

type Row = Record<string, unknown> & { _id: string };

function fakeCtx() {
  const tables: Record<string, Row[]> = {
    cliAuthStartLimits: [],
    cliAuthRequests: [],
  };
  let nextId = 0;
  const db = {
    query(table: string) {
      return {
        withIndex(
          _index: string,
          filter: (q: Record<string, unknown>) => void
        ) {
          let field = "";
          let value: unknown;
          let operation = "";
          const range = {
            eq(name: string, target: unknown) {
              field = name;
              value = target;
              operation = "eq";
              return range;
            },
            lt(name: string, target: unknown) {
              field = name;
              value = target;
              operation = "lt";
              return range;
            },
          };
          filter(range);
          const rows = () =>
            tables[table].filter((row) =>
              operation === "eq"
                ? row[field] === value
                : (row[field] as number) < (value as number)
            );
          return {
            unique: async () => rows()[0] ?? null,
            take: async (limit: number) => rows().slice(0, limit),
          };
        },
      };
    },
    async insert(table: string, fields: Record<string, unknown>) {
      const id = `row-${++nextId}`;
      tables[table].push({ _id: id, ...fields });
      return id;
    },
    async patch(id: string, fields: Record<string, unknown>) {
      const row = Object.values(tables)
        .flat()
        .find((entry) => entry._id === id);
      assert.ok(row);
      Object.assign(row, fields);
    },
    async delete(id: string) {
      for (const rows of Object.values(tables)) {
        const index = rows.findIndex((row) => row._id === id);
        if (index !== -1) {
          rows.splice(index, 1);
        }
      }
    },
  };
  return { ctx: { db } as unknown as MutationCtx, tables };
}

function signedArgs(
  ip: string,
  secret = "a".repeat(32),
  issuedAt = Date.now()
) {
  const identityKey = startIdentityKey(bridgeSecret, ip);
  return {
    secret,
    identityKey,
    issuedAt,
    signature: signStart(bridgeSecret, secret, identityKey, issuedAt),
  };
}

test("device login refuses unsigned, tampered and stale direct Convex calls", async () => {
  const { ctx, tables } = fakeCtx();
  const args = signedArgs("203.0.113.10");
  await assert.rejects(
    start._handler(ctx, { ...args, signature: "0".repeat(64) }),
    /no autorizada/
  );
  await assert.rejects(
    start._handler(ctx, { ...args, secret: "b".repeat(32) }),
    /no autorizada/
  );
  await assert.rejects(
    start._handler(
      ctx,
      signedArgs("203.0.113.10", args.secret, Date.now() - 3 * 60_000)
    ),
    /no autorizada/
  );
  assert.equal(tables.cliAuthRequests.length, 0);
  assert.equal(tables.cliAuthStartLimits.length, 0);
});

test("device login fails closed when Convex has no bridge secret", async () => {
  const { ctx, tables } = fakeCtx();
  const args = signedArgs("203.0.113.10");
  delete process.env.CLI_AUTH_BRIDGE_SECRET;
  try {
    await assert.rejects(start._handler(ctx, args), /not configured/);
  } finally {
    process.env.CLI_AUTH_BRIDGE_SECRET = bridgeSecret;
  }
  assert.equal(tables.cliAuthRequests.length, 0);
  assert.equal(tables.cliAuthStartLimits.length, 0);
});

test("device login counts starts per signed IP and resets its window", async () => {
  const { ctx, tables } = fakeCtx();
  const args = signedArgs("203.0.113.10");
  for (let i = 0; i < START_LIMIT_PER_IP; i++) {
    await start._handler(ctx, args);
  }
  await assert.rejects(start._handler(ctx, args), /Demasiados inicios/);
  assert.equal(tables.cliAuthRequests.length, START_LIMIT_PER_IP);
  assert.equal(tables.cliAuthStartLimits[0].count, START_LIMIT_PER_IP);

  await start._handler(ctx, signedArgs("203.0.113.11"));
  assert.equal(tables.cliAuthRequests.length, START_LIMIT_PER_IP + 1);

  tables.cliAuthStartLimits[0].windowStartedAt = Date.now() - START_WINDOW_MS;
  await start._handler(ctx, args);
  assert.equal(tables.cliAuthStartLimits[0].count, 1);
});
