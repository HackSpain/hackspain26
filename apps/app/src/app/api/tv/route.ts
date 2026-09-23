import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { NextResponse } from "next/server";
import {
  SCREEN_CLIENT_ID_PATTERN, isScreenCounter, isScreenDimension, parseScreenUrl, screenKey, screenPreset,
} from "@convex/lib/tvScreens";
import { api } from "@convex/_generated/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("Convex is not configured");
    }
    const client = new ConvexHttpClient(url);
    return NextResponse.json(await client.query(api.tvPlayback.snapshot, {}), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "TV temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

function refuse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

// Same-origin heartbeat keeps anonymous venue browsers independent of auth/WebSocket setup.
// /api/ is outside the bot challenge, so everything is checked here before it costs a Convex call.
export async function POST(request: Request) {
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 4096) { return refuse("Petición demasiado grande", 400); }
    body = JSON.parse(text);
  } catch { return refuse("Petición no válida", 400); }
  if (!body || typeof body !== "object") { return refuse("Petición no válida", 400); }
  const value = body as Record<string, unknown>;
  if (typeof value.key !== "string" || typeof value.clientId !== "string" || typeof value.url !== "string") {
    return refuse("Estado de pantalla no válido", 400);
  }
  let key: string;
  try { key = screenKey(value.key); } catch { return refuse("Identificador no válido", 400); }
  if (!SCREEN_CLIENT_ID_PATTERN.test(value.clientId)) { return refuse("Identificador no válido", 400); }
  if (!parseScreenUrl(value.url)) { return refuse("URL de pantalla no válida", 400); }
  // JSON has no NaN, but it has negatives, fractions and 1e308; the mutation repeats these checks for direct callers.
  if (!isScreenDimension(value.width) || !isScreenDimension(value.height)) { return refuse("Resolución no válida", 400); }
  if (!isScreenCounter(value.receivedRevision) || !isScreenCounter(value.receivedReloadVersion)) {
    return refuse("Estado de pantalla no válido", 400);
  }
  try {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) { throw new Error("Convex is not configured"); }
    const client = new ConvexHttpClient(url);
    const config = await client.mutation(api.tvPlayback.heartbeat, {
      key, clientId: value.clientId, url: value.url,
      initialPreset: screenPreset(typeof value.initialPreset === "string" ? value.initialPreset : null),
      width: value.width, height: value.height,
      receivedRevision: value.receivedRevision, receivedReloadVersion: value.receivedReloadVersion,
    });
    return NextResponse.json(config, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ConvexError) {
      const data = error.data as { code?: unknown; message?: unknown } | null;
      if (data?.code === "SCREEN_LIMIT" && typeof data.message === "string") { return refuse(data.message, 429); }
    }
    return refuse("Pantalla temporalmente sin conexión", 503);
  }
}
