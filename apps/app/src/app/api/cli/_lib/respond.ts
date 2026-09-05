import { ConvexError } from "convex/values";
import { NextResponse } from "next/server";

/**
 * Wire format shared with apps/cli/src/lib/api.ts:
 *   { ok: true, value }
 *   { ok: false, error: { kind: "convex", data } }      ConvexError from a function
 *   { ok: false, error: { kind: "error", message } }    anything else
 * Status: 200, 400 (bad request / ConvexError), 401 (no or rejected session),
 * 404 (unknown function), 500 (unexpected).
 */
export type CliErrorBody =
  | { ok: false; error: { kind: "convex"; data: unknown } }
  | { ok: false; error: { kind: "error"; message: string } };

const UNAUTHENTICATED_NEEDLES = [
  "No has iniciado sesión",
  "Unauthenticated",
  "Could not verify token",
  "Invalid token",
];

const UNCAUGHT_PATTERN = /Uncaught (?:Convex)?Error: ([^\n]*)/;
const REQUEST_ID_PREFIX = /^\[Request ID: [^\]]+\] Server Error:?\s*/;

/** Strip Convex's request-id wrapper so the CLI shows the real message. */
export function serverMessage(raw: string): string {
  let message = raw.replace(REQUEST_ID_PREFIX, "").trim();
  for (;;) {
    const match = UNCAUGHT_PATTERN.exec(message);
    if (!match?.[1]) {
      return message;
    }
    message = match[1].trim();
  }
}

export function ok<T>(value: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, value }, { status });
}

export function fail(message: string, status: number): NextResponse {
  const body: CliErrorBody = { ok: false, error: { kind: "error", message } };
  return NextResponse.json(body, { status });
}

export function fromError(err: unknown): NextResponse {
  if (err instanceof ConvexError) {
    const body: CliErrorBody = { ok: false, error: { kind: "convex", data: err.data } };
    return NextResponse.json(body, { status: 400 });
  }
  const message = err instanceof Error ? serverMessage(err.message) : String(err);
  const status = UNAUTHENTICATED_NEEDLES.some((needle) => message.includes(needle))
    ? 401
    : 500;
  return fail(message, status);
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
