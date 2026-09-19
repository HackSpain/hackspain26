import {
  appendFileSync,
  closeSync,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  openSync,
  readSync,
} from "node:fs";
import type { RawEvent } from "./schema";
import { canonicalize, eventId, SCHEMA, validateEvent } from "./schema";
import type { CollectionWindow } from "./window";
import { inWindow } from "./window";

const COUNT_PATTERN = /^\d+$/;

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function attributes(value: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null);
  for (const entry of list(value)) {
    const pair = object(entry);
    const scalar = object(pair.value);
    if (typeof pair.key === "string") {
      result[pair.key] =
        scalar.stringValue ?? scalar.intValue ?? scalar.doubleValue;
    }
  }
  return result;
}

function count(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") {
    return;
  }
  if (typeof value === "string" && !COUNT_PATTERN.test(value)) {
    return;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Only API usage is retained. Resource attributes, bodies and all other logs are discarded. */
export function claudeOtelEvents(payload: unknown): RawEvent[] {
  const events: RawEvent[] = [];
  for (const resource of list(object(payload).resourceLogs)) {
    const service = attributes(object(object(resource).resource).attributes)[
      "service.name"
    ];
    if (service !== "claude-code" && service !== "claude-code-desktop") {
      continue;
    }
    for (const scope of list(object(resource).scopeLogs)) {
      for (const record of list(object(scope).logRecords)) {
        const log = object(record);
        const attrs = attributes(log.attributes);
        if (attrs["event.name"] !== "api_request") {
          continue;
        }
        const sessionId = attrs["session.id"];
        const requestId = attrs.request_id;
        const model = attrs.model;
        // Sequence numbers reset on restart. Without the API request id,
        // the transcript remains the source; never guess a correlation.
        if (
          !(
            typeof sessionId === "string" &&
            typeof requestId === "string" &&
            typeof model === "string"
          )
        ) {
          continue;
        }
        const input = count(attrs.input_tokens);
        const output = count(attrs.output_tokens);
        const cacheRead = count(attrs.cache_read_tokens ?? 0);
        const cacheWrite = count(attrs.cache_creation_tokens ?? 0);
        if (
          input === undefined ||
          output === undefined ||
          cacheRead === undefined ||
          cacheWrite === undefined
        ) {
          continue;
        }
        const at =
          typeof attrs["event.timestamp"] === "string"
            ? Date.parse(attrs["event.timestamp"])
            : Number(log.timeUnixNano) / 1_000_000;
        if (!Number.isFinite(at) || Math.abs(at) > 8.64e15) {
          continue;
        }
        const event: RawEvent = {
          eventId: eventId("claude-code", sessionId, `request:${requestId}`),
          harness: "claude-code",
          model: { raw: model, provider: "anthropic" },
          native: { requestId },
          occurredAt: new Date(at).toISOString(),
          sessionId,
          tokens: { input, output, cacheRead, cacheWrite },
          type: "usage",
        };
        if (typeof attrs["app.version"] === "string") {
          event.harnessVersion = attrs["app.version"];
        }
        const cost = attrs.cost_usd;
        if (
          (typeof cost === "number" || typeof cost === "string") &&
          cost !== "" &&
          Number.isFinite(Number(cost)) &&
          Number(cost) >= 0
        ) {
          event.costUsd = Number(cost);
        }
        if (
          validateEvent({
            ...canonicalize(event),
            schema: SCHEMA,
            observedAt: event.occurredAt,
            identity: { userId: "local", clientVersion: "local" },
          }).length === 0
        ) {
          events.push(event);
        }
      }
    }
  }
  return events;
}

export type OtelReceiverOptions = {
  port: number;
  token: string;
  userId: string;
  queuePath: string;
  window: () => CollectionWindow | null;
  paused?: () => boolean;
  onError: () => void;
};

/** A small OTLP/HTTP JSON logs receiver; not a metrics or traces collector. */
export function startOtelReceiver(options: OtelReceiverOptions) {
  return Bun.serve({
    hostname: "127.0.0.1",
    port: options.port,
    maxRequestBodySize: 1024 * 1024,
    idleTimeout: 10,
    async fetch(request) {
      if (
        new URL(request.url).pathname !== "/v1/logs" ||
        request.method !== "POST"
      ) {
        return new Response(null, { status: 404 });
      }
      if (
        request.headers.has("origin") ||
        request.headers.get("authorization") !== `Bearer ${options.token}`
      ) {
        return new Response(null, { status: 403 });
      }
      if (
        request.headers.get("content-type")?.split(";")[0]?.trim() !==
          "application/json" ||
        request.headers.has("content-encoding")
      ) {
        return new Response(null, { status: 415 });
      }
      if (options.paused?.()) {
        return new Response(null, { status: 503 });
      }
      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        return new Response(null, { status: 400 });
      }
      if (!Array.isArray(object(payload).resourceLogs)) {
        return new Response(null, { status: 400 });
      }
      const window = options.window();
      const events = window
        ? claudeOtelEvents(payload).filter((event) =>
            inWindow(event.occurredAt, window)
          )
        : [];
      try {
        if (events.length > 0) {
          const fd = openSync(options.queuePath, "a+", 0o600);
          try {
            // A crash or a full disk may leave an incomplete line. Repair it
            // before appending, so it cannot swallow the first retried event.
            const size = fstatSync(fd).size;
            if (size > 0) {
              const tail = Buffer.alloc(Math.min(size, 64 * 1024));
              readSync(fd, tail, 0, tail.length, size - tail.length);
              if (tail.at(-1) !== 10) {
                ftruncateSync(
                  fd,
                  size - tail.length + tail.lastIndexOf(10) + 1
                );
              }
            }
            appendFileSync(
              fd,
              events
                .map(
                  (event) =>
                    `${JSON.stringify({ userId: options.userId, event })}\n`
                )
                .join("")
            );
            // Acknowledge only after the sanitized queue is durable.
            fsyncSync(fd);
          } finally {
            closeSync(fd);
          }
        }
      } catch {
        options.onError();
        return new Response(null, { status: 503 });
      }
      return Response.json({});
    },
  });
}
