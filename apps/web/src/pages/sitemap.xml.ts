import type { APIRoute } from "astro";
import { getAllSitemapPages, SITEMAP_SITE_ORIGIN } from "../data/sitemap-pages";
import { buildSitemapUrlsetXml } from "../lib/sitemap-urlset-xml";

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const origin = site?.origin ?? SITEMAP_SITE_ORIGIN;
  const xml = buildSitemapUrlsetXml(getAllSitemapPages(), origin);
  return new Response(xml, {
    headers: {
      // text/xml + charset helps browsers use the XML tree viewer; application/xml alone is often shown as plain text.
      "Content-Type": "text/xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=86400",
    },
  });
};
