import type {
  ModelFamily as CanonicalFamily,
  CanonicalModel,
  TokenCounts,
} from "../../../app/src/app/api/cli/telemetry/canonical";
import {
  modelFamily as canonicalFamily,
  canonicalModel,
  MODEL_FAMILIES,
  TELEMETRY_SCHEMA,
  TELEMETRY_SCHEMA_V1,
  totalTokens,
} from "../../../app/src/app/api/cli/telemetry/canonical";

/**
 * Canonical telemetry event: the one shape every harness collector produces
 * and every sink consumes. Documented for the backend in
 * apps/cli/docs/telemetry-schema.md. Bump SCHEMA for breaking changes. The
 * derived fields come from the dashboard's `telemetry/canonical.ts`, which
 * the server runs again on ingestion.
 */
export const SCHEMA = TELEMETRY_SCHEMA;

export type ModelFamily = CanonicalFamily;

/** Collectors may set it; `canonicalize` derives it again either way. */
export function modelFamily(raw: string): ModelFamily {
  return canonicalFamily(raw);
}

export const HARNESSES = [
  "claude-code",
  "codex",
  "cursor",
  "opencode",
  "cline",
  "copilot",
  "gemini-cli",
  "qwen-code",
  "kilo-code",
  "pi",
  "omp",
  "antigravity",
  "devin",
] as const;
export type HarnessId = (typeof HARNESSES)[number];

export type EventType = "usage" | "session.start" | "session.end";

export const TELEMETRY_EVENT_MAX_BYTES = 32 * 1024;

const MAX_EVENT_ID_LENGTH = 512;
const MAX_SESSION_ID_LENGTH = 256;
const MAX_SHORT_STRING_LENGTH = 256;
const MAX_VERSION_LENGTH = 64;
const DIR_HASH_PATTERN = /^[a-f\d]{16}$/i;
const REPO_SLUG_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export type TelemetryEvent = {
  schema: typeof SCHEMA;
  type: EventType;
  /** `${harness}:${sessionId}:${nativeId}`; global dedupe key. */
  eventId: string;
  /** ISO-8601 UTC, when the harness recorded it. */
  occurredAt: string;
  /** ISO-8601 UTC, when the watcher read it. */
  observedAt: string;
  harness: HarnessId;
  harnessVersion?: string;
  sessionId: string;
  /** Sanitized project identity; never a full path or raw Git remote URL. */
  project?: {
    dirHash: string;
    name: string;
    gitBranch?: string;
    repo?: string;
  };
  /** Derived from what the harness logged, the same way for every harness. */
  model?: CanonicalModel;
  /**
   * For every harness: `input` excludes cache reads, `output` includes
   * `reasoning` (a breakdown, absent when the harness does not report it),
   * and `total` is input + output + cacheRead + cacheWrite.
   */
  tokens?: TokenCounts & { total: number };
  /** Stamped by the CLI at flush time, never by collectors. */
  identity: { userId: string; teamId?: string; clientVersion: string };
  /**
   * What only some harnesses report, so never comparable across them:
   * Claude Code's `requestId`, and the `costUsd` OpenCode, Kilo Code,
   * Cline, Pi and Oh My Pi compute themselves. Allowlisted here and on the server.
   */
  native?: { requestId?: string; costUsd?: number };
};

/**
 * What a collector yields: the facts as the harness logged them. `stamp`
 * derives the rest (`canonicalize`), so no collector decides how a model is
 * named or what a total is.
 */
export type RawEvent = Pick<
  TelemetryEvent,
  | "eventId"
  | "harness"
  | "harnessVersion"
  | "occurredAt"
  | "project"
  | "sessionId"
  | "type"
> & {
  model?: { raw: string; family?: ModelFamily; provider?: string };
  tokens?: TokenCounts;
  /** The harness's own price; ends up in `native.costUsd`. */
  costUsd?: number;
  native?: { requestId?: string };
};

