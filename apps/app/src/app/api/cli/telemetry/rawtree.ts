import { createHash } from "node:crypto";
import { RawTree } from "@rawtree/sdk";
import type { JsonObject } from "@rawtree/sdk";
import type { CanonicalModel, TokenCounts } from "./canonical";
import {
  canonicalModel,
  TELEMETRY_SCHEMA,
  TELEMETRY_SCHEMA_V1,
  totalTokens,
} from "./canonical";

const DEFAULT_TELEMETRY_TABLE = "hackspain_telemetry";

export const TELEMETRY_BATCH_MAX = 200;
export const TELEMETRY_EVENT_MAX_BYTES = 32 * 1024;

const MAX_EVENT_ID_LENGTH = 512;
const MAX_SESSION_ID_LENGTH = 256;
const MAX_SHORT_STRING_LENGTH = 256;
const MAX_VERSION_LENGTH = 64;

const EVENT_TYPES = ["usage", "session.start", "session.end"] as const;
const HARNESSES = [
  "claude-code",
  "codex",
  "cursor",
  "opencode",
  "cline",
  "copilot",
  "gemini-cli",
  "qwen-code",
  "kilo-code",
] as const;

type EventType = (typeof EVENT_TYPES)[number];
type Harness = (typeof HARNESSES)[number];

/**
 * What is stored: always `hackspain.telemetry.v2`, with every derived field
 * (`model.name`, `model.family`, `model.provider`, `tokens.total`) computed
 * here by `./canonical`, never trusted from the client. A v1 event from an
 * older binary goes through the same code, so rows do not differ by harness
 * or by CLI version.
 */
export type TelemetryEvent = {
  schema: typeof TELEMETRY_SCHEMA;
  type: EventType;
  eventId: string;
  occurredAt: string;
  observedAt: string;
  harness: Harness;
  harnessVersion?: string;
  sessionId: string;
  project?: { dirHash: string; name: string; gitBranch?: string };
  model?: CanonicalModel;
  tokens?: TokenCounts & { total: number };
  identity: { userId: string; teamId?: string; clientVersion: string };
  /** Harness-specific, never comparable across harnesses. */
  native?: { requestId?: string; costUsd?: number };
};

export class RawTreeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RawTreeConfigurationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isBoundedString(value: unknown, max: number): value is string {
  return isNonEmptyString(value) && value.length <= max;
}

function isOptionalBoundedString(
  value: unknown,
  max: number
): value is string | undefined {
  return value === undefined || isBoundedString(value, max);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isDate(value: unknown): value is string {
  return (
    isBoundedString(value, MAX_VERSION_LENGTH) &&
    !Number.isNaN(Date.parse(value))
  );
}

function parseProject(
  value: unknown
): TelemetryEvent["project"] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    return null;
  }
  const { dirHash, name, gitBranch } = value;
  if (
    typeof dirHash !== "string" ||
    !/^[a-f\d]{16}$/i.test(dirHash) ||
    !isBoundedString(name, MAX_SHORT_STRING_LENGTH) ||
    name.includes("/") ||
    name.includes("\\") ||
    !isOptionalBoundedString(gitBranch, MAX_SHORT_STRING_LENGTH)
  ) {
    return null;
  }
  return { dirHash, name, ...(gitBranch ? { gitBranch } : {}) };
}

function parseModel(
  value: unknown
): TelemetryEvent["model"] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    return null;
  }
  const { raw, provider } = value;
  if (
    !isBoundedString(raw, MAX_SHORT_STRING_LENGTH) ||
    !isOptionalBoundedString(provider, MAX_SHORT_STRING_LENGTH)
  ) {
    return null;
  }
  // name, family and provider are derived here, whatever the client sent.
  return canonicalModel(raw, provider);
}

function isCost(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * `requestId` only from Claude Code; `costUsd` from the harnesses that price
 * their own requests. v1 carried the price at the top level (`legacyCost`).
 */
function parseNative(
  value: unknown,
  harness: Harness,
  legacyCost: unknown
): TelemetryEvent["native"] | null | undefined {
  if (value !== undefined && !isRecord(value)) {
    return null;
  }
  const { requestId, costUsd, ...unknown } = value ?? {};
  const cost = costUsd ?? legacyCost;
  if (
    Object.keys(unknown).length > 0 ||
    (cost !== undefined && !isCost(cost)) ||
    (requestId !== undefined &&
      (harness !== "claude-code" ||
        !isBoundedString(requestId, MAX_EVENT_ID_LENGTH)))
  ) {
    return null;
  }
  if (requestId === undefined && cost === undefined) {
    return undefined;
  }
  return {
    ...(requestId === undefined ? {} : { requestId }),
    ...(cost === undefined ? {} : { costUsd: cost }),
  };
}

function parseTokens(
  value: unknown
): TelemetryEvent["tokens"] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    return null;
  }
  const { input, output, cacheRead, cacheWrite, reasoning } = value;
  if (
    !isNonNegativeInteger(input) ||
    !isNonNegativeInteger(output) ||
    !isNonNegativeInteger(cacheRead) ||
    !isNonNegativeInteger(cacheWrite) ||
    (reasoning !== undefined && !isNonNegativeInteger(reasoning))
  ) {
    return null;
  }
  const counts = {
    cacheRead,
    cacheWrite,
    input,
    output,
    ...(reasoning === undefined ? {} : { reasoning }),
  };
  return { ...counts, total: totalTokens(counts) };
}

