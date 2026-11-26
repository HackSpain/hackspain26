import { captureMessage, withScope } from "@sentry/astro";
import type { APIRoute } from "astro";
import { checkBotId } from "botid/server";

export const prerender = false;

/** Sentry must never break request handling if the SDK misbehaves. */
function safeSentry(report: () => void): void {
  try {
    report();
  } catch (error) {
    console.error("[signup] Sentry reporting failed:", error);
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.DEV) {
    try {
      const verification = await checkBotId();
      if (verification.isBot) {
        return Response.json({ error: "access_denied" }, { status: 403 });
      }
    } catch (error) {
      console.error("BotID check failed:", error);
    }
  }

  if (
    request.headers.get("content-type")?.split(";")[0]?.trim() !==
    "application/json"
  ) {
    return Response.json({ error: "expected_json" }, { status: 415 });
  }

  try {
    await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  safeSentry(() => {
    withScope((scope) => {
      scope.setTag("api", "signup");
      scope.setTag("outcome", "signups_closed");
      captureMessage("POST /api/signup after the deadline", "info");
    });
  });
  return Response.json({ error: "signups_closed" }, { status: 410 });
};