/** The derived half of an event, shared with the dashboard's ingestion. */
export function canonicalize(
  raw: RawEvent
): Omit<TelemetryEvent, "identity" | "observedAt" | "schema"> {
  const { costUsd, model, native, tokens, ...facts } = raw;
  const remainder = {
    ...native,
    ...(costUsd === undefined ? {} : { costUsd }),
  };
  return {
    ...facts,
    ...(model ? { model: canonicalModel(model.raw, model.provider) } : {}),
    ...(tokens ? { tokens: { ...tokens, total: totalTokens(tokens) } } : {}),
    ...(Object.keys(remainder).length > 0 ? { native: remainder } : {}),
  };
}

/**
 * Lines written to the local spool by 0.4.x and earlier are v1. The board
 * and `hackspain telemetry` read them as v2; anything unrecognisable is
 * returned as it is and fails validation where that matters.
 */
export function upgradeEvent(value: unknown): TelemetryEvent {
  const event = value as Record<string, unknown>;
  if (!isRecord(value) || event.schema !== TELEMETRY_SCHEMA_V1) {
    return value as TelemetryEvent;
  }
  const { schema: _schema, observedAt, identity, ...raw } = event;
  return {
    schema: SCHEMA,
    ...canonicalize(raw as RawEvent),
    identity: identity as TelemetryEvent["identity"],
    observedAt: observedAt as string,
  };
}

/**
 * `tokens.output` includes reasoning for every harness. Claude, Codex and
 * OpenCode report it that way; Gemini-style usage keeps thoughts next to the
 * candidates count instead. The harness's own total settles which one a
 * record is: when it only adds up with the thoughts on top, they are added.
 * Without a total, `separateByDefault` says what the upstream API does.
 */
export function outputWithReasoning(usage: {
  prompt: number;
  output: number;
  reasoning: number;
  total: number;
  separateByDefault: boolean;
}): number {
  const { prompt, output, reasoning, total } = usage;
  if (reasoning === 0) {
    return output;
  }
  const separate =
    total > 0 ? total >= prompt + output + reasoning : usage.separateByDefault;
  return separate ? output + reasoning : output;
}

export function eventId(
  harness: HarnessId,
  sessionId: string,
  nativeId: string | number
): string {
  return `${harness}:${sessionId}:${nativeId}`;
}

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function isOptionalBoundedString(value: unknown, max: number): boolean {
  return value === undefined || isBoundedString(value, max);
}

function isIsoDate(value: unknown): value is string {
  return (
    isBoundedString(value, MAX_VERSION_LENGTH) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isValidModel(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isBoundedString(value.raw, MAX_SHORT_STRING_LENGTH) &&
    isBoundedString(value.name, MAX_SHORT_STRING_LENGTH) &&
    MODEL_FAMILIES.includes(value.family as ModelFamily) &&
    isBoundedString(value.provider, MAX_SHORT_STRING_LENGTH)
  );
}

function isValidNative(value: unknown, harness: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const { requestId, costUsd, ...unknown } = value;
  if (Object.keys(unknown).length > 0 || Object.keys(value).length === 0) {
    return false;
  }
  if (
    requestId !== undefined &&
    (harness !== "claude-code" ||
      !isBoundedString(requestId, MAX_EVENT_ID_LENGTH))
  ) {
    return false;
  }
  return (
    costUsd === undefined ||
    (typeof costUsd === "number" && Number.isFinite(costUsd) && costUsd >= 0)
  );
}

function isValidIdentity(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isBoundedString(value.userId, MAX_SESSION_ID_LENGTH) &&
    isOptionalBoundedString(value.teamId, MAX_SESSION_ID_LENGTH) &&
    isBoundedString(value.clientVersion, MAX_VERSION_LENGTH)
  );
}

/**
 * Hand-rolled validator (no zod, to keep the binary small). Returns the list
 * of problems; empty means valid.
 */
