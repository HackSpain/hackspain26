import { captureException, captureMessage, withScope } from "@sentry/astro";
import type { APIRoute } from "astro";
import { checkBotId } from "botid/server";
import { getDb } from "../../db";
import { mentorSponsorSignups } from "../../db/schema";
import {
  formatAttendanceSlots,
  parseMentorSponsorBody,
} from "../../lib/mentor-sponsor-validation";
import { sendMentorSponsorConfirmationEmail } from "../../lib/signup-confirmation-email";

export const prerender = false;

/** Sentry must never break request handling if the SDK misbehaves. */
function safeSentry(report: () => void): void {
  try {
    report();
  } catch (error) {
    console.error("[mentor-sponsor-signup] Sentry reporting failed:", error);
  }
}

function emptyToNull(s: string): string | null {
  return s.length === 0 ? null : s;
}

/** Drizzle wraps Postgres/Neon errors; `23505` unique violation lives on `cause`. */
function isPostgresUniqueViolation(e: unknown): boolean {
  const seen = new Set<unknown>();
  let cur: unknown = e;
  for (
    let depth = 0;
    depth < 14 && cur !== null && cur !== undefined;
    depth++
  ) {
    if (seen.has(cur)) {
      break;
    }
    seen.add(cur);
    if (
      typeof cur === "object" &&
      cur !== null &&
      "code" in cur &&
      (cur as { code: unknown }).code === "23505"
    ) {
      return true;
    }
    if (cur instanceof Error && cur.cause !== null && cur.cause !== undefined) {
      cur = cur.cause;
      continue;
    }
    if (typeof cur === "object" && cur !== null && "cause" in cur) {
      const next = (cur as { cause: unknown }).cause;
      if (next === null || next === undefined) {
        break;
      }
      cur = next;
      continue;
    }
    break;
  }
  return false;
}

export const POST: APIRoute = async ({ request }) => {
  // `vercel.json` Bot Protection rewrites only run on Vercel / `vercel dev`, not `astro dev`.
  // Without them, client scripts 404 and BotID checks misbehave; skip locally.
  if (!import.meta.env.DEV) {
    try {
      const verification = await checkBotId();
      if (verification.isBot) {
        safeSentry(() => {
          withScope((scope) => {
            scope.setTag("api", "mentor-sponsor-signup");
            scope.setTag("outcome", "access_denied");
            scope.setContext("mentor-sponsor-signup", { reason: "botid" });
            captureMessage(
              "POST /api/mentor-sponsor-signup blocked (BotID)",
              "warning"
            );
          });
        });
        return Response.json({ error: "access_denied" }, { status: 403 });
      }
    } catch (error) {
      safeSentry(() => {
        withScope((scope) => {
          scope.setTag("api", "mentor-sponsor-signup");
          scope.setTag("outcome", "botid_check_failed");
          captureException(error);
        });
      });
      console.error("BotID check failed:", error);
    }
  }

  if (
    request.headers.get("content-type")?.split(";")[0]?.trim() !==
    "application/json"
  ) {
    safeSentry(() => {
      withScope((scope) => {
        scope.setTag("api", "mentor-sponsor-signup");
        scope.setTag("outcome", "expected_json");
        captureMessage(
          "POST /api/mentor-sponsor-signup: wrong Content-Type",
          "warning"
        );
      });
    });
    return Response.json({ error: "expected_json" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    safeSentry(() => {
      withScope((scope) => {
        scope.setTag("api", "mentor-sponsor-signup");
        scope.setTag("outcome", "invalid_json");
        captureMessage(
          "POST /api/mentor-sponsor-signup: body is not valid JSON",
          "warning"
        );
      });
    });
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    safeSentry(() => {
      withScope((scope) => {
        scope.setTag("api", "mentor-sponsor-signup");
        scope.setTag("outcome", "invalid_body");
        captureMessage(
          "POST /api/mentor-sponsor-signup: body missing or not object",
          "warning"
        );
      });
    });
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = parseMentorSponsorBody(body);
  if (!parsed.ok) {
    safeSentry(() => {
      withScope((scope) => {
        scope.setTag("api", "mentor-sponsor-signup");
        scope.setTag("outcome", "validation");
        scope.setContext("details", {
          error: parsed.error,
          status: parsed.status,
        });
        captureMessage(
          "POST /api/mentor-sponsor-signup: validation failed",
          "warning"
        );
      });
    });
    return Response.json({ error: parsed.error }, { status: parsed.status });
  }

  const {
    firstName,
    lastName,
    email,
    company,
    attendanceSlots,
    dietaryRestrictions,
    dietaryDetails,
    dietaryDataConsent,
    notes,
  } = parsed.data;

  const hasDietaryData =
    dietaryRestrictions.length > 0 || dietaryDetails.length > 0;
  const signupId = crypto.randomUUID();

  try {
    const db = getDb();
    try {
      // `role` is deliberately not set here: it is assigned by hand in the DB.
      await db.insert(mentorSponsorSignups).values({
        attendanceSlots,
        company,
        dietaryConsentAt:
          hasDietaryData && dietaryDataConsent ? new Date() : null,
        dietaryDetails: emptyToNull(dietaryDetails),
        dietaryRestrictions,
        email,
        firstName,
        id: signupId,
        lastName,
        notes: emptyToNull(notes),
      });
    } catch (error: unknown) {
      if (isPostgresUniqueViolation(error)) {
        return Response.json({ error: "duplicate_email" }, { status: 409 });
      }
      throw error;
    }
  } catch {
    console.error("[mentor-sponsor-signup] Failed to save signup");
    safeSentry(() => {
      withScope((scope) => {
        scope.setTag("api", "mentor-sponsor-signup");
        scope.setTag("outcome", "save_failed");
        captureMessage(
          "POST /api/mentor-sponsor-signup: persistence failed",
          "error"
        );
      });
    });
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  try {
    const emailResult = await sendMentorSponsorConfirmationEmail({
      attendanceLines: formatAttendanceSlots(attendanceSlots),
      email,
      firstName,
      signupId,
    });
    if (!emailResult.ok && emailResult.reason === "send_failed") {
      safeSentry(() => {
        withScope((scope) => {
          scope.setTag("api", "mentor-sponsor-signup");
          scope.setTag("outcome", "confirmation_email_failed");
          captureMessage(
            "POST /api/mentor-sponsor-signup: confirmation email failed",
            "warning"
          );
        });
      });
    }
  } catch {
    console.error(
      "[mentor-sponsor-signup] Confirmation email failed after successful insert"
    );
    safeSentry(() => {
      withScope((scope) => {
        scope.setTag("api", "mentor-sponsor-signup");
        scope.setTag("outcome", "confirmation_email_exception");
        captureMessage(
          "POST /api/mentor-sponsor-signup: confirmation email failed",
          "warning"
        );
      });
    });
  }

  return Response.json({ ok: true });
};
