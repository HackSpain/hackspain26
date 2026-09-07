export const SECTION_SLUGS = [
  "mission",
  "tracks",
  "gran-premio",
  "mentores",
  "apuntate",
] as const;
type SectionSlug = (typeof SECTION_SLUGS)[number];

/** Section index of the tracks page (index 0 is the hero, so slugs start at 1). */
export const TRACKS_SECTION_INDEX = SECTION_SLUGS.indexOf("tracks") + 1;

/** Section index of the grand prize page, which follows tracks. */
export const GRAND_PRIZE_SECTION_INDEX =
  SECTION_SLUGS.indexOf("gran-premio") + 1;

/** Section index of the comida, bebida y charlas page, after the grand prize. */
export const MENTORS_SECTION_INDEX = SECTION_SLUGS.indexOf("mentores") + 1;

const TRAILING_SLASH_PATH = /\/$/;

export function pathRootFromSectionIndex(index: number): string {
  if (index <= 0) {
    return "/";
  }
  const slug = SECTION_SLUGS[index - 1];
  return slug ? `/${slug}` : "/";
}

export function parsePath(pathname: string): { sectionIndex: number } {
  const clean = (pathname.replace(TRAILING_SLASH_PATH, "") || "/").slice(1);
  const parts = clean.split("/").filter(Boolean);
  if (parts.length === 0) {
    return { sectionIndex: 0 };
  }
  const i = SECTION_SLUGS.indexOf(parts[0] as SectionSlug);
  if (i !== -1 && parts.length === 1) {
    return { sectionIndex: i + 1 };
  }
  return { sectionIndex: 0 };
}
