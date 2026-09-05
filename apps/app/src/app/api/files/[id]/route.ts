import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { bearerToken } from "../../cli/_lib/respond";

/**
 * GET /api/files/<storageId>: streams a feed image from Convex storage under
 * our own domain. Feed posts only ever carry this path, so the Convex storage
 * URL never reaches a client. Signed-in browsers use the cookie session, the
 * CLI could use its bearer token; anyone else is sent to log in.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const token = bearerToken(request) ?? (await convexAuthNextjsToken());
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const { id } = await context.params;
  let url: string | null;
  try {
    url = await fetchQuery(
      api.feed.imageUrl,
      { imageId: id as Id<"_storage"> },
      { token },
    );
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!url) {
    return new NextResponse("Not found", { status: 404 });
  }
  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Unavailable", { status: 502 });
  }
  const headers = new Headers({
    "content-type":
      upstream.headers.get("content-type") ?? "application/octet-stream",
    // Storage ids are immutable, so a signed-in browser can keep this a day.
    "cache-control": "private, max-age=86400",
    "x-content-type-options": "nosniff",
  });
  const length = upstream.headers.get("content-length");
  if (length) {
    headers.set("content-length", length);
  }
  return new NextResponse(upstream.body, { headers });
}
