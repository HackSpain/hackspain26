import { api } from "@convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { bearerToken, fail, fromError, ok } from "../_lib/respond";
import {
  parseTelemetryEvent,
  RawTreeConfigurationError,
  storeTelemetryEvents,
} from "./rawtree";

const MAX_BODY_BYTES = 5 * 1024 * 1024;

/**
 * POST application/x-ndjson from `hackspain watch`, one canonical
 * `hackspain.telemetry.v1` event per line (apps/cli/docs/telemetry-schema.md).
 *
 * The participant session is verified before canonical events are inserted in
 * RawTree. The RawTree API key stays server-side. Events also stay in the
 * participant's local spool.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return fail("No has iniciado sesión", 401);
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    return fail("Batch too large", 413);
  }

  let authContext: [
    Awaited<ReturnType<typeof fetchQuery<typeof api.users.me>>>,
    Awaited<ReturnType<typeof fetchQuery<typeof api.teams.mineId>>>,
  ];
  try {
    authContext = await Promise.all([
      fetchQuery(api.users.me, {}, { token }),
      fetchQuery(api.teams.mineId, {}, { token }),
    ]);
  } catch (err) {
    return fromError(err);
  }
  const [me, teamId] = authContext;
  if (!me) {
    return fail("No has iniciado sesión", 401);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return fail("Batch too large", 413);
  }

  const accepted = [];
  let rejected = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      const event = parseTelemetryEvent(JSON.parse(line), {
        userId: me._id,
        ...(teamId ? { teamId } : {}),
      });
      if (event) {
        accepted.push(event);
      } else {
        rejected++;
      }
    } catch {
      rejected++;
    }
  }
  try {
    await storeTelemetryEvents(accepted);
  } catch (error) {
    const status = error instanceof RawTreeConfigurationError ? 503 : 502;
    return fail("No se pudo guardar la telemetría; se reintentará", status);
  }

  return ok({ accepted: accepted.length, rejected, stored: true }, 202);
}
