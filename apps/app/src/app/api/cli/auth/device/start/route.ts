import { api } from "@convex/_generated/api";
import { fetchMutation } from "convex/nextjs";
import { ConvexError } from "convex/values";
import { signStart, startIdentityKey } from "@convex/lib/cliAuthStart";
import {
  fail,
  failCoded,
  fromError,
  ok,
  readJson,
} from "../../../_lib/respond";

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
  const bridgeSecret = process.env.CLI_AUTH_BRIDGE_SECRET;
  if (!bridgeSecret || bridgeSecret.length < 32) {
    return fail("Device login is not configured", 503);
  }
  // Vercel sets this from the connecting client and prevents spoofing. Refuse
  // production requests without it instead of falling back to a client header.
  const ip =
    request.headers.get("x-vercel-forwarded-for")?.trim() ||
    (process.env.NODE_ENV !== "production" ? "local-development" : "");
  if (!ip || ip.includes(",")) {
    return fail("Client address unavailable", 503);
  }
  const identityKey = startIdentityKey(bridgeSecret, ip);
  const issuedAt = Date.now();
  try {
    const { code, expiresAt } = await fetchMutation(api.cliAuth.start, {
      secret,
      identityKey,
      issuedAt,
      signature: signStart(bridgeSecret, secret, identityKey, issuedAt),
    });
    return ok({ code, expiresAt });
  } catch (caughtError) {
    if (caughtError instanceof ConvexError) {
      const data = caughtError.data;
      if (
        typeof data === "object" &&
        data !== null &&
        "code" in data &&
        data.code === "TOO_MANY_ATTEMPTS" &&
        "message" in data &&
        typeof data.message === "string"
      ) {
        return failCoded(data.code, data.message, 429);
      }
    }
    return fromError(caughtError);
  }
}
