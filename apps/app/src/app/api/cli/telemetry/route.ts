import { api } from "@convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { bearerToken, fail, fromError, ok } from "../_lib/respond";

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const SCHEMA = "hackspain.telemetry.v1";

/**
 * POST application/x-ndjson from `hackspain watch`, one canonical
 * `hackspain.telemetry.v1` event per line (apps/cli/docs/telemetry-schema.md).
 *
 * The telemetry store is still being decided (ClickHouse or an alternative),
 * so for now this endpoint authenticates the participant, validates the
 * lines, and acknowledges them without storing anything. Wiring the store
 * happens here, server-side, with no CLI release: the watcher already sends
 * the final format. Events also stay in the participant's local spool.
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

  let me: Awaited<ReturnType<typeof fetchQuery<typeof api.users.me>>>;
  try {
    me = await fetchQuery(api.users.me, {}, { token });
  } catch (err) {
    return fromError(err);
  }
  if (!me) {
    return fail("No has iniciado sesión", 401);
  }

  const text = await request.text();
  let accepted = 0;
  let rejected = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      const event = JSON.parse(line) as {
        schema?: unknown;
        eventId?: unknown;
        identity?: { userId?: unknown };
      };
      const own = event.identity?.userId === me._id;
      if (event.schema === SCHEMA && typeof event.eventId === "string" && own) {
        accepted++;
      } else {
        rejected++;
      }
    } catch {
      rejected++;
    }
  }
  // TODO(telemetry-store): forward `accepted` events to the chosen store.
  return ok({ accepted, rejected, stored: false }, 202);
}
