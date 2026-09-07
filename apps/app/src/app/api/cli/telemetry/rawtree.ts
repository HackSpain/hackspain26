import { RawTree, type JsonObject } from "@rawtree/sdk";

const DEFAULT_TELEMETRY_TABLE = "hackspain_telemetry";

const EVENT_TYPES = ["usage", "session.start", "session.end"] as const;
const HARNESSES = [
  "claude-code",
  "codex",
  "cursor",
  "opencode",
  "cline",
  "copilot",
] as const;
const MODEL_FAMILIES = ["claude", "gpt", "gemini", "other"] as const;

type EventType = (typeof EVENT_TYPES)[number];
type Harness = (typeof HARNESSES)[number];
type ModelFamily = (typeof MODEL_FAMILIES)[number];

export type TelemetryEvent = {
  schema: "hackspain.telemetry.v1";
  type: EventType;
  eventId: string;
  occurredAt: string;
  observedAt: string;
  harness: Harness;
  harnessVersion?: string;
  sessionId: string;
  project?: { dirHash: string; name: string; gitBranch?: string };
  model?: { raw: string; family: ModelFamily; provider?: string };
  tokens?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    reasoning?: number;
  };
  costUsd?: number;
  identity: { userId: string; teamId?: string; clientVersion: string };
  native?: Record<string, unknown>;
};

export class RawTreeConfigurationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
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
    !isNonEmptyString(name) ||
    name.includes("/") ||
    name.includes("\\") ||
    !isOptionalString(gitBranch)
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
  const { raw, family, provider } = value;
  if (
    !isNonEmptyString(raw) ||
    !MODEL_FAMILIES.includes(family as ModelFamily) ||
    !isOptionalString(provider)
  ) {
    return null;
  }
  return {
    raw,
    family: family as ModelFamily,
    ...(provider ? { provider } : {}),
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
  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    ...(reasoning === undefined ? {} : { reasoning }),
  };
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
  const identity = value.identity;
  const native = value.native;

  if (
    value.schema !== "hackspain.telemetry.v1" ||
    !EVENT_TYPES.includes(value.type as EventType) ||
    !isNonEmptyString(value.eventId) ||
    !isDate(value.occurredAt) ||
    !isDate(value.observedAt) ||
    !HARNESSES.includes(value.harness as Harness) ||
    !isOptionalString(value.harnessVersion) ||
    !isNonEmptyString(value.sessionId) ||
    project === null ||
    model === null ||
    tokens === null ||
    (value.type === "usage" && tokens === undefined) ||
    (value.costUsd !== undefined &&
      (typeof value.costUsd !== "number" ||
        !Number.isFinite(value.costUsd) ||
        value.costUsd < 0)) ||
    !isRecord(identity) ||
    identity.userId !== authenticated.userId ||
    !isOptionalString(identity.teamId) ||
    !isNonEmptyString(identity.clientVersion) ||
    (native !== undefined && !isRecord(native))
  ) {
    return null;
  }

  return {
    schema: value.schema,
    type: value.type as EventType,
    eventId: value.eventId,
    occurredAt: value.occurredAt,
    observedAt: value.observedAt,
    harness: value.harness as Harness,
    ...(value.harnessVersion ? { harnessVersion: value.harnessVersion } : {}),
    sessionId: value.sessionId,
    ...(project ? { project } : {}),
    ...(model ? { model } : {}),
    ...(tokens ? { tokens } : {}),
    ...(value.costUsd === undefined ? {} : { costUsd: value.costUsd }),
    identity: {
      userId: authenticated.userId,
      ...(authenticated.teamId ? { teamId: authenticated.teamId } : {}),
      clientVersion: identity.clientVersion,
    },
    ...(native ? { native } : {}),
  };
}

function toJsonObject(event: TelemetryEvent): JsonObject {
  return JSON.parse(JSON.stringify(event)) as JsonObject;
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

  const rawtree = new RawTree({
    apiKey,
    database,
    ...(process.env.RAWTREE_BASE_URL
      ? { baseUrl: process.env.RAWTREE_BASE_URL }
      : {}),
    fetch: fetchImpl,
    userAgent: "hackspain-dashboard/1.0",
  });
  const result = await rawtree.insert({
    table:
      process.env.RAWTREE_TELEMETRY_TABLE ?? DEFAULT_TELEMETRY_TABLE,
    values: events.map(toJsonObject),
    signal: AbortSignal.timeout(10_000),
  });
  if (result.inserted !== events.length) {
    throw new Error(
      `RawTree inserted ${result.inserted} of ${events.length} telemetry events`
    );
  }
}
