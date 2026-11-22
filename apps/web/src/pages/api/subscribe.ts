import type { APIRoute } from "astro";
import { checkBotId } from "botid/server";
import { isDisposableEmailDomain } from "disposable-email-domains-js";
import {
  isLandingRequestError,
  subscribeEmail,
} from "../../lib/convex-landing";
import { isValidEmail } from "../../lib/signup-validation";

export const prerender = false;

/** The blocklist matches exact domains; also catch `x.mailinator.com`. */
function isDisposable(email: string): boolean {
  const labels = email.slice(email.lastIndexOf("@") + 1).split(".");
  return labels
    .slice(0, -1)
    .some((_, index) => isDisposableEmailDomain(labels.slice(index).join(".")));
}

export const POST: APIRoute = async ({ request }) => {
  // An open sign-up list must not accept writes it could not verify.
  if (!import.meta.env.DEV) {
    let verification: Awaited<ReturnType<typeof checkBotId>>;
    try {
      verification = await checkBotId();
    } catch (error) {
      console.error("[subscribe] BotID check failed:", error);
      return Response.json({ error: "verification_failed" }, { status: 503 });
    }
    if (!verification.isHuman) {
      return Response.json({ error: "access_denied" }, { status: 403 });
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
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const email =
    body &&
    typeof body === "object" &&
    "email" in body &&
    typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
  if (!isValidEmail(email)) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }
  if (isDisposable(email)) {
    return Response.json({ error: "disposable_email" }, { status: 400 });
  }

  try {
    await subscribeEmail(email);
  } catch (error) {
    console.error("[subscribe] Failed to save email:", error);
    if (isLandingRequestError(error)) {
      return Response.json({ error: error.error }, { status: error.status });
    }
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
};
