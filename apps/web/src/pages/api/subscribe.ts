import type { APIRoute } from "astro";
import { checkBotId } from "botid/server";
import { envFromRuntime } from "../../lib/runtime-env";
import { isValidEmail } from "../../lib/signup-validation";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.DEV) {
    try {
      const verification = await checkBotId();
      if (verification.isBot) {
        return Response.json({ error: "access_denied" }, { status: 403 });
      }
    } catch (error) {
      console.error("[subscribe] BotID check failed:", error);
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

  const convexUrl = envFromRuntime("CONVEX_URL");
  const secret = envFromRuntime("SUBSCRIBE_SECRET");
  if (!(convexUrl && secret)) {
    console.error("[subscribe] Convex is not configured");
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  try {
    const response = await fetch(`${convexUrl}/api/mutation`, {
      body: JSON.stringify({
        args: { email, secret },
        format: "json",
        path: "hackspain27Emails:subscribe",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });
    const result: unknown = await response.json();
    if (
      !(
        response.ok &&
        result &&
        typeof result === "object" &&
        "status" in result &&
        result.status === "success"
      )
    ) {
      const message =
        result && typeof result === "object" && "errorMessage" in result
          ? result.errorMessage
          : undefined;
      throw new Error(`Convex ${response.status}: ${String(message)}`);
    }
  } catch (error) {
    console.error("[subscribe] Failed to save email:", error);
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
};
