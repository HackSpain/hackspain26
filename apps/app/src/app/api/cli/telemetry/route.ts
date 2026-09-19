import { api } from "@convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { reportServerEvent } from "@/lib/server-observability";
import { bearerToken, fail, fromError, ok } from "../_lib/respond";
import { rememberTelemetry } from "./canonical";
import {
  exportTelemetryAsOtlpLogs,
  RawTreeOtlpConfigurationError,
} from "./otlp";
import {
  occurredInWindow,
  parseTelemetryEvent,
  TELEMETRY_BATCH_MAX,
  TELEMETRY_EVENT_MAX_BYTES,
} from "./rawtree";

import { telemetryWindow } from "./window";

const MAX_BODY_BYTES = 5 * 1024 * 1024;

type RejectionReason =
  | "duplicate_event_id"
  | "duplicate_request"
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
 * `hackspain.telemetry.v2` event per line (v1 is upgraded) (apps/cli/docs/telemetry-schema.md).
 *
 * The participant session is verified before canonical events are exported
 * to RawTree as OTLP logs. The API key stays server-side. Events also stay in
 * the participant's local spool.
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
    const window = telemetryWindow(me.event);
    if (window && Date.now() < window.startsAt) {
      // Nothing can have happened inside the window yet, organisers
      // included. After it the watcher may still deliver what happened
      // inside and was never sent; the per-event check below keeps
      // everything else out.
      return fail("Telemetry collection has not started yet", 403);
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
  const seenTelemetry = new Set<string>();
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
      if (rememberTelemetry(seenTelemetry, event)) {
        rejections.push(rejection(entry.number, "duplicate_request", event));
        continue;
      }
      accepted.push(event);
    } catch {
      rejections.push(rejection(entry.number, "invalid_json"));
    }
  }
  try {
    await exportTelemetryAsOtlpLogs(accepted);
  } catch (error) {
    await reportServerEvent("error", "RawTree OTLP logs export failed", {
      batchSize: accepted.length,
      kind: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "unknown",
    });
    const status = error instanceof RawTreeOtlpConfigurationError ? 503 : 502;
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
