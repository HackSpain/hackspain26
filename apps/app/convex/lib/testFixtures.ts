/** Shared rows for Convex unit tests that now require a current edition. */

export const TEST_EDITION_ID = "edition-current";
export const TEST_HACKER_ROLE_ID = "role-hacker";

export function testEditionRow(
  extra: Record<string, unknown> = {}
): Record<string, unknown> & { _id: string } {
  return {
    _id: TEST_EDITION_ID,
    current: true,
    label: "HackSpain 2027",
    slug: "2027",
    applicationsMode: "open",
    submissionsOpen: false,
    ...extra,
  };
}

export function testHackerRole(
  extra: Record<string, unknown> = {}
): Record<string, unknown> & { _id: string } {
  return {
    _id: TEST_HACKER_ROLE_ID,
    isDefault: true,
    label: "Hacker",
    openForApplications: true,
    requiresConfirmed: true,
    sections: ["teams", "tracks", "perks"],
    slug: "hacker",
    sortOrder: 0,
    ...extra,
  };
}

export function withCurrentEdition<T extends Record<string, unknown>>(
  row: T
): T & { editionId: string } {
  return { ...row, editionId: TEST_EDITION_ID };
}
