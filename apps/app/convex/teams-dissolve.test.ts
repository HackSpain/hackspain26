import assert from "node:assert/strict";
import { test } from "node:test";
import type { MutationCtx } from "./_generated/server";
import { dissolve } from "./teams";

function context(logoId?: string, submitted = false) {
  const deletedFiles: string[] = [];
  const deletedRows: string[] = [];
  const rows: Record<string, Record<string, unknown>[]> = {
    users: [{ _id: "owner", role: "admin" }],
    teams: [{ _id: "team", ownerId: "owner", logoId }],
    teamMembers: [
      { _id: "member", userId: "owner", teamId: "team", status: "member" },
    ],
    submissions: submitted
      ? [{ _id: "project", teamId: "team", status: "submitted" }]
      : [],
  };
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: "owner" }) },
    db: {
      get: async (id: string) =>
        Object.values(rows)
          .flat()
          .find((row) => row._id === id) ?? null,
      delete: async (id: string) => {
        deletedRows.push(id);
      },
      query(table: string) {
        let selected = rows[table] ?? [];
        const query = {
          withIndex(
            _index: string,
            select: (q: {
              eq: (key: string, value: unknown) => unknown;
            }) => void
          ) {
            const range = {
              eq(key: string, value: unknown) {
                selected = selected.filter((row) => row[key] === value);
                return range;
              },
            };
            select(range);
            return query;
          },
          first: async () => selected[0] ?? null,
          unique: async () => selected[0] ?? null,
          collect: async () => selected,
        };
        return query;
      },
    },
    storage: {
      delete: async (id: string) => {
        deletedFiles.push(id);
      },
    },
  } as unknown as MutationCtx;
  return { ctx, deletedFiles, deletedRows };
}

test("dissolving a team deletes its stored logo, and also works without one", async () => {
  for (const logo of ["logo", undefined]) {
    const { ctx, deletedFiles, deletedRows } = context(logo);
    await dissolve._handler(ctx, {});
    assert.deepEqual(deletedFiles, logo ? [logo] : []);
    assert.ok(deletedRows.includes("team"));
  }
});

test("a submitted project blocks dissolution before the logo is deleted", async () => {
  const { ctx, deletedFiles, deletedRows } = context("logo", true);
  await assert.rejects(dissolve._handler(ctx, {}), /enviado/);
  assert.deepEqual(deletedFiles, []);
  assert.deepEqual(deletedRows, []);
});
