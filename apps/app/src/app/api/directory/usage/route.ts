import { api } from "@convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { RawTreeError } from "@rawtree/sdk";
import { fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { telemetryWindow } from "@/app/api/cli/telemetry/window";
import { reportServerEvent } from "@/lib/server-observability";
import { fetchPersonUsage } from "@/app/api/tv/insights/usage";

export const dynamic = "force-dynamic";

const USER_ID = /^[a-z0-9]+$/i;

/**
 * Staff directory person sheet: which harnesses and models this Convex user
 * actually used, from the same RawTree logs as Insights.
 */
export async function GET(request: Request) {
  const token = await convexAuthNextjsToken();
  if (!token) {
    return NextResponse.json({ error: "No has iniciado sesión" }, { status: 401 });
  }
  const userId = new URL(request.url).searchParams.get("userId") ?? "";
  if (!USER_ID.test(userId) || userId.length > 64) {
    return NextResponse.json({ error: "Esa ficha no vale." }, { status: 400 });
  }
  try {
    const bounds = await fetchQuery(api.directory.usageWindow, {}, { token });
    const window = telemetryWindow(bounds);
    if (!window) {
      return NextResponse.json({
        harnesses: [],
        models: [],
        status: "unscheduled",
      });
    }
    const usage = await fetchPersonUsage(userId, { ...window, buckets: 1 });
    return NextResponse.json(usage, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Se necesita acceso")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    await reportServerEvent("error", "Directory usage query failed", {
      kind: error instanceof Error ? error.name : "unknown",
      message: message || "unknown",
      ...(error instanceof RawTreeError
        ? { code: error.error, hint: error.hint, status: error.status }
        : {}),
    });
    return NextResponse.json(
      { error: "Uso no disponible." },
      { status: 503 },
    );
  }
}
