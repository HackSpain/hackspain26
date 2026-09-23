import assert from "node:assert/strict";
import { test } from "node:test";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { isTrackCombinationAllowed, seedDefaults, trackEntryCounts } from "./tracks";

function ctxWith(submissions: { _id: string; challengeIds: string[] }[]) {
  return {
    db: { query: () => ({ collect: async () => submissions }) },
  } as unknown as QueryCtx;
}

test("counts one place per project per track, drafts included", async () => {
  const counts = await trackEntryCounts(
    ctxWith([
      { _id: "s1", challengeIds: ["maisa", "embat"] },
      { _id: "s2", challengeIds: ["maisa", "maisa"] },
      { _id: "s3", challengeIds: [] },
    ])
  );
  assert.deepEqual(Object.fromEntries(counts), { embat: 1, maisa: 2 });
});

test("leaves out the project that is asking for a place", async () => {
  const counts = await trackEntryCounts(
    ctxWith([
      { _id: "s1", challengeIds: ["maisa"] },
      { _id: "s2", challengeIds: ["maisa"] },
    ]),
    "s2" as never
  );
  assert.equal(counts.get("maisa" as never), 1);
});

test("allows one track or THEKER together with one other track", () => {
  assert.equal(isTrackCombinationAllowed([]), true);
  assert.equal(isTrackCombinationAllowed([{ slug: "maisa" }]), true);
  assert.equal(
    isTrackCombinationAllowed([{ slug: "maisa" }, { slug: "theker" }]),
    true
  );
});

test("rejects two regular tracks and every three-track combination", () => {
  assert.equal(
    isTrackCombinationAllowed([{ slug: "maisa" }, { slug: "embat" }]),
    false
  );
  assert.equal(
    isTrackCombinationAllowed([
      { slug: "maisa" },
      { slug: "embat" },
      { slug: "theker" },
    ]),
    false
  );
});

type CatalogRow = { _id: string; slug: string; active: boolean; label: string };

function catalogWith(rows: CatalogRow[]) {
  const patches: [string, Record<string, unknown>][] = [];
  const inserts: Record<string, unknown>[] = [];
  const ctx = {
    db: {
      query(table: string) {
        return {
          withIndex(_name: string, filter: (q: { eq: (key: string, value: unknown) => unknown }) => void) {
            let key = "";
            let value: unknown;
            const range = { eq(k: string, v: unknown) { key = k; value = v; return range; } };
            filter(range);
            return {
              unique: async () => {
                if (table === "settings") { return { _id: "settings", key: value }; }
                return rows.find((row) => (row as Record<string, unknown>)[key] === value) ?? null;
              },
            };
          },
        };
      },
      patch: async (id: string, fields: Record<string, unknown>) => { patches.push([id, fields]); },
      insert: async (_table: string, doc: Record<string, unknown>) => { inserts.push(doc); return `new-${inserts.length}`; },
    },
  } as unknown as MutationCtx;
  return { ctx, inserts, patches };
}

test("fill mode inserts the missing defaults and leaves admin edits alone", async () => {
  const edited = { _id: "t1", active: false, label: "Maisa (renamed by admin)", slug: "maisa" };
  const { ctx, inserts, patches } = catalogWith([edited]);
  await seedDefaults(ctx, "fill");
  assert.equal(patches.length, 0);
  assert.equal(inserts.length, 4);
  assert.ok(!inserts.some((doc) => doc.slug === "maisa"));
});

test("replace mode rewrites the defaults, including activity", async () => {
  const edited = { _id: "t1", active: false, label: "Maisa (renamed by admin)", slug: "maisa" };
  const { ctx, patches } = catalogWith([edited]);
  await seedDefaults(ctx, "replace");
  const [id, fields] = patches.find(([target]) => target === "t1") ?? [];
  assert.equal(id, "t1");
  assert.equal(fields?.active, true);
  assert.equal(fields?.label, "Maisa");
});

test("fill mode still retires the placeholder slugs", async () => {
  const { ctx, patches } = catalogWith([{ _id: "old", active: true, label: "ML", slug: "ml" }]);
  await seedDefaults(ctx, "fill");
  assert.deepEqual(patches, [["old", { active: false }]]);
});
