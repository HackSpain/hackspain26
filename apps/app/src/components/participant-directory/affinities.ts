import type { DirectoryParticipant } from "./types";

export const AFFINITY_KINDS = [
  "university",
  "city",
  "company",
  "degree",
  "team",
  "skills",
  "interests",
] as const;
export type AffinityKind = (typeof AFFINITY_KINDS)[number];
export type AffinityFilter = "all" | AffinityKind;

export interface Affinity {
  kind: AffinityKind;
  value: string;
}

export interface Connection {
  participant: DirectoryParticipant;
  affinities: Affinity[];
  categories: number;
}

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .trim()
    .replaceAll(/\s+/g, " ")
    .toLowerCase();
}

export function valuesFor(
  participant: DirectoryParticipant,
  kind: AffinityKind
): string[] {
  switch (kind) {
    case "company": {
      return participant.company ? [participant.company] : [];
    }
    case "degree": {
      return participant.degree ? [participant.degree] : [];
    }
    case "team": {
      return participant.team ? [participant.team.name] : [];
    }
    case "university": {
      return participant.university ? [participant.university] : [];
    }
    case "city": {
      return participant.city ? [participant.city] : [];
    }
    case "skills": {
      return participant.skills;
    }
    case "interests": {
      return participant.interests ?? [];
    }
  }
}

export function sharedAffinities(
  a: DirectoryParticipant,
  b: DirectoryParticipant
): Affinity[] {
  if (a.id === b.id) {
    return [];
  }
  return AFFINITY_KINDS.flatMap<Affinity>((kind) => {
    if (kind === "team") {
      return a.team?.id && a.team.id === b.team?.id
        ? [{ kind, value: a.team.name }]
        : [];
    }
    const other = new Set(valuesFor(b, kind).map(normalize).filter(Boolean));
    const seen = new Set<string>();
    return valuesFor(a, kind)
      .filter((value) => {
        const key = normalize(value);
        if (!key || seen.has(key) || !other.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .map((value) => ({ kind, value }));
  });
}

export function connectionsFor(
  anchor: DirectoryParticipant,
  participants: DirectoryParticipant[],
  filter: AffinityFilter = "all",
  query = ""
): Connection[] {
  const search = normalize(query);
  return participants
    .flatMap((participant) => {
      const affinities = sharedAffinities(anchor, participant).filter(
        (item) => filter === "all" || item.kind === filter
      );
      const searchable = normalize(
        [
          participant.displayName,
          participant.role,
          participant.city,
          participant.university ?? "",
          ...participant.skills,
          ...(participant.interests ?? []),
        ].join(" ")
      );
      if (!affinities.length || (search && !searchable.includes(search))) {
        return [];
      }
      return [
        {
          affinities,
          categories: new Set(affinities.map((item) => item.kind)).size,
          participant,
        },
      ];
    })
    .toSorted(
      (a, b) =>
        b.categories - a.categories ||
        b.affinities.length - a.affinities.length ||
        a.participant.displayName.localeCompare(
          b.participant.displayName,
          "es"
        ) ||
        a.participant.id.localeCompare(b.participant.id)
    );
}
