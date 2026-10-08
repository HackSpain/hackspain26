import assert from "node:assert/strict";
import { test } from "node:test";
import type { MutationCtx } from "./_generated/server";
import { create, join } from "./teams";

function context(twitterHandle = "hacker") {
  const tables: Record<string, Record<string, unknown>[]> = {
    users: [
      { _id: "operator", role: "admin", twitterHandle },
      { _id: "hacker", twitterHandle: "invited" },
    ],
    teams: [{ _id: "team", ownerId: "other", joinCode: "ABCDEFGH" }],
    teamMembers: [
      {
        _id: "pending",
        teamId: "other",
        identifierType: "twitter",
        identifier: "hacker",
        status: "pending",
      },
      {
        _id: "unrelated",
        teamId: "other",
        identifierType: "twitter",
        identifier: "someone",
        status: "pending",
      },
    ],
  };
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: "operator" }) },
    db: {
      get: async (id: string) =>
        Object.values(tables)
          .flat()
          .find((row) => row._id === id) ?? null,
      patch: async () => {},
      delete: async (id: string) => {
        for (const table of Object.keys(tables)) {
          tables[table] = tables[table].filter((row) => row._id !== id);
        }
      },
      insert: async (table: string, row: Record<string, unknown>) => {
        const id = `${table}-${tables[table]?.length ?? 0}`;
        (tables[table] ??= []).push({ ...row, _id: id });
        return id;
      },
      query(table: string) {
        let selected = tables[table] ?? [];
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
  } as unknown as MutationCtx;
  return { ctx, tables };
}

test("joining clears the user's normalized X invitation and preserves other invitations", async () => {
  const { ctx, tables } = context("@Hacker");
  await join._handler(ctx, { code: "ABCDEFGH" });
  assert.ok(!tables.teamMembers.some((row) => row._id === "pending"));
  assert.ok(tables.teamMembers.some((row) => row._id === "unrelated"));
  assert.ok(
    tables.teamMembers.some(
      (row) => row.userId === "operator" && row.teamId === "team"
    )
  );
});

test("X invitations resolve registered users even without a signup X handle", async () => {
  const { ctx, tables } = context();
  const teamId = await create._handler(ctx, {
    name: "New team",
    members: [{ identifierType: "twitter", identifier: "@Invited" }],
  });
  assert.ok(
    tables.teamMembers.some(
      (row) =>
        row.teamId === teamId &&
        row.userId === "hacker" &&
        row.status === "member"
    )
  );
});
