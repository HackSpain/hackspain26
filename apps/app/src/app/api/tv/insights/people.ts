import type { PersonUsageRow } from "./usage";

/** One person on the TV's individual ranking. */
export type PersonRow = {
  /** Convex user id, or `gh:<login>` for a GitHub actor nobody has linked. */
  id: string;
  name: string;
  /** Their HackSpain photo, or the public GitHub avatar of an unlinked login. */
  photoUrl?: string;
  team: string;
  tokens: number;
  pushes: number;
  pullRequests: number;
};

export type ActorRow = {
  login: string;
  teamId: string;
  pushes: number;
  pullRequests: number;
};

export type ResolvedPerson = {
  id: string;
  name: string;
  photoUrl?: string;
  team: string;
  login?: string;
};

function gitActivity(row: { pushes: number; pullRequests: number }): number {
  return row.pushes + row.pullRequests;
}

/** Who needs a name: the top of each metric, never the whole hackathon. */
export function pickPeople(
  usage: PersonUsageRow[],
  actors: ActorRow[],
  limit: number
): { userIds: string[]; logins: string[] } {
  return {
    logins: actors
      .toSorted((a, b) => gitActivity(b) - gitActivity(a) || a.login.localeCompare(b.login))
      .slice(0, limit)
      .map((actor) => actor.login),
    userIds: usage
      .toSorted((a, b) => b.tokens - a.tokens || a.userId.localeCompare(b.userId))
      .slice(0, limit)
      .map((row) => row.userId),
  };
}

/**
 * One row per picked person with both metrics, so somebody who tops the
 * tokens also shows their real pushes and the other way round. A GitHub
 * login no participant has linked keeps its own row under the login.
 */
export function mergePeople(
  usage: PersonUsageRow[],
  actors: ActorRow[],
  resolved: ResolvedPerson[],
  picked: { logins: string[] },
  teams: { id: string; name: string }[]
): PersonRow[] {
  const tokensOf = new Map(usage.map((row) => [row.userId, row.tokens]));
  const actorOf = new Map(actors.map((actor) => [actor.login, actor]));
  const teamName = new Map(teams.map((team) => [team.id, team.name]));
  const linked = new Set<string>();
  const rows: PersonRow[] = [];
  for (const person of resolved) {
    const actor = person.login ? actorOf.get(person.login) : undefined;
    if (person.login) {
      linked.add(person.login);
    }
    rows.push({
      id: person.id,
      name: person.name,
      ...(person.photoUrl ? { photoUrl: person.photoUrl } : {}),
      pullRequests: actor?.pullRequests ?? 0,
      pushes: actor?.pushes ?? 0,
      team: person.team || (actor ? (teamName.get(actor.teamId) ?? "") : ""),
      tokens: tokensOf.get(person.id) ?? 0,
    });
  }
  for (const login of picked.logins) {
    const actor = actorOf.get(login);
    if (!actor || linked.has(login)) {
      continue;
    }
    rows.push({
      id: `gh:${login}`,
      name: login,
      // Bots and renamed accounts answer 404; the screen falls back to initials.
      photoUrl: `https://github.com/${encodeURIComponent(login)}.png?size=128`,
      pullRequests: actor.pullRequests,
      pushes: actor.pushes,
      team: teamName.get(actor.teamId) ?? "",
      tokens: 0,
    });
  }
  return rows.filter((row) => row.tokens > 0 || gitActivity(row) > 0);
}
