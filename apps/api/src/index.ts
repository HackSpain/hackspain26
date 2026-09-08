import { node } from "@elysia/node";
import { waitUntil } from "@vercel/functions";
import { Elysia } from "elysia";
import type { TrackingEnvironment } from "./tracking";
import { operationName, trackRequest } from "./tracking";

const PROVIDERS: Record<string, string> = {
  exa: "https://api.exa.ai",
  helmcode: "https://api.helmcode.com",
  quiverai: "https://api.quiver.ai",
  fal: "https://queue.fal.run",
};
const STRIPPED = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "cookie",
  "forwarded",
  "origin",
  "referer",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
  "true-client-ip",
  "set-cookie",
]);
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods":
    "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-expose-headers": "*",
};

function cleanHeaders(input: Headers): Headers {
  const headers = new Headers();
  const connectionHeaders = new Set(
    (input.get("connection") ?? "")
      .toLowerCase()
      .split(",")
      .map((name) => name.trim())
  );
  for (const [name, value] of input) {
    if (
      !(
        STRIPPED.has(name) ||
        connectionHeaders.has(name) ||
        name.startsWith("cf-") ||
        name.startsWith("sec-")
      )
    ) {
      headers.set(name, value);
    }
  }
  return headers;
}

function trackingEnvironment(): TrackingEnvironment {
  return {
    RAWTREE_API_KEY: process.env.RAWTREE_API_KEY,
    RAWTREE_DATABASE: process.env.RAWTREE_DATABASE,
    RAWTREE_PROXY_TABLE: process.env.RAWTREE_PROXY_TABLE,
  };
}

function responseHeaders(input: Headers): Headers {
  const headers = cleanHeaders(input);
  // Node fetch decompresses the body but retains upstream encoding headers.
  if (headers.has("content-encoding")) {
    headers.delete("content-encoding");
    headers.delete("content-length");
  }
  return headers;
}

export function createApp(
  env: TrackingEnvironment = trackingEnvironment(),
  background: (promise: Promise<void>) => void = waitUntil
) {
  return new Elysia({ adapter: node() }).all(
    "*",
    async ({ request }): Promise<Response> => {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") {
        const headers = new Headers(CORS);
        headers.set(
          "access-control-allow-headers",
          request.headers.get("access-control-request-headers") ??
            "Authorization, X-Api-Key, Content-Type"
        );
        return new Response(null, { status: 204, headers });
      }
      if (
        request.method === "GET" &&
        (url.pathname === "/" || url.pathname === "/health")
      ) {
        return Response.json(
          {
            providers: PROVIDERS,
            auth: "Send your own provider API key in its original header.",
          },
          { headers: CORS }
        );
      }
      const slash = url.pathname.indexOf("/", 1);
      const provider = url.pathname.slice(1, slash === -1 ? undefined : slash);
      const base = Object.hasOwn(PROVIDERS, provider)
        ? PROVIDERS[provider]
        : undefined;
      if (!base) {
        return Response.json(
          { error: "Unknown provider" },
          { status: 404, headers: CORS }
        );
      }
      const upstream = new URL(base);
      upstream.pathname = slash === -1 ? "/" : url.pathname.slice(slash);
      upstream.search = url.search;
      const startedAt = Date.now();
      const eventId = crypto.randomUUID();
      let response: Response;
      let outcome = "upstream_response";
      try {
        const init: RequestInit & { duplex: "half" } = {
          method: request.method,
          headers: cleanHeaders(request.headers),
          body: request.body,
          duplex: "half",
          redirect: "manual",
        };
        response = await fetch(upstream, init);
      } catch {
        outcome = "network_error";
        response = Response.json(
          { error: "Provider request failed" },
          { status: 502 }
        );
      }
      background(
        trackRequest(env, {
          schema: "hackspain.proxy.v1",
          eventId,
          occurredAt: new Date(startedAt).toISOString(),
          provider,
          operation: operationName(upstream.pathname),
          method: request.method,
          status: response.status,
          headersDurationMs: Date.now() - startedAt,
          outcome,
        })
      );
      const headers = responseHeaders(response.headers);
      for (const [name, value] of Object.entries(CORS)) {
        headers.set(name, value);
      }
      headers.set("cache-control", "no-store");
      headers.set("x-hackspain-request-id", eventId);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    },
    { parse: "none" }
  );
}

export default createApp();
