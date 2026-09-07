import { api } from "@convex/_generated/api";
import { RawTreeError } from "@rawtree/sdk";
import { fetchQuery } from "convex/nextjs";
import { bearerToken, fail, fromError, ok } from "../_lib/respond";
import {
  parseTelemetryEvent,
  RawTreeConfigurationError,
  storeTelemetryEvents,
  TELEMETRY_BATCH_MAX,
  TELEMETRY_EVENT_MAX_BYTES,
} from "./rawtree";

const MAX_BODY_BYTES = 5 * 1024 * 1024;

type RejectionReason =
  | "duplicate_event_id"
  | "event_too_large"
  | "invalid_event"
  | "invalid_json";

type Rejection = {
  line: number;
  eventId?: string;
  reason: RejectionReason;
};

function rejection(
  line: number,
  reason: RejectionReason,
  value?: unknown
): Rejection {
  if (
    typeof value === "object" &&
    value !== null &&
    "eventId" in value &&
    typeof value.eventId === "string" &&
    value.eventId.length <= 512
  ) {
    return { line, eventId: value.eventId, reason };
  }
  return { line, reason };
}

/**
 * POST application/x-ndjson from `hackspain watch`, one canonical
 * `hackspain.telemetry.v1` event per line (apps/cli/docs/telemetry-schema.md).
 *
 * The participant session is verified before canonical events are inserted in
 * RawTree. The RawTree API key stays server-side. Events also stay in the
 * participant's local spool.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return fail("No has iniciado sesión", 401);
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    return fail("Batch too large", 413);
  }

  let authContext: [
    Awaited<ReturnType<typeof fetchQuery<typeof api.users.me>>>,
    Awaited<ReturnType<typeof fetchQuery<typeof api.teams.mineId>>>,
  ];
  try {
    authContext = await Promise.all([
      fetchQuery(api.users.me, {}, { token }),
      fetchQuery(api.teams.mineId, {}, { token }),
    ]);
  } catch (err) {
    return fromError(err);
  }
  const [me, teamId] = authContext;
  if (!me) {
    return fail("No has iniciado sesión", 401);
  }

  const text = await request.text();
  const encoder = new TextEncoder();
  if (encoder.encode(text).byteLength > MAX_BODY_BYTES) {
    return fail("Batch too large", 413);
  }

  const lines = text
    .split("\n")
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.trim());
  if (lines.length > TELEMETRY_BATCH_MAX) {
    return fail(`A batch can contain at most ${TELEMETRY_BATCH_MAX} events`, 413);
  }

  const accepted: NonNullable<ReturnType<typeof parseTelemetryEvent>>[] = [];
  const rejections: Rejection[] = [];
  const seenEventIds = new Set<string>();
  for (const entry of lines) {
    if (encoder.encode(entry.line).byteLength > TELEMETRY_EVENT_MAX_BYTES) {
      rejections.push(rejection(entry.number, "event_too_large"));
      continue;
    }
    try {
      const value: unknown = JSON.parse(entry.line);
      const event = parseTelemetryEvent(value, {
        userId: me._id,
        ...(teamId ? { teamId } : {}),
      });
      if (!event) {
        rejections.push(rejection(entry.number, "invalid_event", value));
        continue;
      }
      if (seenEventIds.has(event.eventId)) {
        rejections.push(rejection(entry.number, "duplicate_event_id", event));
        continue;
      }
      seenEventIds.add(event.eventId);
      accepted.push(event);
    } catch {
      rejections.push(rejection(entry.number, "invalid_json"));
    }
  }
  try {
    await storeTelemetryEvents(accepted);
  } catch (error) {
    console.error("RawTree telemetry insert failed", {
      batchSize: accepted.length,
      kind: error instanceof Error ? error.name : "unknown",
      ...(error instanceof RawTreeError
        ? { status: error.status, code: error.error, hint: error.hint }
        : {}),
    });
    const status = error instanceof RawTreeConfigurationError ? 503 : 502;
    return fail("No se pudo guardar la telemetría; se reintentará", status);
  }

  return ok(
    {
      accepted: accepted.length,
      rejected: rejections.length,
      rejections,
      stored: true,
    },
    202
  );
}
