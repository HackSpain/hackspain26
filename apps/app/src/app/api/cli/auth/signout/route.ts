import { api } from "@convex/_generated/api";
import { fetchAction } from "convex/nextjs";
import { bearerToken, fail, fromError, ok } from "../../_lib/respond";

/** POST with `Authorization: Bearer <token>` → ends the Convex Auth session. */
export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return fail("No has iniciado sesión", 401);
  }
  try {
    await fetchAction(api.auth.signOut, {}, { token });
    return ok({ signedOut: true });
  } catch (err) {
    return fromError(err);
  }
}
