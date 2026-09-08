import type { JsonObject } from "@rawtree/sdk";
import { RawTree } from "@rawtree/sdk";
import type { APIRoute } from "astro";
import { checkBotId } from "botid/server";
import { isHarnessId } from "../../lib/harness-poll";
import { envFromRuntime } from "../../lib/runtime-env";

export const prerender = false;

const DEFAULT_TABLE = "hackspain_harness_poll";
const MAX_OTHER_LENGTH = 80;

interface PollBody {
  harnesses: string[];
  other?: string;
}

function parseBody(value: unknown): PollBody | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.harnesses)) {
    return null;
  }
  const harnesses = [...new Set(record.harnesses)];
  if (!harnesses.every(isHarnessId)) {
    return null;
  }
  const other =
    typeof record.other === "string" ? record.other.trim() : undefined;
  if (
    (harnesses.length === 0 && !other) ||
    (other !== undefined &&
      (other.length === 0 || other.length > MAX_OTHER_LENGTH))
  ) {
    return null;
  }
  return { harnesses, ...(other ? { other } : {}) };
}

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.DEV) {
    try {
      const verification = await checkBotId();
      if (verification.isBot) {
        return Response.json({ error: "access_denied" }, { status: 403 });
      }
    } catch (error) {
      console.error("[poll-harness] BotID check failed:", error);
    }
  }

  if (
    request.headers.get("content-type")?.split(";")[0]?.trim() !==
    "application/json"
  ) {
    return Response.json({ error: "expected_json" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = parseBody(body);
  if (!parsed) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const apiKey = envFromRuntime("RAWTREE_API_KEY");
  const database = envFromRuntime("RAWTREE_DATABASE");
  if (!(apiKey && database)) {
    console.error("[poll-harness] RawTree is not configured");
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  const submittedAt = new Date().toISOString();
  const event = {
    schema: "hackspain.harness-poll.v1",
    submittedAt,
    harnesses: parsed.harnesses,
    ...(parsed.other ? { other: parsed.other } : {}),
  } as JsonObject;
  const table = envFromRuntime("RAWTREE_POLL_TABLE") ?? DEFAULT_TABLE;

  try {
    const rawtree = new RawTree({
      apiKey,
      database,
      ...(envFromRuntime("RAWTREE_BASE_URL")
        ? { baseUrl: envFromRuntime("RAWTREE_BASE_URL") }
        : {}),
      userAgent: "hackspain-landing/1.0",
    });
    const result = await rawtree.insert({
      signal: AbortSignal.timeout(10_000),
      table,
      values: [event],
    });
    if (result.inserted !== 1) {
      throw new Error(`RawTree inserted ${result.inserted} poll responses`);
    }
  } catch (error) {
    console.error("[poll-harness] Failed to save response:", error);
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
};
