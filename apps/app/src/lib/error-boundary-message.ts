import { ConvexError } from "convex/values";

const FALLBACK = "Ha ocurrido un error inesperado.";

// These codes come from convex/lib/errors.ts via fail(), which creates
// user-facing domain errors. Other exceptions may contain internal details.
const USER_FACING_CODES: ReadonlySet<string> = new Set([
  "NOT_FOUND",
  "NOT_OWNER",
  "NOT_MEMBER",
  "NO_TEAM",
  "ALREADY_IN_TEAM",
  "BAD_CODE",
  "EVENT_CLOSED",
  "TRACK_FULL",
  "VALIDATION",
  "UNREGISTERED",
  "BAD_OTP",
  "OTP_EXPIRED",
  "TOO_MANY_ATTEMPTS",
  "SEND_FAILED",
  "SCREEN_LIMIT",
]);

export function errorBoundaryMessage(error: unknown): string {
  if (!(error instanceof ConvexError) || ("digest" in error && error.digest)) {
    return FALLBACK;
  }

  const data: unknown = error.data;
  if (
    typeof data !== "object" ||
    data === null ||
    !("code" in data) ||
    !("message" in data)
  ) {
    return FALLBACK;
  }

  const { code, message } = data;
  if (
    typeof code !== "string" ||
    !USER_FACING_CODES.has(code) ||
    typeof message !== "string" ||
    !message.trim()
  ) {
    return FALLBACK;
  }

  return message.trim();
}
