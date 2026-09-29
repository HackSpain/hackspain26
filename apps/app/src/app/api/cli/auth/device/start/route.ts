import { api } from "@convex/_generated/api";
import { fetchMutation } from "convex/nextjs";
import { fail, fromError, ok, readJson } from "../../../_lib/respond";

const SECRET_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

/**
 * POST { secret } → { code, expiresAt }. Starts a browser login: the CLI
 * keeps the secret, opens /cli-auth#hs-code=<code> for the user, and polls
 * /api/cli/auth/device/poll with both until someone signed in approves it.
 * The approval page also accepts ?hs-code= links from older CLI versions.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  const secret = typeof body?.secret === "string" ? body.secret : "";
  if (!SECRET_PATTERN.test(secret)) {
    return fail("Missing or malformed secret", 400);
  }
  try {
    const { code, expiresAt } = await fetchMutation(api.cliAuth.start, {
      secret,
    });
    return ok({ code, expiresAt });
  } catch (error) {
    return fromError(error);
  }
}
