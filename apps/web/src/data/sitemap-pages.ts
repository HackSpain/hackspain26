import { SECTION_SLUGS } from "./section-routes";
import { areSignupsClosed } from "./signup-deadline";

const TRAILING_SLASHES = /\/+$/;

export const SITEMAP_SITE_ORIGIN = "https://hackspain.com";

function normalizeSitemapPageUrl(href: string): string {
  const u = new URL(href);
  if (u.pathname === "/" || u.pathname === "") {
    return u.origin;
  }
  return `${u.origin}${u.pathname.replace(TRAILING_SLASHES, "")}`;
}

/** Every indexable HTML URL (full origin URLs). */
export function getAllSitemapPageUrls(): string[] {
  const o = SITEMAP_SITE_ORIGIN;
  const raw = [
    o,
    ...SECTION_SLUGS.map((s) => `${o}/${s}`),
    ...(areSignupsClosed() ? [] : [`${o}/signup`]),
    `${o}/ambassador`,
    `${o}/brand`,
    `${o}/2026-insights`,
    `${o}/privacy`,
    `${o}/conduct`,
  ];
  return [...new Set(raw.map(normalizeSitemapPageUrl))];
}
