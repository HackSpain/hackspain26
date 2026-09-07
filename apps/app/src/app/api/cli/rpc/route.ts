import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { CLI_FUNCTIONS } from "../_lib/functions";
import { bearerToken, fail, fromError, ok, readJson } from "../_lib/respond";

/**
 * POST { name: "teams:join", args: {...} } with `Authorization: Bearer <token>`.
 * Runs the allowlisted Convex function server-side as the participant.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return fail("No has iniciado sesión", 401);
  }
  const body = await readJson(request);
  const name = typeof body?.name === "string" ? body.name : null;
  const args = typeof body?.args === "object" && body?.args !== null ? body.args : {};
  if (!name) {
    return fail("Body must be { name, args }", 400);
  }
  const exposed = CLI_FUNCTIONS[name];
  if (!exposed) {
    return fail(`Unknown function ${name}`, 404);
  }
  try {
    const options = { token };
    switch (exposed.kind) {
      case "query":
        return ok(await fetchQuery(exposed.ref, args, options));
      case "mutation":
        return ok(await fetchMutation(exposed.ref, args, options));
      case "action":
        return ok(await fetchAction(exposed.ref, args, options));
      default:
        return fail("Unsupported function kind", 500);
    }
  } catch (err) {
    return fromError(err);
  }
}
