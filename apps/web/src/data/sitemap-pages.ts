import type { SectionSlug } from "./section-routes";
import { SECTION_SLUGS } from "./section-routes";
import { areSignupsClosed } from "./signup-deadline";

const TRAILING_SLASHES = /\/+$/;

export const SITEMAP_SITE_ORIGIN = "https://hackspain.com";

export interface SitemapPage {
  /** Last significant content change, YYYY-MM-DD. */
  lastmod: string;
  url: string;
}

// Update a page's date when its visible content changes, not on every deploy:
// search engines stop trusting lastmod values that always move.
const SECTION_LASTMOD: Record<SectionSlug, string> = {
  apuntate: "2026-11-14",
  comunidad: "2026-11-14",
  "gran-premio": "2026-09-30",
  infra: "2026-09-30",
  mentores: "2026-09-30",
  mission: "2026-09-30",
  tracks: "2026-09-30",
};

function normalizeSitemapPageUrl(href: string): string {
  const u = new URL(href);
  if (u.pathname === "/" || u.pathname === "") {
    return u.origin;
  }
  return `${u.origin}${u.pathname.replace(TRAILING_SLASHES, "")}`;
}

/** Every indexable HTML URL (full origin URLs) with its last content change. */
export function getAllSitemapPages(): SitemapPage[] {
  const o = SITEMAP_SITE_ORIGIN;
  const raw: SitemapPage[] = [
    { lastmod: "2026-11-14", url: o },
    ...SECTION_SLUGS.map((s) => ({
      lastmod: SECTION_LASTMOD[s],
      url: `${o}/${s}`,
    })),
    ...(areSignupsClosed()
      ? []
      : [{ lastmod: SECTION_LASTMOD.apuntate, url: `${o}/signup` }]),
    { lastmod: "2026-09-28", url: `${o}/ambassador` },
    { lastmod: "2026-09-30", url: `${o}/brand` },
    { lastmod: "2026-09-29", url: `${o}/cronica` },
    { lastmod: "2026-09-24", url: `${o}/privacy` },
    { lastmod: "2026-09-24", url: `${o}/conduct` },
  ];
  const byUrl = new Map(
    raw.map((page) => {
      const url = normalizeSitemapPageUrl(page.url);
      return [url, { ...page, url }];
    })
  );
  return [...byUrl.values()];
}
