import assert from "node:assert/strict";
import { test } from "node:test";
import type { QueryCtx } from "./_generated/server";
import { isTrackCombinationAllowed, trackEntryCounts } from "./tracks";

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
