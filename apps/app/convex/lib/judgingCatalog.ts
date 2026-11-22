import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { grantsJudging } from "./userTypes";

type DbCtx = QueryCtx | MutationCtx;

export type Catalog = {
  membersByTeam: Map<Id<"teams">, string[]>;
  perksById: Map<Id<"perks">, Doc<"perks">>;
  submitted: Doc<"submissions">[];
  teamsById: Map<Id<"teams">, Doc<"teams">>;
  tracksById: Map<Id<"tracks">, Doc<"tracks">>;
  usersById: Map<Id<"users">, Doc<"users">>;
};

export async function loadJudgePool(
  ctx: DbCtx,
  editionId: Id<"editions">
): Promise<Doc<"users">[]> {
  const [types, participations] = await Promise.all([
    ctx.db.query("userTypes").collect(),
    ctx.db
      .query("participations")
      .withIndex("by_edition", (q) => q.eq("editionId", editionId))
      .collect(),
  ]);
  const judgingTypeIds = new Set(
    types
      .filter((type) => grantsJudging({ role: "user" }, type))
      .map((type) => type._id)
  );
  const pool = new Map<Id<"users">, Doc<"users">>();
  for (const row of participations) {
    if (!row.userId || !judgingTypeIds.has(row.roleId)) {
      continue;
    }
    const user = await ctx.db.get(row.userId);
    if (user && user.role !== "admin") {
      pool.set(user._id, user);
    }
  }
  return [...pool.values()].toSorted((a, b) => a._id.localeCompare(b._id));
}

export async function loadCatalog(
  ctx: DbCtx,
  editionId: Id<"editions">
): Promise<Catalog> {
  const [submissions, tracks, teams, perks, members, users] = await Promise.all(
    [
      ctx.db
        .query("submissions")
        .withIndex("by_edition", (q) => q.eq("editionId", editionId))
        .collect(),
      ctx.db
        .query("tracks")
        .withIndex("by_edition", (q) => q.eq("editionId", editionId))
        .collect(),
      ctx.db
        .query("teams")
        .withIndex("by_edition", (q) => q.eq("editionId", editionId))
        .collect(),
      ctx.db
        .query("perks")
        .withIndex("by_edition", (q) => q.eq("editionId", editionId))
        .collect(),
      ctx.db
        .query("teamMembers")
        .withIndex("by_edition", (q) => q.eq("editionId", editionId))
        .collect(),
      ctx.db.query("users").collect(),
    ]
  );
  const usersById = new Map(users.map((user) => [user._id, user]));
  const membersByTeam = new Map<Id<"teams">, string[]>();
  for (const member of members) {
    if (member.status !== "member") {
      continue;
    }
    const userName = member.userId
      ? usersById.get(member.userId)?.name?.trim()
      : undefined;
    const list = membersByTeam.get(member.teamId) ?? [];
    list.push(userName || member.identifier);
    membersByTeam.set(member.teamId, list);
  }
  return {
    membersByTeam,
    perksById: new Map(perks.map((perk) => [perk._id, perk])),
    submitted: submissions
      .filter((row) => row.status === "submitted")
      .toSorted((a, b) => a._id.localeCompare(b._id)),
    teamsById: new Map(teams.map((team) => [team._id, team])),
    tracksById: new Map(tracks.map((track) => [track._id, track])),
    usersById,
  };
}
