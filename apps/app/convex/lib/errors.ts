import { ConvexError } from "convex/values";

/**
 * Machine-readable error codes for functions consumed by non-browser clients
 * (the CLI). Existing web-facing functions keep throwing plain `Error` with
 * Spanish copy because the pages render `err.message` directly.
 */
export const ERROR_CODES = [
  "NOT_FOUND",
  "NOT_OWNER",
  "NOT_MEMBER",
  "NO_TEAM",
  "ALREADY_IN_TEAM",
  "BAD_CODE",
  "EVENT_CLOSED",
  "TRACK_FULL",
  "VALIDATION",
  // Email OTP login (convex/login.ts, convex/auth.ts). The login page and the
  // CLI both branch on these instead of parsing the library's messages.
  "UNREGISTERED",
  "BAD_OTP",
  "OTP_EXPIRED",
  "TOO_MANY_ATTEMPTS",
  "SEND_FAILED",
  // Public TV heartbeat (convex/tvPlayback.ts); /api/tv maps it to 429.
  "SCREEN_LIMIT",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type CodedError = { code: ErrorCode; message: string };

const ERROR_CODE_SET: ReadonlySet<string> = new Set(ERROR_CODES);

export function isCodedError(value: unknown): value is CodedError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof value.code === "string" &&
    ERROR_CODE_SET.has(value.code) &&
    "message" in value &&
    typeof value.message === "string" &&
    value.message.length > 0
  );
}

export function fail(code: ErrorCode, message: string): never {
  throw new ConvexError<CodedError>({ code, message });
}
