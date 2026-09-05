import { api } from "@convex/_generated/api";
import { fetchAction } from "convex/nextjs";
import { fail, fromError, ok, readJson } from "../../_lib/respond";

/**
 * POST { refreshToken } → { tokens } with a rotated refresh token, or
 * { tokens: null } when the session is gone and the CLI must log in again.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  const refreshToken =
    typeof body?.refreshToken === "string" ? body.refreshToken : "";
  if (!refreshToken) {
    return fail("Missing refreshToken", 400);
  }
  try {
    const result = await fetchAction(api.auth.signIn, { refreshToken });
    return ok({ tokens: result.tokens ?? null });
  } catch (err) {
    return fromError(err);
  }
}
