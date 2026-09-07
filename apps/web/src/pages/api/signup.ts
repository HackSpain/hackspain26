import { captureException, captureMessage, withScope } from "@sentry/astro";
import type { APIRoute } from "astro";
import { checkBotId } from "botid/server";
import { eq } from "drizzle-orm";
import { areSignupsClosed } from "../../data/signup-deadline";
import { getDb } from "../../db";
import { hackathonPreSignups, hackathonSignups } from "../../db/schema";
import { sendSignupConfirmationEmail } from "../../lib/signup-confirmation-email";
import { hasValidSignupAccessKey } from "../../lib/signup-late-access";
import { parseSignupBody } from "../../lib/signup-validation";

export const prerender = false;

/** Sentry must never break request handling if the SDK misbehaves. */
function safeSentry(report: () => void): void {
  try {
    report();
  } catch (error) {
    console.error("[signup] Sentry reporting failed:", error);
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
            scope.setTag("api", "signup");
            scope.setTag("outcome", "access_denied");
            scope.setContext("signup", { reason: "botid" });
            captureMessage("POST /api/signup blocked (BotID)", "warning");
          });
        });
        return Response.json({ error: "access_denied" }, { status: 403 });
      }
    } catch (error) {
      safeSentry(() => {
        withScope((scope) => {
          scope.setTag("api", "signup");
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
        scope.setTag("api", "signup");
        scope.setTag("outcome", "expected_json");
        captureMessage("POST /api/signup: wrong Content-Type", "warning");
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
        scope.setTag("api", "signup");
        scope.setTag("outcome", "invalid_json");
        captureMessage("POST /api/signup: body is not valid JSON", "warning");
      });
    });
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    safeSentry(() => {
      withScope((scope) => {
        scope.setTag("api", "signup");
        scope.setTag("outcome", "invalid_body");
        captureMessage(
          "POST /api/signup: body missing or not object",
          "warning"
        );
      });
    });
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  // Public signups are closed. A known query key can still submit; those
  // applications are reviewed by hand the same as everyone else.
  if (
    areSignupsClosed() &&
    !hasValidSignupAccessKey(
      "signupAccessKey" in body ? body.signupAccessKey : ""
    )
  ) {
    safeSentry(() => {
      withScope((scope) => {
        scope.setTag("api", "signup");
        scope.setTag("outcome", "signups_closed");
        captureMessage("POST /api/signup after the deadline", "info");
      });
    });
    return Response.json({ error: "signups_closed" }, { status: 410 });
  }

  const parsed = parseSignupBody(body);
  if (!parsed.ok) {
    safeSentry(() => {
      withScope((scope) => {
        scope.setTag("api", "signup");
        scope.setTag("outcome", "validation");
        scope.setContext("details", {
          error: parsed.error,
          status: parsed.status,
        });
        captureMessage("POST /api/signup: validation failed", "warning");
      });
    });
    return Response.json({ error: parsed.error }, { status: parsed.status });
  }

  const {
    fullName,
    email,
    xUrl,
    linkedinUrl,
    githubUrl,
    webUrl,
    achievements,
    freeTime,
    dietaryRestrictions,
    dietaryDetails,
    dietaryDataConsent,
    occupationStatuses,
    studyInstitution,
    employer,
    wantsAmbassador,
    ambassadorMotivation,
    heardFrom,
    referralCode,
    invitationToken,
  } = parsed.data;

  const motivationDb = wantsAmbassador
    ? emptyToNull(ambassadorMotivation)
    : null;
  const hasDietaryData =
    dietaryRestrictions.length > 0 || dietaryDetails.length > 0;

  let relatedPreSignupId: string | null = null;
  let relatedPreSignupReferralCode: string | null = null;
  const signupId = crypto.randomUUID();

  try {
    const db = getDb();

    if (invitationToken) {
      const [preSignup] = await db
        .select({
          email: hackathonPreSignups.email,
          id: hackathonPreSignups.id,
          referralCode: hackathonPreSignups.referralCode,
          signupCompletedAt: hackathonPreSignups.signupCompletedAt,
        })
        .from(hackathonPreSignups)
        .where(eq(hackathonPreSignups.signupToken, invitationToken))
        .limit(1);
      if (!preSignup) {
        return Response.json({ error: "invalid_invitation" }, { status: 400 });
      }
      if (preSignup.signupCompletedAt) {
        return Response.json({ error: "invitation_used" }, { status: 409 });
      }
      if (preSignup.email !== email) {
        return Response.json(
          { error: "invitation_email_mismatch" },
          { status: 400 }
        );
      }
      relatedPreSignupId = preSignup.id;
      relatedPreSignupReferralCode = preSignup.referralCode;
    } else {
      const [preSignup] = await db
        .select({
          id: hackathonPreSignups.id,
          referralCode: hackathonPreSignups.referralCode,
        })
        .from(hackathonPreSignups)
        .where(eq(hackathonPreSignups.email, email))
        .limit(1);
      relatedPreSignupId = preSignup?.id ?? null;
      relatedPreSignupReferralCode = preSignup?.referralCode ?? null;
    }

    try {
      await db.insert(hackathonSignups).values({
        achievements: emptyToNull(achievements),
        ambassadorMotivation: motivationDb,
        cameFromPreSignup: relatedPreSignupId !== null,
        dietaryConsentAt:
          hasDietaryData && dietaryDataConsent ? new Date() : null,
        dietaryDetails: emptyToNull(dietaryDetails),
        dietaryRestrictions,
        email,
        employer: emptyToNull(employer),
        freeTime: emptyToNull(freeTime),
        fullName,
        githubUrl: emptyToNull(githubUrl),
        heardFrom,
        id: signupId,
        linkedinUrl: emptyToNull(linkedinUrl),
        occupationStatuses,
        referralCode: emptyToNull(
          referralCode || relatedPreSignupReferralCode || ""
        ),
        studyInstitution: emptyToNull(studyInstitution),
        wantsAmbassador,
        webUrl: emptyToNull(webUrl),
        xUrl: emptyToNull(xUrl),
      });
    } catch (error: unknown) {
      if (isPostgresUniqueViolation(error)) {
        return Response.json({ error: "duplicate_email" }, { status: 409 });
      }
      throw error;
    }
  } catch {
    console.error("[signup] Failed to save application");
    safeSentry(() => {
      withScope((scope) => {
        scope.setTag("api", "signup");
        scope.setTag("outcome", "save_failed");
        captureMessage("POST /api/signup: persistence failed", "error");
      });
    });
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  if (relatedPreSignupId) {
    try {
      const db = getDb();
      await db
        .update(hackathonPreSignups)
        .set({ signupCompletedAt: new Date() })
        .where(eq(hackathonPreSignups.id, relatedPreSignupId));
    } catch {
      console.error("[signup] Failed to mark pre-signup as completed");
      safeSentry(() => {
        withScope((scope) => {
          scope.setTag("api", "signup");
          scope.setTag("outcome", "pre_signup_completion_mark_failed");
          captureMessage(
            "POST /api/signup: pre-signup completion update failed",
            "error"
          );
        });
      });
    }
  }

  try {
    const emailResult = await sendSignupConfirmationEmail({
      email,
      fullName,
      signupId,
      wantsAmbassador,
    });
    if (!emailResult.ok && emailResult.reason === "send_failed") {
      safeSentry(() => {
        withScope((scope) => {
          scope.setTag("api", "signup");
          scope.setTag("outcome", "confirmation_email_failed");
          captureMessage(
            "POST /api/signup: confirmation email failed",
            "warning"
          );
        });
      });
    }
  } catch {
    console.error("[signup] Confirmation email failed after successful insert");
    safeSentry(() => {
      withScope((scope) => {
        scope.setTag("api", "signup");
        scope.setTag("outcome", "confirmation_email_exception");
        captureMessage(
          "POST /api/signup: confirmation email failed",
          "warning"
        );
      });
    });
  }

  return Response.json({ ok: true });
};
