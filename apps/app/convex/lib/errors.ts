import { ConvexError } from "convex/values";

/**
 * Machine-readable error codes for functions consumed by non-browser clients
 * (the CLI). Existing web-facing functions keep throwing plain `Error` with
 * Spanish copy because the pages render `err.message` directly.
 */
export type ErrorCode =
  | "NOT_FOUND"
  | "NOT_OWNER"
  | "NOT_MEMBER"
  | "NO_TEAM"
  | "ALREADY_IN_TEAM"
  | "BAD_CODE"
  | "VALIDATION";

export type CodedError = { code: ErrorCode; message: string };

export function fail(code: ErrorCode, message: string): never {
  throw new ConvexError<CodedError>({ code, message });
}
