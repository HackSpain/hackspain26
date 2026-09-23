import type { APIRoute } from "astro";
import designBody from "../data/design.md?raw";

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(designBody, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
