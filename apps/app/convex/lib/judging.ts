import type { Id } from "../_generated/dataModel";
import type { JudgingContext } from "./validators";

export const JUDGING_SETTINGS_KEY = "judging";
export const DEFAULT_GENERAL_GROUP_COUNT = 3;
export const MIN_GENERAL_GROUPS = 1;
export const MAX_GENERAL_GROUPS = 8;

export function contextKey(context: JudgingContext): {
  kind: "general" | "track";
  key: string;
} {
  if (context.kind === "general") {
    return { kind: "general", key: String(context.group) };
  }
  return { kind: "track", key: context.trackId };
}

export function assignmentFromRow(row: {
  contextKind?: "general" | "track";
  contextKey?: string;
  group?: number;
}): JudgingContext | null {
  if (row.contextKind === "general") {
    const group =
      row.contextKey !== undefined ? Number(row.contextKey) : row.group;
    if (group !== undefined && Number.isInteger(group) && group >= 1) {
      return { kind: "general", group };
    }
  }
  if (row.contextKind === "track" && row.contextKey) {
    return { kind: "track", trackId: row.contextKey as Id<"tracks"> };
  }
  if (row.group !== undefined && Number.isInteger(row.group) && row.group >= 1) {
    return { kind: "general", group: row.group };
  }
  return null;
}

export function countGroups(
  submissions: { generalGroup?: number }[],
  groupCount: number
): Map<number, number> {
  const counts = new Map<number, number>();
  for (let group = 1; group <= groupCount; group += 1) {
    counts.set(group, 0);
  }
  for (const submission of submissions) {
    const group = submission.generalGroup;
    if (group === undefined || group < 1 || group > groupCount) {
      continue;
    }
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  return counts;
}

/** Lowest current occupancy; ties go to the smallest group number. */
export function pickBalancedGroup(
  countsByGroup: ReadonlyMap<number, number>,
  groupCount: number
): number {
  let chosen = 1;
  let lowest = Number.POSITIVE_INFINITY;
  for (let group = 1; group <= groupCount; group += 1) {
    const count = countsByGroup.get(group) ?? 0;
    if (count < lowest) {
      lowest = count;
      chosen = group;
    }
  }
  return chosen;
}

export function visibleGeneralGroups(
  groupCount: number,
  storedGroups: Iterable<number>
): number[] {
  const groups = new Set<number>();
  for (let group = 1; group <= groupCount; group += 1) {
    groups.add(group);
  }
  for (const group of storedGroups) {
    if (Number.isInteger(group) && group >= 1) {
      groups.add(group);
    }
  }
  return [...groups].toSorted((a, b) => a - b);
}

export function submissionInContext(
  submission: {
    challengeIds: Id<"tracks">[];
    generalGroup?: number;
  },
  context: JudgingContext
): boolean {
  if (context.kind === "track") {
    return submission.challengeIds.includes(context.trackId);
  }
  return submission.generalGroup === context.group;
}

export function assertScore(score: number): void {
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    throw new Error("La puntuación debe ser un entero entre 1 y 10");
  }
}

export function assertGroupCount(count: number): void {
  if (
    !Number.isInteger(count) ||
    count < MIN_GENERAL_GROUPS ||
    count > MAX_GENERAL_GROUPS
  ) {
    throw new Error(
      `El número de grupos generales debe ser un entero entre ${MIN_GENERAL_GROUPS} y ${MAX_GENERAL_GROUPS}`
    );
  }
}

export function assertGeneralGroup(group: number, maxGroup: number): void {
  if (!Number.isInteger(group) || group < 1 || group > maxGroup) {
    throw new Error("Ese grupo general no existe");
  }
}

export function compareRanking(
  a: { average: number | null; name: string },
  b: { average: number | null; name: string }
): number {
  const aScored = a.average !== null;
  const bScored = b.average !== null;
  if (aScored !== bScored) {
    return aScored ? -1 : 1;
  }
  if (a.average !== null && b.average !== null && a.average !== b.average) {
    return b.average - a.average;
  }
  return a.name.localeCompare(b.name, "es");
}

export function assignRanks<T extends { average: number | null }>(
  items: T[]
): (T & { rank: number | null })[] {
  let next = 1;
  return items.map((item) => {
    if (item.average === null) {
      return { ...item, rank: null };
    }
    const rank = next;
    next += 1;
    return { ...item, rank };
  });
}
