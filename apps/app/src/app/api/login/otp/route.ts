import { api } from "@convex/_generated/api";
import { checkBotId } from "botid/server";
import { fetchAction } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { NextResponse } from "next/server";
import { serverMessage } from "../../cli/_lib/respond";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Wire format read by src/app/login/page.tsx:
 *   { ok: true }
 *   { ok: false, code: LoginErrorCode }
 * The page maps `code` to copy; the status is informational.
 */
export type LoginErrorCode =
  | "BOT"
  | "INVALID_EMAIL"
  | "UNREGISTERED"
  | "SEND_FAILED";

function refuse(code: LoginErrorCode, status: number): NextResponse {
  return NextResponse.json({ code, ok: false }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** One line per failure, no stack, no recipient: enough to spot a broken key or quota. */
function describe(error: unknown): string {
  if (error instanceof ConvexError && isRecord(error.data)) {
    return `${String(error.data.code)}: ${String(error.data.message)}`;
  }
  return error instanceof Error ? serverMessage(error.message) : String(error);
}

export async function POST(request: Request) {
  try {
    const verification = await checkBotId();
    if (verification.isBot) {
      return refuse("BOT", 403);
    }
  } catch (error) {
    console.warn(`[login] BotID check failed, letting the request through: ${describe(error)}`);
  }

  let email = "";
  try {
    const body: unknown = await request.json();
    if (isRecord(body) && typeof body.email === "string") {
      email = body.email.trim().toLowerCase();
    }
  } catch {
    return refuse("INVALID_EMAIL", 400);
  }

  if (!EMAIL_PATTERN.test(email)) {
    return refuse("INVALID_EMAIL", 400);
  }

  try {
    const result = await fetchAction(api.auth.signIn, {
      params: { email },
      provider: "resend-otp",
    });
    if (result.reason === "UNREGISTERED") {
      return refuse("UNREGISTERED", 404);
    }
    if (!result.started) {
      console.warn("[login] Convex Auth did not start an email sign-in");
      return refuse("SEND_FAILED", 502);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.warn(`[login] code email failed: ${describe(error)}`);
    return refuse("SEND_FAILED", 502);
  }
}
