const OPERATIONS = new Set([
  "/search",
  "/contents",
  "/answer",
  "/findSimilar",
  "/mcp",
  "/v1/models",
  "/v1/chat/completions",
  "/v1/responses",
  "/v1/embeddings",
  "/v1/rerank",
  "/v1/audio/speech",
  "/v1/audio/transcriptions",
  "/v1/svgs/generations",
  "/v1/svgs/vectorizations",
]);

// Never persist arbitrary paths: they may contain credentials or personal data.
export function operationName(path: string): string {
  if (OPERATIONS.has(path)) {
    return path;
  }
  if (path.includes("/requests/")) {
    if (path.endsWith("/status")) {
      return "queue.status";
    }
    if (path.endsWith("/cancel")) {
      return "queue.cancel";
    }
    return "queue.result";
  }
  if (path.startsWith("/fal-ai/")) {
    return "inference";
  }
  return "other";
}

export interface ProxyEvent {
  eventId: string;
  headersDurationMs: number;
  method: string;
  occurredAt: string;
  operation: string;
  outcome: string;
  provider: string;
  schema: "hackspain.proxy.v1";
  status: number;
}

export async function trackRequest(env: Env, event: ProxyEvent): Promise<void> {
  if (!(env.RAWTREE_API_KEY && env.RAWTREE_DATABASE)) {
    console.error(
      JSON.stringify({
        event: "proxy_tracking_unconfigured",
        eventId: event.eventId,
      })
    );
    return;
  }
  const url = new URL(
    `https://api.rawtree.com/v1/tables/${encodeURIComponent(env.RAWTREE_PROXY_TABLE)}`
  );
  url.searchParams.set("database", env.RAWTREE_DATABASE);
  url.searchParams.set("deduplicate_insert", "enable");
  url.searchParams.set("insert_deduplication_token", event.eventId);
  // Same HTTP contract as @rawtree/sdk. Retries reuse the deduplication token.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RAWTREE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([event]),
        signal: AbortSignal.timeout(5000),
      });
      await response.body?.cancel();
      if (response.ok) {
        return;
      }
      if (response.status < 500 && response.status !== 429) {
        break;
      }
    } catch {
      // Tracking outages must not replace or delay the provider response.
    }
  }
  console.error(
    JSON.stringify({ event: "proxy_tracking_failed", eventId: event.eventId })
  );
}
