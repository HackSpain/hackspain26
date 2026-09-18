import { fetchMutation, fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export const dynamic = "force-dynamic";

const REQUEST_ID_PREFIX = /^\[Request ID: [^\]]+\] Server Error:?\s*/;
const UNCAUGHT_PATTERN = /Uncaught (?:Convex)?Error: ([^\n]*)/;

function messageFrom(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }
  const raw = error.message.replace(REQUEST_ID_PREFIX, "").trim();
  return UNCAUGHT_PATTERN.exec(raw)?.[1]?.trim() || raw || fallback;
}

function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

export async function GET() {
  try {
    return json(await fetchQuery(api.passes.staffStatus, {}));
  } catch (error) {
    return json(
      { error: messageFrom(error, "No se ha podido cargar el check-in") },
      503
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Petición no válida" }, 400);
  }
  if (!body || typeof body !== "object") {
    return json({ error: "Petición no válida" }, 400);
  }

  const payload = body as Record<string, unknown>;
  try {
    if (payload.action === "scan" && typeof payload.value === "string") {
      return json(
        await fetchMutation(api.passes.staffScan, { value: payload.value })
      );
    }
    if (payload.action === "undo" && typeof payload.passId === "string") {
      await fetchMutation(api.passes.staffUndoCheckIn, {
        passId: payload.passId as Id<"eventPasses">,
      });
      return json({ ok: true });
    }
    return json({ error: "Petición no válida" }, 400);
  } catch (error) {
    return json(
      { error: messageFrom(error, "No se ha podido completar la operación") },
      400
    );
  }
}
