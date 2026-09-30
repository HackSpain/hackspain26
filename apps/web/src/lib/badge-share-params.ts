import { isGithubHandle } from "./github-handle";

/**
 * Matches the limit the signup form accepts for a name. The name in the link is
 * what the record is looked up by, so truncating it here would stop long names
 * from ever matching their own signup.
 */
const BADGE_NAME_MAX_LENGTH = 200;

/** The card size every social network crops its link preview from. */
export const OG_BADGE_WIDTH = 1200;
export const OG_BADGE_HEIGHT = 630;

const AT_PREFIX_RE = /^@/;
const CONTROL_CHARS_RE = /[\p{Cc}\p{Cf}]/gu;
const WHITESPACE_RE = /\s+/g;

export interface BadgeShareParams {
  fullName: string;
  githubHandle: string | null;
}

/**
 * `/comparte` is a public page built entirely from its query string: whoever
 * opens a shared link has to see the same badge as the person who shared it,
 * with no lookup and nothing private in the URL.
 */
export function badgeShareParamsFrom(
  searchParams: URLSearchParams
): BadgeShareParams {
  const fullName = (searchParams.get("name") ?? "")
    .replace(CONTROL_CHARS_RE, "")
    .replace(WHITESPACE_RE, " ")
    .trim()
    .slice(0, BADGE_NAME_MAX_LENGTH)
    .trim();

  const handle = (searchParams.get("github") ?? "")
    .trim()
    .replace(AT_PREFIX_RE, "");

  return {
    fullName,
    githubHandle: isGithubHandle(handle) ? handle : null,
  };
}

function badgeShareSearch({
  fullName,
  githubHandle,
}: BadgeShareParams): string {
  const search = new URLSearchParams();
  const printableName = fullName.trim().slice(0, BADGE_NAME_MAX_LENGTH).trim();
  if (printableName) {
    search.set("name", printableName);
  }
  if (githubHandle) {
    search.set("github", githubHandle);
  }
  return search.toString();
}

export function badgeSharePath(params: BadgeShareParams): string {
  const search = badgeShareSearch(params);
  return search ? `/comparte?${search}` : "/comparte";
}

/**
 * Bump this whenever the badge's drawing changes — a colour, a font, a layout.
 *
 * The image is cached for an hour in the browser and a week on the CDN, keyed
 * only by URL. `version` covers a changed photo, but nothing covered a changed
 * design: a redesign kept serving the old picture to every link already shared,
 * and to the person who had just been looking at their own badge.
 */
const BADGE_RENDER_VERSION = 2;

/**
 * The social preview image for a given badge. Kept as a path so the layout can
 * resolve it against the canonical site origin, which is what crawlers need.
 *
 * The image is cached hard by URL, so anything that changes the picture has to
 * change the URL too. Neither `r` nor `version` is read when drawing; both
 * exist only to key the cache.
 */
export function badgeOgImagePath(
  params: BadgeShareParams,
  version?: number | null
): string {
  const search = new URLSearchParams(badgeShareSearch(params));
  search.set("r", String(BADGE_RENDER_VERSION));
  if (version) {
    search.set("v", String(version));
  }
  return `/api/og/badge.png?${search.toString()}`;
}
