/**
 * Canonical telemetry event: the one shape every harness collector produces
 * and every sink consumes. Documented for the backend in
 * apps/cli/docs/telemetry-schema.md. Bump SCHEMA for breaking changes.
 */
export const SCHEMA = "hackspain.telemetry.v1" as const;

export const HARNESSES = [
  "claude-code",
  "codex",
  "cursor",
  "opencode",
  "cline",
  "copilot",
] as const;
export type HarnessId = (typeof HARNESSES)[number];

export const MODEL_FAMILIES = ["claude", "gpt", "gemini", "other"] as const;
export type ModelFamily = (typeof MODEL_FAMILIES)[number];

export type EventType = "usage" | "session.start" | "session.end";

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
  /** sha256 of the working directory plus its basename; never the full path. */
  project?: { dirHash: string; name: string; gitBranch?: string };
  model?: { raw: string; family: ModelFamily; provider?: string };
  tokens?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    reasoning?: number;
  };
  /** Only when the harness itself reports a price. */
  costUsd?: number;
  /** Stamped by the CLI at flush time, never by collectors. */
  identity: { userId: string; teamId?: string; clientVersion: string };
  /** Small harness-specific remainder; keep it tiny. */
  native?: Record<string, unknown>;
};

/** Collector output before identity is stamped. */
export type RawEvent = Omit<
  TelemetryEvent,
  "identity" | "observedAt" | "schema"
>;

const OPENAI_PATTERN = /\bgpt|o[1-9]-|codex|openai/;

export function modelFamily(raw: string): ModelFamily {
  const model = raw.toLowerCase();
  if (model.includes("claude")) {
    return "claude";
  }
  if (OPENAI_PATTERN.test(model)) {
    return "gpt";
  }
  if (model.includes("gemini")) {
    return "gemini";
  }
  return "other";
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

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
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
  if (typeof e.eventId !== "string" || !e.eventId) {
    problems.push("eventId required");
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
  if (typeof e.sessionId !== "string" || !e.sessionId) {
    problems.push("sessionId required");
  }
  if (e.project !== undefined) {
    const p = e.project as Record<string, unknown>;
    if (typeof p?.dirHash !== "string" || typeof p?.name !== "string") {
      problems.push("project needs dirHash and name");
    } else if (p.name.includes("/") || p.name.includes("\\")) {
      problems.push("project.name must be a basename, not a path");
    }
  }
  if (e.model !== undefined) {
    const m = e.model as Record<string, unknown>;
    if (
      typeof m?.raw !== "string" ||
      !MODEL_FAMILIES.includes(m?.family as ModelFamily)
    ) {
      problems.push("model needs raw and a known family");
    }
  }
  if (e.type === "usage" && e.tokens === undefined) {
    problems.push("usage events need tokens");
  }
  if (e.tokens !== undefined) {
    const t = e.tokens as Record<string, unknown>;
    for (const key of ["input", "output", "cacheRead", "cacheWrite"]) {
      if (!isInt(t?.[key])) {
        problems.push(`tokens.${key} must be a non-negative integer`);
      }
    }
    if (t?.reasoning !== undefined && !isInt(t.reasoning)) {
      problems.push("tokens.reasoning must be a non-negative integer");
    }
  }
  if (
    e.costUsd !== undefined &&
    (typeof e.costUsd !== "number" || e.costUsd < 0)
  ) {
    problems.push("costUsd must be a non-negative number");
  }
  const id = e.identity as Record<string, unknown>;
  if (typeof id?.userId !== "string" || typeof id?.clientVersion !== "string") {
    problems.push("identity needs userId and clientVersion");
  }
  return problems;
}
