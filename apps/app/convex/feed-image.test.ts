import assert from "node:assert/strict";
import { test } from "node:test";
import type { MutationCtx } from "./_generated/server";
import { post } from "./feed";

function context(size: number, contentType = "image/png") {
  const inserted: unknown[] = [];
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: "author" }) },
    db: {
      get: async () => ({ _id: "author", role: "admin" }),
      system: { get: async () => ({ size, contentType }) },
      query: () => ({ withIndex: () => ({ first: async () => null }) }),
      insert: async (_table: string, row: unknown) => {
        inserted.push(row);
        return "post";
      },
    },
  } as unknown as MutationCtx;
  return { ctx, inserted };
}

test("feed accepts the existing 5 MB client limit and rejects larger uploads before insertion", async () => {
  const allowed = context(5 * 1024 * 1024);
  await post._handler(allowed.ctx, { text: "", imageId: "image" as never });
  assert.equal(allowed.inserted.length, 1);
  const oversized = context(5 * 1024 * 1024 + 1);
  await assert.rejects(
    post._handler(oversized.ctx, { text: "", imageId: "image" as never }),
    /5 MB/
  );
  assert.deepEqual(oversized.inserted, []);
  const nonImage = context(10, "text/plain");
  await assert.rejects(
    post._handler(nonImage.ctx, { text: "", imageId: "image" as never }),
    /imágenes/
  );
  assert.deepEqual(nonImage.inserted, []);
});
