import type { SitemapPage } from "../data/sitemap-pages";

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildSitemapUrlsetXml(
  pages: SitemapPage[],
  _siteOrigin: string
): string {
  const sorted = [...pages].toSorted((a, b) =>
    a.url.localeCompare(b.url, "es", { numeric: true })
  );
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const page of sorted) {
    lines.push("  <url>");
    lines.push(`    <loc>${esc(page.url)}</loc>`);
    lines.push(`    <lastmod>${esc(page.lastmod)}</lastmod>`);
    lines.push("  </url>");
  }
  lines.push("</urlset>");
  return `${lines.join("\n")}\n`;
}
