import { RawTree, RawTreeError } from "@rawtree/sdk";

const DEFAULT_OTLP_LOGS_TABLE = "logs";
const TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** AI usage of one team on one harness in one bucket of the hackathon. */
export type UsageRow = {
  teamId: string;
  harness: string;
  bucket: number;
  tokens: number;
  cachedTokens: number;
  /** Sessions that started in this bucket, so summing buckets never counts one twice. */
  sessions: number;
  requests: number;
};

export type UsageWindow = { startsAt: number; endsAt: number; buckets: number };

/**
 * One aggregate over the OTLP logs table (see
 * apps/cli/docs/telemetry-schema.md). RawTree's `otlp-logs` transform flattens
 * resource and record attributes into top-level dotted columns.
 *
 * - `events` keeps one row per (`hackspain.user.id`, `event.id`), because a
 *   retried OTLP batch can be stored more than once.
 * - Buckets use `timeUnixNano`, which the exporter sets from `occurredAt`.
 * - `hackspain.usage.total_tokens` is input + output + both cache fields.
 */
export function usageSql(table: string, window: UsageWindow): string {
  if (!TABLE_NAME.test(table)) {
    throw new Error("Invalid telemetry table name");
  }
  const start = Math.floor(window.startsAt / 1000);
  const end = Math.floor(window.endsAt / 1000);
  const bucketSeconds = Math.max(1, Math.floor((end - start) / window.buckets));
  return `
WITH events AS (
  SELECT
    toString(\`hackspain.user.id\`) AS userId,
    toString(\`event.id\`) AS id,
    any(toString(\`hackspain.team.id\`)) AS teamId,
    any(toString(\`hackspain.harness\`)) AS harness,
    any(toString(\`gen_ai.conversation.id\`)) AS sessionId,
    any(intDiv(toInt64OrZero(toString(timeUnixNano)), 1000000000)) AS at,
    any(toInt64OrZero(toString(\`hackspain.usage.total_tokens\`))) AS total,
    any(toInt64OrZero(toString(\`hackspain.usage.cache_read_tokens\`)) + toInt64OrZero(toString(\`hackspain.usage.cache_write_tokens\`))) AS cached
  FROM ${table}
  WHERE toString(eventName) = 'hackspain.usage'
  GROUP BY userId, id
),
bucketed AS (
  SELECT *, least(intDiv(at - ${start}, ${bucketSeconds}), ${window.buckets - 1}) AS bucket
  FROM events
  WHERE at >= ${start} AND at < ${end}
),
session_starts AS (
  SELECT userId, harness, sessionId, min(bucket) AS firstBucket
  FROM bucketed
  GROUP BY userId, harness, sessionId
)
SELECT
  b.teamId AS teamId,
  b.harness AS harness,
  b.bucket AS bucket,
  sum(b.total) AS tokens,
  sum(b.cached) AS cachedTokens,
  count() AS requests,
  uniqExactIf((b.userId, b.sessionId), s.firstBucket = b.bucket) AS sessions
FROM bucketed AS b
LEFT JOIN session_starts AS s
  ON s.userId = b.userId AND s.harness = b.harness AND s.sessionId = b.sessionId
GROUP BY teamId, harness, bucket
ORDER BY bucket, teamId, harness
`.trim();
}

function toCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.round(count) : 0;
}

export function parseUsageRows(data: unknown[]): UsageRow[] {
  const rows: UsageRow[] = [];
  for (const entry of data) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.harness !== "string" || !row.harness) {
      continue;
    }
    rows.push({
      bucket: toCount(row.bucket),
      cachedTokens: toCount(row.cachedTokens),
      harness: row.harness,
      requests: toCount(row.requests),
      sessions: toCount(row.sessions),
      teamId: typeof row.teamId === "string" ? row.teamId : "",
      tokens: toCount(row.tokens),
    });
  }
  return rows;
}

export type UsageResult =
  | { status: "ok"; rows: UsageRow[] }
  /** No read key on this deployment. */
  | { status: "unconfigured"; rows: [] }
  /** The table does not exist until the first event of the hackathon lands. */
  | { status: "empty"; rows: [] };

/**
 * Reads need their own key: the dashboard's RAWTREE_API_KEY is `write_only`.
 * Set RAWTREE_READ_API_KEY to a `read_only` key. Throws on anything that is
 * neither "not configured" nor "no table yet", so the caller can report it.
 */
export async function fetchUsage(
  window: UsageWindow,
  fetchImpl: typeof fetch = fetch
): Promise<UsageResult> {
  const apiKey = process.env.RAWTREE_READ_API_KEY;
  const database = process.env.RAWTREE_DATABASE;
  if (!apiKey || !database) {
    return { rows: [], status: "unconfigured" };
  }
  const table = process.env.RAWTREE_OTLP_LOGS_TABLE ?? DEFAULT_OTLP_LOGS_TABLE;
  const rawtree = new RawTree({
    apiKey,
    database,
    ...(process.env.RAWTREE_BASE_URL
      ? { baseUrl: process.env.RAWTREE_BASE_URL }
      : {}),
    fetch: fetchImpl,
    userAgent: "hackspain-dashboard/1.0",
  });
  try {
    const result = await rawtree.query({
      signal: AbortSignal.timeout(15_000),
      sql: usageSql(table, window),
    });
    return { rows: parseUsageRows(result.data), status: "ok" };
  } catch (error) {
    if (error instanceof RawTreeError && isMissingTable(error)) {
      return { rows: [], status: "empty" };
    }
    throw error;
  }
}

function isMissingTable(error: RawTreeError): boolean {
  const text = `${error.error ?? ""} ${error.message}`.toLowerCase();
  return (
    error.status === 404 ||
    text.includes("unknown_table") ||
    text.includes("unknown table") ||
    text.includes("doesn't exist") ||
    text.includes("does not exist") ||
    text.includes("not found")
  );
}
