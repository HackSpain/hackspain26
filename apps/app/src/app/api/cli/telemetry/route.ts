import { api } from "@convex/_generated/api";
import { closedMessage } from "@convex/lib/eventWindow";
import { RawTreeError } from "@rawtree/sdk";
import { fetchQuery } from "convex/nextjs";
import { reportServerEvent } from "@/lib/server-observability";
import { bearerToken, fail, fromError, ok } from "../_lib/respond";
import { exportTelemetryAsOtlpLogs, otlpLogsEnabled } from "./otlp";
import {
  occurredInWindow,
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
  | "invalid_json"
  | "outside_event_window";

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
    return { eventId: value.eventId, line, reason };
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

  let me: Awaited<ReturnType<typeof fetchQuery<typeof api.users.me>>>;
  let teamId: Awaited<ReturnType<typeof fetchQuery<typeof api.teams.mineId>>>;
  try {
    me = await fetchQuery(api.users.me, {}, { token });
    if (!me) {
      return fail("No has iniciado sesión", 401);
    }
    if (me.event.phase === "before") {
      // Nothing can have happened inside the window yet, organisers
      // included. After it the watcher may still deliver what happened
      // inside and was never sent; the per-event check below keeps
      // everything else out.
      return fail(closedMessage(me.event.phase, me.event), 403);
    }
    teamId = await fetchQuery(api.teams.mineId, {}, { token });
  } catch (error) {
    return fromError(error);
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
    return fail(
      `A batch can contain at most ${TELEMETRY_BATCH_MAX} events`,
      413
    );
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
      if (!occurredInWindow(event.occurredAt, me.event)) {
        rejections.push(rejection(entry.number, "outside_event_window", event));
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
    await reportServerEvent("error", "RawTree telemetry insert failed", {
      batchSize: accepted.length,
      kind: error instanceof Error ? error.name : "unknown",
      ...(error instanceof RawTreeError
        ? { code: error.error, hint: error.hint, status: error.status }
        : {}),
    });
    const status = error instanceof RawTreeConfigurationError ? 503 : 502;
    return fail("No se pudo guardar la telemetría; se reintentará", status);
  }

  // The explorer copy is best effort: the canonical insert above is what the
  // receipt answers for, so a failure here is reported and nothing more.
  if (otlpLogsEnabled()) {
    try {
      await exportTelemetryAsOtlpLogs(accepted);
    } catch (error) {
      await reportServerEvent("warn", "RawTree OTLP logs export failed", {
        batchSize: accepted.length,
        message: error instanceof Error ? error.message : "unknown",
      });
    }
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
