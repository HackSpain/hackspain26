import assert from "node:assert/strict";
import { test } from "node:test";
import type { QueryCtx } from "./_generated/server";
import { list } from "./teams";

type Row = Record<string, unknown> & { _id: string };

function directory() {
  const tables: Record<string, Row[]> = {
    users: [
      { _id: "operator", role: "admin" },
      { _id: "u1", name: "Owner" },
      { _id: "u2" },
      { _id: "u3", name: "" },
    ],
    signups: [
      { _id: "s1", fullName: "Old name" },
      { _id: "s2", fullName: "Signup name" },
      { _id: "s3", fullName: "Should not replace empty name" },
    ],
    teams: [
      { _id: "t1", name: "Zeta", ownerId: "u1" },
      { _id: "t2", name: "Alfa", ownerId: "u3" },
    ],
    teamMembers: [
      { _id: "m2", teamId: "t1", userId: "u2", signupId: "s2", status: "member", identifier: "fallback" },
      { _id: "m1", teamId: "t1", userId: "u1", signupId: "s1", status: "member", identifier: "fallback" },
      { _id: "m3", teamId: "t2", userId: "u3", signupId: "s3", status: "member", identifier: "fallback" },
      { _id: "m4", teamId: "t2", status: "member", identifier: "Identifier name" },
      { _id: "pending", teamId: "t1", userId: "operator", status: "pending", identifier: "private" },
    ],
    submissions: [
      { _id: "sub1", teamId: "t1", name: " Project ", status: "draft", challengeIds: ["track", "deleted-track"] },
      { _id: "sub2", teamId: "t2", name: "", status: "submitted", challengeIds: ["track", "deleted-track"] },
    ],
    tracks: [{ _id: "track", label: "Shared", slug: "shared" }],
  };
  const reads: string[] = [];
  let authenticated = true;
  const ctx = {
    auth: { getUserIdentity: async () => authenticated ? { subject: "operator" } : null },
    db: {
      get: async (id: string) => {
        reads.push(id);
        return Object.values(tables).flat().find((row) => row._id === id) ?? null;
      },
      query(table: string) {
        let rows = tables[table] ?? [];
        const query = {
          withIndex(_index: string, select: (q: { eq: (key: string, value: unknown) => unknown }) => void) {
            const range = { eq(key: string, value: unknown) { rows = rows.filter((row) => row[key] === value); return range; } };
            select(range);
            return query;
          },
          collect: async () => rows,
          first: async () => rows[0] ?? null,
          unique: async () => rows[0] ?? null,
        };
        return query;
      },
    },
  } as unknown as QueryCtx;
  return { ctx, tables, reads, anonymous: () => { authenticated = false; } };
}

test("team directory reuses shared tracks and only reads signup names when needed", async () => {
  const { ctx, reads } = directory();
  const result = await list._handler(ctx, {});
  assert.deepEqual(result.map((team) => team.name), ["Alfa", "Zeta"]);
  const [alfa, zeta] = result;
  assert.deepEqual(zeta.members.map((member) => member.name), ["Owner", "Signup name"]);
  assert.deepEqual(alfa.members.map((member) => member.name), ["", "Identifier name"]);
  assert.equal(zeta.members[0].isOwner, true);
  assert.equal(zeta.memberCount, 2);
  assert.equal(zeta.pendingCount, 1);
  assert.equal(zeta.projectName, "Project");
  assert.equal(alfa.projectName, undefined);
  assert.equal(zeta.submissionStatus, "draft");
  assert.deepEqual(alfa.tracks, [{ label: "Shared", logoUrl: undefined, slug: "shared" }]);
  assert.deepEqual(zeta.tracks, alfa.tracks);
  assert.equal(reads.filter((id) => id === "track").length, 1);
  assert.equal(reads.filter((id) => id === "deleted-track").length, 1);
  assert.equal(reads.filter((id) => id === "s2").length, 1);
  assert.ok(!reads.includes("s1") && !reads.includes("s3"));
});

test("track reuse stays local to one invocation and authorization is unchanged", async () => {
  const { ctx, tables, anonymous } = directory();
  await list._handler(ctx, {});
  tables.tracks[0].label = "Updated";
  assert.equal((await list._handler(ctx, {}))[0].tracks[0].label, "Updated");
  anonymous();
  await assert.rejects(list._handler(ctx, {}), /sesión/);
});
