import { ConvexError } from "convex/values";
import { NextResponse } from "next/server";
import { isCodedError } from "@convex/lib/errors";

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

const AUTH_ERROR_MESSAGE = "No has iniciado sesión";
const SERVER_ERROR_MESSAGE = "Server error. Try again later.";

// These CLI-facing functions still throw plain Error because the dashboard
// renders their messages directly. Keep only their known public copy until
// those call sites use coded errors and the dashboard reads the coded message.
const LEGACY_PUBLIC_MESSAGES = new Set([
  "Usuario no encontrado",
  "No hay inscripción a la hackathon con este email",
  "Aún no te han aceptado",
  "Confirma tus datos primero",
  "Se necesita acceso de admin",
  "Se necesita acceso de juez",
  "Se necesita acceso de sponsor",
  "Se necesita acceso al directorio",
  "Could not verify code",
  "Introduce un usuario de GitHub, un handle de X o un email válido",
  "Esa persona ya está en este equipo",
  "Esa persona ya tiene invitación o membresía en otro equipo",
  "Esa persona ya pertenece a otro equipo",
  "El nombre del equipo debe tener al menos 2 caracteres",
  "Ya perteneces a un equipo",
  "Equipo no encontrado",
  "No estás en un equipo",
  "El dueño no puede salir del equipo",
  "Reto no encontrado",
  "Perk de partner no encontrado",
  "Este proyecto ya está enviado",
]);

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
  const body: CliErrorBody = { error: { kind: "error", message }, ok: false };
  return NextResponse.json(body, { status });
}

/** A `{ code, message }` error the CLI explains like a relayed ConvexError. */
export function failCoded(
  code: string,
  message: string,
  status = 400
): NextResponse {
  const body: CliErrorBody = {
    error: { data: { code, message }, kind: "convex" },
    ok: false,
  };
  return NextResponse.json(body, { status });
}

export function fromError(err: unknown): NextResponse {
  if (err instanceof ConvexError && isCodedError(err.data)) {
    const body: CliErrorBody = {
      error: { data: err.data, kind: "convex" },
      ok: false,
    };
    return NextResponse.json(body, { status: 400 });
  }
  const message =
    err instanceof Error ? serverMessage(err.message) : String(err);
  if (UNAUTHENTICATED_NEEDLES.some((needle) => message.includes(needle))) {
    return fail(AUTH_ERROR_MESSAGE, 401);
  }
  if (LEGACY_PUBLIC_MESSAGES.has(message)) {
    return fail(message, 500);
  }
  console.error("CLI API failed:", err);
  return fail(SERVER_ERROR_MESSAGE, 500);
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export async function readJson(
  request: Request
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
