import { api } from "@convex/_generated/api";
import { fetchAction } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { NextResponse } from "next/server";
import { reportServerEvent } from "@/lib/server-observability";
import { serverMessage } from "../../cli/_lib/respond";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Wire format read by src/app/login/page.tsx:
 *   { ok: true }
 *   { ok: false, code: LoginErrorCode }
 * The page maps `code` to copy; the status is informational.
 */
export type LoginErrorCode =
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
  // Browser challenges are enforced by Vercel's managed firewall rules.
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
      await reportServerEvent(
        "warn",
        "Convex Auth did not start an email sign-in"
      );
      return refuse("SEND_FAILED", 502);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    await reportServerEvent("warn", "Login code email failed", {
      reason: describe(error),
    });
    return refuse("SEND_FAILED", 502);
  }
}
