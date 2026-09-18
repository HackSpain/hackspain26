import { RawTree, RawTreeError } from "@rawtree/sdk";

const DEFAULT_TELEMETRY_TABLE = "hackspain_telemetry";
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
 * One aggregate over the canonical table (`hackspain.telemetry.v2`, see
 * apps/cli/docs/telemetry-schema.md). RawTree stores the JSON as it came, so
 * every field is read through `toString` and cast: that holds whether a
 * column was inferred as a number, a string or a dynamic value.
 *
 * - `events` keeps one row per (`identity.userId`, `eventId`), the permanent
 *   logical key: insert deduplication only covers the retry window.
 * - Buckets are counted from the hackathon's start on `occurredAt` (the
 *   harness's time); ingestion already refuses anything outside the window,
 *   the range check here is the same rule on the way out.
 * - `tokens.total` is input + output + cache reads + cache writes, and
 *   `cachedTokens` the cache half of it, for every harness alike.
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
    toString(identity.userId) AS userId,
    toString(eventId) AS id,
    any(toString(identity.teamId)) AS teamId,
    any(toString(harness)) AS harness,
    any(toString(sessionId)) AS sessionId,
    any(toUnixTimestamp(parseDateTimeBestEffortOrZero(toString(occurredAt)))) AS at,
    any(toInt64OrZero(toString(tokens.total))) AS total,
    any(toInt64OrZero(toString(tokens.cacheRead)) + toInt64OrZero(toString(tokens.cacheWrite))) AS cached
  FROM ${table}
  WHERE toString(type) = 'usage'
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
  /** No RawTree key on this deployment. */
  | { status: "unconfigured"; rows: [] }
  /** The table does not exist until the first event of the hackathon lands. */
  | { status: "empty"; rows: [] };

/**
 * The dashboard uses one `read_write` RawTree key for ingestion and queries.
 * Throws on anything that is neither "not configured" nor "no table yet", so
 * the caller can report it.
 */
export async function fetchUsage(
  window: UsageWindow,
  fetchImpl: typeof fetch = fetch
): Promise<UsageResult> {
  const apiKey = process.env.RAWTREE_API_KEY;
  const database = process.env.RAWTREE_DATABASE;
  if (!apiKey || !database) {
    return { rows: [], status: "unconfigured" };
  }
  const table = process.env.RAWTREE_TELEMETRY_TABLE ?? DEFAULT_TELEMETRY_TABLE;
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
