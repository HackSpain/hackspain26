import assert from "node:assert/strict";
import { test } from "node:test";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { resolvePendingInvites } from "./users";

type Row = Record<string, unknown> & { _id: string };

function context(user: Row, invites: Row[]) {
  const tables: Record<string, Row[]> = {
    users: [user],
    teamMembers: invites.map((row) => ({ ...row })),
  };
  const ctx = {
    db: {
      get: async (id: string) =>
        Object.values(tables)
          .flat()
          .find((row) => row._id === id) ?? null,
      patch: async (id: string, fields: Record<string, unknown>) => {
        const row = Object.values(tables)
          .flat()
          .find((entry) => entry._id === id);
        assert.ok(row);
        Object.assign(row, fields);
      },
      delete: async (id: string) => {
        for (const table of Object.keys(tables)) {
          tables[table] = tables[table].filter((row) => row._id !== id);
        }
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

const pendingEmail: Row = {
  _id: "invite-email",
  teamId: "team",
  identifierType: "email",
  identifier: "ada@x.test",
  status: "pending",
  createdAt: 1,
};

const pendingGithub: Row = {
  _id: "invite-github",
  teamId: "team",
  identifierType: "github",
  identifier: "octocat",
  status: "pending",
  createdAt: 1,
};

const pendingTwitter: Row = {
  _id: "invite-twitter",
  teamId: "team",
  identifierType: "twitter",
  identifier: "ada",
  status: "pending",
  createdAt: 1,
};

test("verified email attaches a pending invite", async () => {
  const { ctx, tables } = context(
    {
      _id: "ada",
      email: "ada@x.test",
      emailVerificationTime: 1,
    },
    [pendingEmail]
  );
  await resolvePendingInvites(ctx, "ada" as Id<"users">);
  const row = tables.teamMembers.find((entry) => entry._id === "invite-email");
  assert.equal(row?.status, "member");
  assert.equal(row?.userId, "ada");
});

test("unverified email does not attach a pending invite", async () => {
  const { ctx, tables } = context({ _id: "ada", email: "ada@x.test" }, [
    pendingEmail,
  ]);
  await resolvePendingInvites(ctx, "ada" as Id<"users">);
  const row = tables.teamMembers.find((entry) => entry._id === "invite-email");
  assert.equal(row?.status, "pending");
  assert.equal(row?.userId, undefined);
});

test("OAuth GitHub attaches a pending invite", async () => {
  const { ctx, tables } = context(
    {
      _id: "ada",
      githubUsername: "octocat",
      githubLinkedAt: 1,
    },
    [pendingGithub]
  );
  await resolvePendingInvites(ctx, "ada" as Id<"users">);
  const row = tables.teamMembers.find((entry) => entry._id === "invite-github");
  assert.equal(row?.status, "member");
  assert.equal(row?.userId, "ada");
});

test("a self-declared GitHub handle does not attach a pending invite", async () => {
  const { ctx, tables } = context({ _id: "ada", githubUsername: "octocat" }, [
    pendingGithub,
  ]);
  await resolvePendingInvites(ctx, "ada" as Id<"users">);
  const row = tables.teamMembers.find((entry) => entry._id === "invite-github");
  assert.equal(row?.status, "pending");
  assert.equal(row?.userId, undefined);
});

test("a self-declared X handle does not attach a pending invite", async () => {
  const { ctx, tables } = context({ _id: "ada", twitterHandle: "ada" }, [
    pendingTwitter,
  ]);
  await resolvePendingInvites(ctx, "ada" as Id<"users">);
  const row = tables.teamMembers.find(
    (entry) => entry._id === "invite-twitter"
  );
  assert.equal(row?.status, "pending");
  assert.equal(row?.userId, undefined);
});

test("OAuth X attaches a pending invite", async () => {
  const { ctx, tables } = context(
    {
      _id: "ada",
      twitterHandle: "ada",
      twitterLinkedAt: 1,
    },
    [pendingTwitter]
  );
  await resolvePendingInvites(ctx, "ada" as Id<"users">);
  const row = tables.teamMembers.find(
    (entry) => entry._id === "invite-twitter"
  );
  assert.equal(row?.status, "member");
  assert.equal(row?.userId, "ada");
});