export function validateEvent(value: unknown): string[] {
  const problems: string[] = [];
  if (typeof value !== "object" || value === null) {
    return ["not an object"];
  }
  const e = value as Record<string, unknown>;
  if (e.schema !== SCHEMA) {
    problems.push(`schema must be ${SCHEMA}`);
  }
  if (!["usage", "session.start", "session.end"].includes(String(e.type))) {
    problems.push("type must be usage | session.start | session.end");
  }
  if (!isBoundedString(e.eventId, MAX_EVENT_ID_LENGTH)) {
    problems.push(`eventId must be 1-${MAX_EVENT_ID_LENGTH} characters`);
  }
  if (!isIsoDate(e.occurredAt)) {
    problems.push("occurredAt must be ISO-8601");
  }
  if (!isIsoDate(e.observedAt)) {
    problems.push("observedAt must be ISO-8601");
  }
  if (!HARNESSES.includes(e.harness as HarnessId)) {
    problems.push(`harness must be one of ${HARNESSES.join(", ")}`);
  }
  if (!isOptionalBoundedString(e.harnessVersion, MAX_VERSION_LENGTH)) {
    problems.push(
      `harnessVersion must be at most ${MAX_VERSION_LENGTH} characters`
    );
  }
  if (!isBoundedString(e.sessionId, MAX_SESSION_ID_LENGTH)) {
    problems.push(`sessionId must be 1-${MAX_SESSION_ID_LENGTH} characters`);
  }
  if (e.project !== undefined) {
    const p = isRecord(e.project) ? e.project : null;
    if (
      !p ||
      typeof p.dirHash !== "string" ||
      !DIR_HASH_PATTERN.test(p.dirHash) ||
      !isBoundedString(p.name, MAX_SHORT_STRING_LENGTH) ||
      !isOptionalBoundedString(p.gitBranch, MAX_SHORT_STRING_LENGTH) ||
      !isOptionalBoundedString(p.repo, MAX_SHORT_STRING_LENGTH) ||
      (typeof p.repo === "string" && !REPO_SLUG_PATTERN.test(p.repo))
    ) {
      problems.push("project needs dirHash and name");
    } else if (p.name.includes("/") || p.name.includes("\\")) {
      problems.push("project.name must be a basename, not a path");
    }
  }
  if (e.model !== undefined && !isValidModel(e.model)) {
    problems.push("model needs raw, name, provider and a known family");
  }
  if (e.type === "usage" && e.model === undefined) {
    problems.push("usage events need a model");
  }
  if (e.type === "usage" && e.tokens === undefined) {
    problems.push("usage events need tokens");
  }
  if (e.tokens !== undefined) {
    const t = isRecord(e.tokens) ? e.tokens : null;
    for (const key of ["input", "output", "cacheRead", "cacheWrite"]) {
      if (!isInt(t?.[key])) {
        problems.push(`tokens.${key} must be a non-negative integer`);
      }
    }
    if (t?.reasoning !== undefined && !isInt(t.reasoning)) {
      problems.push("tokens.reasoning must be a non-negative integer");
    }
    if (
      problems.length === 0 &&
      t?.total !== totalTokens(t as unknown as TokenCounts)
    ) {
      problems.push(
        "tokens.total must be input + output + cacheRead + cacheWrite"
      );
    }
  }
  if (e.costUsd !== undefined) {
    problems.push("costUsd belongs in native.costUsd");
  }
  if (!isValidIdentity(e.identity)) {
    problems.push("identity needs userId and clientVersion");
  }
  if (e.native !== undefined && !isValidNative(e.native, e.harness)) {
    problems.push("native contains fields that are not safe for this harness");
  }
  try {
    if (
      new TextEncoder().encode(JSON.stringify(e)).byteLength >
      TELEMETRY_EVENT_MAX_BYTES
    ) {
      problems.push(`event exceeds ${TELEMETRY_EVENT_MAX_BYTES} bytes`);
    }
  } catch {
    problems.push("event must be JSON serializable");
  }
  return problems;
}