/**
 * Nothing outside the hackathon window is stored, for anybody: organisers
 * included, and nothing at all while no hackathon is scheduled. Judged on
 * the time the harness recorded (`occurredAt`), not on when the watcher read
 * or sent it. The CLI applies the same window
 * (apps/cli/src/watcher/window.ts); older binaries do not, and this is the
 * check that keeps RawTree clean either way.
 */
export function occurredInWindow(
  occurredAt: string,
  window: { startsAt?: number; endsAt?: number }
): boolean {
  const { startsAt, endsAt } = window;
  if (startsAt === undefined || endsAt === undefined) {
    return false;
  }
  const at = Date.parse(occurredAt);
  return at >= startsAt && at < endsAt;
}

export function parseTelemetryEvent(
  value: unknown,
  authenticated: { userId: string; teamId?: string }
): TelemetryEvent | null {
  if (!isRecord(value)) {
    return null;
  }

  const project = parseProject(value.project);
  const model = parseModel(value.model);
  const tokens = parseTokens(value.tokens);
  const { identity } = value;
  const harness = HARNESSES.includes(value.harness as Harness)
    ? (value.harness as Harness)
    : null;
  const native = harness
    ? parseNative(value.native, harness, value.costUsd)
    : null;

  if (
    (value.schema !== TELEMETRY_SCHEMA &&
      value.schema !== TELEMETRY_SCHEMA_V1) ||
    !EVENT_TYPES.includes(value.type as EventType) ||
    !isBoundedString(value.eventId, MAX_EVENT_ID_LENGTH) ||
    !isDate(value.occurredAt) ||
    !isDate(value.observedAt) ||
    harness === null ||
    !isOptionalBoundedString(value.harnessVersion, MAX_VERSION_LENGTH) ||
    !isBoundedString(value.sessionId, MAX_SESSION_ID_LENGTH) ||
    project === null ||
    model === null ||
    tokens === null ||
    (value.type === "usage" && (tokens === undefined || model === undefined)) ||
    !isRecord(identity) ||
    identity.userId !== authenticated.userId ||
    !isOptionalBoundedString(identity.teamId, MAX_SESSION_ID_LENGTH) ||
    !isBoundedString(identity.clientVersion, MAX_VERSION_LENGTH) ||
    native === null
  ) {
    return null;
  }

  return {
    schema: TELEMETRY_SCHEMA,
    type: value.type as EventType,
    eventId: value.eventId,
    occurredAt: value.occurredAt,
    observedAt: value.observedAt,
    harness,
    ...(value.harnessVersion ? { harnessVersion: value.harnessVersion } : {}),
    sessionId: value.sessionId,
    ...(project ? { project } : {}),
    ...(model ? { model } : {}),
    ...(tokens ? { tokens } : {}),
    identity: {
      userId: authenticated.userId,
      ...(authenticated.teamId ? { teamId: authenticated.teamId } : {}),
      clientVersion: identity.clientVersion,
    },
    ...(native ? { native } : {}),
  };
}

function toJsonObject(event: TelemetryEvent): JsonObject {
  return structuredClone(event) as JsonObject;
}

function sortedUniqueEvents(events: TelemetryEvent[]): TelemetryEvent[] {
  const sorted = [...events].toSorted((left, right) =>
    left.eventId.localeCompare(right.eventId)
  );
  for (let index = 1; index < sorted.length; index++) {
    if (sorted[index - 1]?.eventId === sorted[index]?.eventId) {
      throw new Error(
        `Duplicate telemetry event id: ${sorted[index]?.eventId}`
      );
    }
  }
  return sorted;
}

function deduplicatingFetch(
  fetchImpl: typeof fetch,
  token: string
): typeof fetch {
  return ((input, init) => {
    const inputUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(inputUrl);
    url.searchParams.set("deduplicate_insert", "enable");
    url.searchParams.set("insert_deduplication_token", token);
    return fetchImpl(url.toString(), init);
  }) as typeof fetch;
}

export async function storeTelemetryEvents(
  events: TelemetryEvent[],
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const apiKey = process.env.RAWTREE_API_KEY;
  const database = process.env.RAWTREE_DATABASE;
  if (!apiKey || !database) {
    throw new RawTreeConfigurationError(
      "RAWTREE_API_KEY and RAWTREE_DATABASE are required"
    );
  }

  const table = process.env.RAWTREE_TELEMETRY_TABLE ?? DEFAULT_TELEMETRY_TABLE;
  const orderedEvents = sortedUniqueEvents(events);
  const token = createHash("sha256")
    .update("hackspain.telemetry.insert.v1\0")
    .update(database)
    .update("\0")
    .update(table)
    .update("\0")
    .update(
      JSON.stringify(
        orderedEvents.map(({ eventId, identity }) => [identity.userId, eventId])
      )
    )
    .digest("hex");

  const rawtree = new RawTree({
    apiKey,
    database,
    ...(process.env.RAWTREE_BASE_URL
      ? { baseUrl: process.env.RAWTREE_BASE_URL }
      : {}),
    fetch: deduplicatingFetch(fetchImpl, token),
    userAgent: "hackspain-dashboard/1.0",
  });
  const result = await rawtree.insert({
    signal: AbortSignal.timeout(10_000),
    table,
    values: orderedEvents.map(toJsonObject),
  });
  if (result.inserted !== 0 && result.inserted !== orderedEvents.length) {
    throw new Error(
      `RawTree inserted ${result.inserted} of ${orderedEvents.length} telemetry events`
    );
  }
}
