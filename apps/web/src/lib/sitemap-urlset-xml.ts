function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildSitemapUrlsetXml(
  pageUrls: string[],
  _siteOrigin: string
): string {
  const urls = [...pageUrls].toSorted((a, b) =>
    a.localeCompare(b, "es", { numeric: true })
  );
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const url of urls) {
    lines.push("  <url>");
    lines.push(`    <loc>${esc(url)}</loc>`);
    lines.push("  </url>");
  }
  lines.push("</urlset>");
  return `${lines.join("\n")}\n`;
}
