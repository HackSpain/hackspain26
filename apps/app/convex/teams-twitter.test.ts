import assert from "node:assert/strict";
import { test } from "node:test";
import type { MutationCtx } from "./_generated/server";
import { testEditionRow, withCurrentEdition } from "./lib/testFixtures";
import { create, join } from "./teams";

function context(twitterHandle = "hacker") {
  const tables: Record<string, Record<string, unknown>[]> = {
    users: [
      { _id: "operator", role: "admin", twitterHandle },
      { _id: "hacker", twitterHandle: "invited" },
      {
        _id: "xoauth",
        twitterHandle: "linkedx",
        twitterLinkedAt: 1,
      },
      {
        _id: "linked",
        githubUsername: "octocat",
        githubLinkedAt: 1,
      },
      { _id: "typed", githubUsername: "impostor" },
      {
        _id: "mailed",
        email: "ada@x.test",
        emailVerificationTime: 1,
      },
    ],
    editions: [testEditionRow()],
    participations: [],
    teams: [
      withCurrentEdition({
        _id: "team",
        ownerId: "other",
        joinCode: "ABCDEFGH",
      }),
    ],
    teamMembers: [
      withCurrentEdition({
        _id: "pending",
        teamId: "other",
        identifierType: "twitter",
        identifier: "hacker",
        status: "pending",
      }),
      withCurrentEdition({
        _id: "unrelated",
        teamId: "other",
        identifierType: "twitter",
        identifier: "someone",
        status: "pending",
      }),
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

test("X invitations stay pending; a self-declared handle does not join the team", async () => {
  const { ctx, tables } = context();
  const teamId = await create._handler(ctx, {
    name: "New team",
    members: [{ identifierType: "twitter", identifier: "@Invited" }],
  });
  assert.ok(
    tables.teamMembers.some(
      (row) =>
        row.teamId === teamId &&
        row.identifierType === "twitter" &&
        row.identifier === "invited" &&
        row.status === "pending" &&
        row.userId === undefined
    )
  );
});

test("X invitations join only an OAuth-linked account", async () => {
  const { ctx, tables } = context();
  const teamId = await create._handler(ctx, {
    name: "Linked X",
    members: [{ identifierType: "twitter", identifier: "@LinkedX" }],
  });
  assert.ok(
    tables.teamMembers.some(
      (row) =>
        row.teamId === teamId &&
        row.userId === "xoauth" &&
        row.status === "member"
    )
  );
});

test("GitHub invitations join only an OAuth-linked account", async () => {
  const { ctx, tables } = context();
  const teamId = await create._handler(ctx, {
    name: "Linked",
    members: [{ identifierType: "github", identifier: "Octocat" }],
  });
  assert.ok(
    tables.teamMembers.some(
      (row) =>
        row.teamId === teamId &&
        row.userId === "linked" &&
        row.status === "member"
    )
  );
});

test("a self-declared GitHub handle stays a pending invitation", async () => {
  const { ctx, tables } = context();
  const teamId = await create._handler(ctx, {
    name: "Typed",
    members: [{ identifierType: "github", identifier: "impostor" }],
  });
  assert.ok(
    tables.teamMembers.some(
      (row) =>
        row.teamId === teamId &&
        row.identifier === "impostor" &&
        row.status === "pending" &&
        row.userId === undefined
    )
  );
});

test("email invitations join a verified account", async () => {
  const { ctx, tables } = context();
  const teamId = await create._handler(ctx, {
    name: "Mail",
    members: [{ identifierType: "email", identifier: "Ada@x.test" }],
  });
  assert.ok(
    tables.teamMembers.some(
      (row) =>
        row.teamId === teamId &&
        row.userId === "mailed" &&
        row.status === "member"
    )
  );
});
