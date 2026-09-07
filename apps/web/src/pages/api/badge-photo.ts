import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { hackathonSignups } from "../../db/schema";
import {
  BADGE_PHOTO_MAX_LENGTH,
  isValidBadgePhoto,
} from "../../lib/badge-photo";

export const prerender = false;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    headers: RESPONSE_HEADERS,
    status,
  });
}

/**
 * Stores the photo someone put on their own badge, so the social image for their
 * shared link prints it instead of their GitHub avatar.
 *
 * The private management token is the authorisation: it only ever reaches the
 * person whose place it confirms, and it scopes the write to their own row.
 */
export const POST: APIRoute = async ({ request }) => {
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim() !==
    "application/json"
  ) {
    return json({ error: "expected_json" }, 415);
  }

  if (Number(request.headers.get("content-length")) > BADGE_PHOTO_MAX_LENGTH) {
    return json({ error: "photo_too_large" }, 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const payload = body && typeof body === "object" ? body : null;
  const token = (payload as { token?: unknown })?.token;
  const photo = (payload as { photo?: unknown })?.photo;

  if (typeof token !== "string" || !UUID_RE.test(token)) {
    return json({ error: "invalid_token" }, 400);
  }

  if (!isValidBadgePhoto(photo)) {
    return json({ error: "invalid_photo" }, 400);
  }

  // Scoped to a confirmed place, matching what earns a badge in the first place.
  const [updated] = await getDb()
    .update(hackathonSignups)
    .set({ badgePhoto: photo, badgePhotoUpdatedAt: new Date() })
    .where(
      and(
        eq(hackathonSignups.managementToken, token),
        eq(hackathonSignups.approvalStatus, "confirmed")
      )
    )
    .returning({ updatedAt: hackathonSignups.badgePhotoUpdatedAt });

  if (!updated) {
    return json({ error: "not_found" }, 404);
  }

  return json({ version: updated.updatedAt?.getTime() ?? null });
};
