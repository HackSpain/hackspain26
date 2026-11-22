import { captureException, captureMessage, withScope } from "@sentry/astro";
import type { APIRoute } from "astro";
import { checkBotId } from "botid/server";
import {
  applyParticipation,
  isLandingRequestError,
} from "../../lib/convex-landing";
import {
  DIETARY_RESTRICTION_OPTIONS,
  parseSignupBody,
} from "../../lib/signup-validation";

export const prerender = false;

function safeSentry(report: () => void): void {
  try {
    report();
  } catch (error) {
    console.error("[apply] Sentry reporting failed:", error);
  }
}

function dietaryLabel(ids: string[]): string | undefined {
  if (ids.length === 0) {
    return;
  }
  const labels = ids.map(
    (id) =>
      DIETARY_RESTRICTION_OPTIONS.find((option) => option.id === id)?.label ??
      id
  );
  return labels.join(", ");
}

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.DEV) {
    try {
      const verification = await checkBotId();
      if (verification.isBot) {
        return Response.json({ error: "access_denied" }, { status: 403 });
      }
    } catch (error) {
      safeSentry(() => {
        withScope((scope) => {
          scope.setTag("api", "apply");
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
    return Response.json({ error: "expected_json" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const roleSlug =
    "roleSlug" in body && typeof body.roleSlug === "string"
      ? body.roleSlug.trim().toLowerCase()
      : "";
  if (!roleSlug) {
    return Response.json({ error: "role_required" }, { status: 400 });
  }

  const parsed = parseSignupBody(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: parsed.status });
  }

  try {
    await applyParticipation({
      achievements: parsed.data.achievements,
      ambassadorMotivation: parsed.data.ambassadorMotivation,
      ambassadorStudyWhere: parsed.data.studyInstitution,
      dietaryDetails: parsed.data.dietaryDetails,
      dietaryRestrictions: dietaryLabel(parsed.data.dietaryRestrictions),
      email: parsed.data.email,
      freeTime: parsed.data.freeTime,
      fullName: parsed.data.fullName,
      githubUrl: parsed.data.githubUrl,
      linkedinUrl: parsed.data.linkedinUrl,
      roleSlug,
      wantsAmbassador: parsed.data.wantsAmbassador,
      webUrl: parsed.data.webUrl,
      xUrl: parsed.data.xUrl,
    });
  } catch (error) {
    console.error("[apply] Failed to save application:", error);
    if (isLandingRequestError(error)) {
      return Response.json({ error: error.error }, { status: error.status });
    }
    safeSentry(() => {
      withScope((scope) => {
        scope.setTag("api", "apply");
        scope.setTag("outcome", "save_failed");
        captureMessage("POST /api/apply: persistence failed", "error");
      });
    });
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
};
