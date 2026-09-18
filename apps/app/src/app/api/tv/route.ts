import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { screenPreset } from "@convex/lib/tvScreens";
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

// Same-origin heartbeat keeps anonymous venue browsers independent of auth/WebSocket setup.
export async function POST(request: Request) {
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 4096) { return NextResponse.json({ error: "Petición demasiado grande" }, { status: 400 }); }
    body = JSON.parse(text);
  } catch { return NextResponse.json({ error: "Petición no válida" }, { status: 400 }); }
  if (!body || typeof body !== "object") { return NextResponse.json({ error: "Petición no válida" }, { status: 400 }); }
  const value = body as Record<string, unknown>;
  if (typeof value.key !== "string" || typeof value.clientId !== "string" || typeof value.url !== "string"
    || typeof value.width !== "number" || typeof value.height !== "number"
    || typeof value.receivedRevision !== "number" || typeof value.receivedReloadVersion !== "number") {
    return NextResponse.json({ error: "Estado de pantalla no válido" }, { status: 400 });
  }
  try {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) { throw new Error("Convex is not configured"); }
    const client = new ConvexHttpClient(url);
    const config = await client.mutation(api.tvPlayback.heartbeat, {
      key: value.key, clientId: value.clientId, url: value.url,
      initialPreset: screenPreset(typeof value.initialPreset === "string" ? value.initialPreset : null),
      width: value.width, height: value.height,
      receivedRevision: value.receivedRevision, receivedReloadVersion: value.receivedReloadVersion,
    });
    return NextResponse.json(config, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Pantalla temporalmente sin conexión" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
