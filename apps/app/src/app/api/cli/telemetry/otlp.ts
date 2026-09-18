import type { TelemetryEvent } from "./rawtree";

/**
 * The same canonical events as OpenTelemetry logs, for RawTree's OTLP
 * endpoint and its explorer. One log record per event; a usage event is a
 * point in time with no duration, so a log and not a span.
 *
 * Names follow the GenAI semantic conventions where they exist
 * (`gen_ai.request.model`, `gen_ai.provider.name`, `gen_ai.usage.*`,
 * `gen_ai.conversation.id`); what they do not cover (cache, reasoning, cost,
 * harness, team, project) lives under `hackspain.*`.
 *
 * `timeUnixNano` is when the harness recorded the event, `observedTimeUnixNano`
 * when the watcher read it: usage reported days later still lands on the
 * moment it happened.
 */

type AnyValue = { stringValue: string } | { intValue: string } | { doubleValue: number };
type KeyValue = { key: string; value: AnyValue };

export type OtlpLogRecord = {
  timeUnixNano: string;
  observedTimeUnixNano: string;
  severityNumber: number;
  severityText: string;
  eventName: string;
  body: { stringValue: string };
  attributes: KeyValue[];
};

export type OtlpLogsRequest = {
  resourceLogs: {
    resource: { attributes: KeyValue[] };
    scopeLogs: {
      scope: { name: string; version: string };
      logRecords: OtlpLogRecord[];
    }[];
  }[];
};

const SCOPE = "hackspain.telemetry";
const SEVERITY_INFO = 9;

/** Epoch milliseconds to nanoseconds, as the decimal string OTLP/JSON expects. */
function unixNano(iso: string): string {
  return `${Date.parse(iso)}000000`;
}

function attributes(
  entries: [string, string | number | undefined, ("int" | "double")?][]
): KeyValue[] {
  const result: KeyValue[] = [];
  for (const [key, value, kind] of entries) {
    if (value === undefined) {
      continue;
    }
    if (typeof value === "string") {
      result.push({ key, value: { stringValue: value } });
    } else if (kind === "double") {
      result.push({ key, value: { doubleValue: value } });
    } else {
      // OTLP/JSON carries 64-bit integers as decimal strings.
      result.push({ key, value: { intValue: String(value) } });
    }
  }
  return result;
}

export function toOtlpLogRecord(event: TelemetryEvent): OtlpLogRecord {
  const { tokens, model, project } = event;
  return {
    attributes: attributes([
      ["event.id", event.eventId],
      ["gen_ai.conversation.id", event.sessionId],
      ["gen_ai.request.model", model?.raw],
      ["gen_ai.provider.name", model?.provider],
      ["gen_ai.usage.input_tokens", tokens?.input],
      ["gen_ai.usage.output_tokens", tokens?.output],
      ["hackspain.schema", event.schema],
      ["hackspain.harness", event.harness],
      ["hackspain.harness.version", event.harnessVersion],
      ["hackspain.model.family", model?.family],
      ["hackspain.usage.cache_read_tokens", tokens?.cacheRead],
      ["hackspain.usage.cache_write_tokens", tokens?.cacheWrite],
      ["hackspain.usage.reasoning_tokens", tokens?.reasoning],
      ["hackspain.cost_usd", event.costUsd, "double"],
      ["hackspain.user.id", event.identity.userId],
      ["hackspain.team.id", event.identity.teamId],
      ["hackspain.project.dir_hash", project?.dirHash],
      ["hackspain.project.name", project?.name],
      ["hackspain.project.git_branch", project?.gitBranch],
      ["hackspain.request.id", requestId(event)],
    ]),
    body: { stringValue: event.type },
    eventName: `hackspain.${event.type}`,
    observedTimeUnixNano: unixNano(event.observedAt),
    severityNumber: SEVERITY_INFO,
    severityText: "INFO",
    timeUnixNano: unixNano(event.occurredAt),
  };
}

function requestId(event: TelemetryEvent): string | undefined {
  const value = event.native?.requestId;
  return typeof value === "string" ? value : undefined;
}

/** Grouped by CLI version, the one resource-level fact a batch can differ on. */
export function toOtlpLogs(events: TelemetryEvent[]): OtlpLogsRequest {
  const byVersion = new Map<string, OtlpLogRecord[]>();
  for (const event of events) {
    const version = event.identity.clientVersion;
    const records = byVersion.get(version) ?? [];
    records.push(toOtlpLogRecord(event));
    byVersion.set(version, records);
  }
  return {
    resourceLogs: [...byVersion].map(([version, logRecords]) => ({
      resource: {
        attributes: attributes([
          ["service.name", "hackspain-cli"],
          ["service.version", version],
        ]),
      },
      scopeLogs: [{ logRecords, scope: { name: SCOPE, version: "1" } }],
    })),
  };
}

const DEFAULT_BASE_URL = "https://api.rawtree.com";

export function otlpLogsEnabled(): boolean {
  return Boolean(process.env.RAWTREE_OTLP_LOGS_TABLE);
}

/**
 * Optional second copy for RawTree's OpenTelemetry explorer, on when
 * RAWTREE_OTLP_LOGS_TABLE names the destination table. The canonical table
 * written by `storeTelemetryEvents` stays the source of truth: it has insert
 * deduplication, which the OTLP endpoint does not promise, so a retried batch
 * can land here twice. Queries on this table dedupe on
 * (`hackspain.user.id`, `event.id`).
 */
export async function exportTelemetryAsOtlpLogs(
  events: TelemetryEvent[],
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const table = process.env.RAWTREE_OTLP_LOGS_TABLE;
  const apiKey = process.env.RAWTREE_API_KEY;
  if (!table || !apiKey || events.length === 0) {
    return;
  }
  const base = (process.env.RAWTREE_BASE_URL ?? DEFAULT_BASE_URL).replace(
    /\/+$/,
    ""
  );
  const database = process.env.RAWTREE_DATABASE;
  const response = await fetchImpl(`${base}/otlp/v1/logs`, {
    body: JSON.stringify(toOtlpLogs(events)),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "user-agent": "hackspain-dashboard/1.0",
      "x-rawtree-logs-table": table,
      ...(database ? { "x-rawtree-database": database } : {}),
    },
    method: "POST",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`RawTree OTLP logs answered ${response.status}`);
  }
  const receipt: unknown = await response.json().catch(() => null);
  const rejected =
    typeof receipt === "object" && receipt !== null && "partialSuccess" in receipt
      ? Number(
          (receipt.partialSuccess as { rejectedLogRecords?: unknown } | null)
            ?.rejectedLogRecords ?? 0
        )
      : 0;
  if (rejected > 0) {
    throw new Error(`RawTree OTLP logs rejected ${rejected} records`);
  }
}
