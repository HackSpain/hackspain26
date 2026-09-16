import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { parseThumbnailWidth } from "@/lib/thumbnail";
import { bearerToken } from "../../cli/_lib/respond";

/**
 * GET /api/files/<storageId>: streams a feed image from Convex storage under
 * our own domain. Feed posts only ever carry this path, so the Convex storage
 * URL never reaches a client. Signed-in browsers use the cookie session, the
 * CLI could use its bearer token; anyone else is sent to log in.
 *
 * `?w=<px>` returns a PNG resized to that width (never enlarged, first frame
 * of an animation). The CLI uses it to draw the picture inline in terminals
 * that speak the Kitty or iTerm2 image protocol, without shipping decoders.
 */
const CACHE_CONTROL = "private, max-age=86400";

async function thumbnail(upstream: Response, width: number) {
  const source = Buffer.from(await upstream.arrayBuffer());
  const png = await sharp(source, { animated: false })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .png()
    .toBuffer();
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "cache-control": CACHE_CONTROL,
      "content-length": String(png.byteLength),
      "content-type": "image/png",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
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
      { token }
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
  const width = parseThumbnailWidth(
    new URL(request.url).searchParams.get("w")
  );
  if (width !== null) {
    try {
      return await thumbnail(upstream, width);
    } catch {
      return new NextResponse("Cannot resize this image", { status: 415 });
    }
  }
  const headers = new Headers({
    "content-type":
      upstream.headers.get("content-type") ?? "application/octet-stream",
    // Storage ids are immutable, so a signed-in browser can keep this a day.
    "cache-control": CACHE_CONTROL,
    "x-content-type-options": "nosniff",
  });
  const length = upstream.headers.get("content-length");
  if (length) {
    headers.set("content-length", length);
  }
  return new NextResponse(upstream.body, { headers });
}
