/**
 * The derived half of a telemetry event: everything that is computed from
 * what a harness logged rather than copied from it. One pure module, used by
 * the CLI when it stamps an event (apps/cli/src/watcher) and again by the
 * dashboard on ingestion, which recomputes every derived field. Stored rows
 * are therefore homogeneous whatever harness or CLI version produced them.
 * No imports: the CLI bundles this file by relative path.
 */

export const TELEMETRY_SCHEMA = "hackspain.telemetry.v2" as const;
/** Still accepted from binaries up to 0.4.x and upgraded on ingestion. */
export const TELEMETRY_SCHEMA_V1 = "hackspain.telemetry.v1" as const;

/** Keep legacy event ids, and correlate Claude's transcript and native OTLP ids. */
export function telemetryDedupKeys(event: {
  eventId: string;
  harness: string;
  type: string;
  sessionId: string;
  identity: { userId: string };
  native?: { requestId?: string };
}): string[] {
  const keys = [JSON.stringify([event.identity.userId, "event", event.eventId])];
  if (event.harness === "claude-code" && event.type === "usage" && event.native?.requestId) {
    keys.push(JSON.stringify([event.identity.userId, "claude-request", event.sessionId, event.native.requestId]));
  }
  return keys;
}

/** Remember both aliases even when one is already known. */
export function rememberTelemetry(seen: Set<string>, event: Parameters<typeof telemetryDedupKeys>[0]): boolean {
  const keys = telemetryDedupKeys(event);
  const duplicate = keys.some((key) => seen.has(key));
  for (const key of keys) {
    seen.add(key);
  }
  return duplicate;
}

export const MODEL_FAMILIES = [
  "claude",
  "gpt",
  "gemini",
  "qwen",
  "other",
] as const;
export type ModelFamily = (typeof MODEL_FAMILIES)[number];

export type CanonicalModel = {
  /** Exactly what the harness logged. */
  raw: string;
  /** Grouping key: the same model reads the same from every harness. */
  name: string;
  family: ModelFamily;
  /** Who served the request when the harness says; else who makes the model. */
  provider: string;
};

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
  if (model.includes("qwen")) {
    return "qwen";
  }
  return "other";
}

const CLOUD_PREFIX = /^(?:[a-z]{2,4}\.)?(?:anthropic|amazon|meta|mistral|cohere)\./;
const VARIANT_SUFFIX = /[:@].*$/;
const DATE_SUFFIX = /-(?:\d{8}|\d{4}-\d{2}-\d{2})$/;
const REVISION_SUFFIX = /-v\d+$/;
const VERSION_DOT = /(\d)\.(?=\d)/g;

/**
 * One spelling per model. Harnesses and gateways decorate the same model in
 * different ways: `anthropic/claude-sonnet-4.5` (OpenRouter),
 * `claude-sonnet-4-5-20250929` (Anthropic), `claude-sonnet-4-5@20250929`
 * (Vertex), `us.anthropic.claude-sonnet-4-5-20250929-v1:0` (Bedrock),
 * `models/gemini-2.5-pro`. All of those become `claude-sonnet-4-5` and
 * `gemini-2-5-pro`: lower case, no gateway path, no variant tag, no release
 * date, and version dots as dashes. It is a key for grouping, not a label;
 * `raw` keeps the original.
 */
export function modelName(raw: string): string {
  const lower = raw.trim().toLowerCase();
  const name = lower
    .slice(lower.lastIndexOf("/") + 1)
    .replace(VARIANT_SUFFIX, "")
    .replace(CLOUD_PREFIX, "")
    .replace(REVISION_SUFFIX, "")
    .replace(DATE_SUFFIX, "")
    .replaceAll(VERSION_DOT, "$1-");
  return name || lower || "unknown";
}

const FAMILY_PROVIDER: Record<ModelFamily, string> = {
  claude: "anthropic",
  gemini: "google",
  gpt: "openai",
  other: "unknown",
  qwen: "alibaba",
};

const PROVIDER_ALIASES: Record<string, string> = {
  "alibaba-cloud": "alibaba",
  "claude-code": "anthropic",
  dashscope: "alibaba",
  gemini: "google",
  "openai-codex": "openai",
  "openai-native": "openai",
  qwen: "alibaba",
  "vertex-ai": "vertex",
};

const PROVIDER_SEPARATORS = /[\s_]+/g;

/** Always a value: the harness's provider as a slug, else the model's maker. */
export function modelProvider(
  reported: string | undefined,
  family: ModelFamily
): string {
  const slug = reported?.trim().toLowerCase().replaceAll(PROVIDER_SEPARATORS, "-");
  if (!slug) {
    return FAMILY_PROVIDER[family];
  }
  return PROVIDER_ALIASES[slug] ?? slug;
}

export function canonicalModel(
  raw: string,
  reportedProvider?: string
): CanonicalModel {
  const family = modelFamily(raw);
  return {
    family,
    name: modelName(raw),
    provider: modelProvider(reportedProvider, family),
    raw,
  };
}

export type TokenCounts = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning?: number;
};

/** Reasoning is a breakdown of `output`, so it is never added on top. */
export function totalTokens(tokens: TokenCounts): number {
  return tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite;
}
