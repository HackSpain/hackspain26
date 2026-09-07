import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { hackathonPreSignups, hackathonSignups } from "../../db/schema";

export const prerender = false;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export const POST: APIRoute = async ({ request }) => {
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim() !==
    "application/json"
  ) {
    return json({ error: "expected_json" }, 415);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const payload = body && typeof body === "object" ? body : null;
  const token =
    payload && "token" in payload
      ? (payload as { token?: unknown }).token
      : null;
  const emailRaw =
    payload && "email" in payload
      ? (payload as { email?: unknown }).email
      : null;
  const validToken =
    typeof token === "string" && UUID_RE.test(token) ? token : null;
  const hasValidToken = validToken !== null;
  const email =
    typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  const hasValidEmail = email.length <= 320 && EMAIL_RE.test(email);
  if (!(hasValidToken || hasValidEmail)) {
    return json({ error: "invalid_lookup" }, 400);
  }

  const db = getDb();
  const [preSignup] = await db
    .select({
      email: hackathonPreSignups.email,
      fullName: hackathonPreSignups.fullName,
      githubUrl: hackathonPreSignups.githubUrl,
      linkedinUrl: hackathonPreSignups.linkedinUrl,
      signupCompletedAt: hackathonPreSignups.signupCompletedAt,
      webUrl: hackathonPreSignups.webUrl,
      xUrl: hackathonPreSignups.xUrl,
    })
    .from(hackathonPreSignups)
    .where(
      validToken === null
        ? eq(hackathonPreSignups.email, email)
        : eq(hackathonPreSignups.signupToken, validToken)
    )
    .limit(1);

  if (!preSignup) {
    return hasValidToken
      ? json({ error: "invalid_invitation" }, 404)
      : json({ data: null });
  }
  if (preSignup.signupCompletedAt) {
    return hasValidToken
      ? json({ error: "invitation_used" }, 410)
      : json({ data: null });
  }

  const [existingSignup] = await db
    .select({ id: hackathonSignups.id })
    .from(hackathonSignups)
    .where(eq(hackathonSignups.email, preSignup.email))
    .limit(1);
  if (existingSignup) {
    return hasValidToken
      ? json({ error: "invitation_used" }, 410)
      : json({ data: null });
  }

  return json({
    data: {
      email: preSignup.email,
      fullName: preSignup.fullName,
      githubUrl: preSignup.githubUrl ?? "",
      linkedinUrl: preSignup.linkedinUrl ?? "",
      webUrl: preSignup.webUrl ?? "",
      xUrl: preSignup.xUrl ?? "",
    },
  });
};
