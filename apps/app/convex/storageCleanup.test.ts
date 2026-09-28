import assert from "node:assert/strict";
import { test } from "node:test";
import type { MutationCtx } from "./_generated/server";
import { sweep } from "./storageCleanup";

const NOW = Date.parse("2026-09-28T12:00:00Z");
const OLD = NOW - 8 * 24 * 60 * 60 * 1000;

function storage(
  files: { _id: string; _creationTime: number }[],
  references: Record<string, string>,
  isDone: boolean
) {
  const deleted: string[] = [];
  const scheduled: unknown[] = [];
  const ctx = {
    db: {
      system: {
        query: (table: string) => {
          assert.equal(table, "_storage");
          return {
            order: (direction: string) => {
              assert.equal(direction, "asc");
              return {
                paginate: async (options: {
                  cursor: string | null;
                  numItems: number;
                }) => {
                  assert.equal(options.numItems, 24);
                  assert.equal(options.cursor, null);
                  return { page: files, continueCursor: "next", isDone };
                },
              };
            },
          };
        },
      },
      query(table: string) {
        return {
          withIndex(
            index: string,
            select: (q: { eq: (field: string, id: string) => void }) => void
          ) {
            let imageId = "";
            select({
              eq: (_field, id) => {
                imageId = id;
              },
            });
            return {
              first: async () =>
                references[`${table}.${index}`] === imageId
                  ? { _id: imageId }
                  : null,
            };
          },
        };
      },
    },
    storage: {
      delete: async (id: string) => {
        deleted.push(id);
      },
    },
    scheduler: {
      runAfter: async (_delay: number, _fn: unknown, args: unknown) => {
        scheduled.push(args);
      },
    },
  } as unknown as MutationCtx;
  return { ctx, deleted, scheduled };
}

test("sweep keeps every referenced image and fresh uploads", async (t) => {
  t.mock.method(Date, "now", () => NOW);
  const { ctx, deleted, scheduled } = storage(
    [
      ...["orphan", "post", "avatar", "thumb", "logo"].map((_id) => ({
        _id,
        _creationTime: OLD,
      })),
      { _id: "fresh", _creationTime: NOW },
    ],
    {
      "posts.by_image": "post",
      "users.by_avatar": "avatar",
      "users.by_avatar_thumb": "thumb",
      "teams.by_logo": "logo",
    },
    false
  );
  await sweep._handler(ctx, {});
  assert.deepEqual(deleted, ["orphan"]);
  assert.deepEqual(scheduled, []);
});

test("sweep schedules the next page when old files remain", async (t) => {
  t.mock.method(Date, "now", () => NOW);
  const { ctx, deleted, scheduled } = storage(
    [{ _id: "orphan", _creationTime: OLD }],
    {},
    false
  );
  await sweep._handler(ctx, {});
  assert.deepEqual(deleted, ["orphan"]);
  assert.deepEqual(scheduled, [{ cursor: "next" }]);
});
