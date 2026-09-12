import { api } from "@convex/_generated/api";
import { fetchAction, fetchQuery } from "convex/nextjs";
import { fail, fromError, ok, readJson } from "../../../_lib/respond";

/**
 * POST { code, secret } → { status: "pending" | "expired" } while waiting,
 * or { status: "approved", tokens, email } exactly once after a signed-in
 * user approved the code on /cli-auth. Redemption goes through the
 * `cli-device` credentials provider, which checks the secret and deletes
 * the request, so tokens only ever reach the CLI that started the flow.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  const code = typeof body?.code === "string" ? body.code : "";
  const secret = typeof body?.secret === "string" ? body.secret : "";
  if (!(code && secret)) {
    return fail("Se necesitan code y secret", 400);
  }
  try {
    const state = await fetchQuery(api.cliAuth.status, { code, secret });
    if (state !== "approved") {
      return ok({ status: state });
    }
    const result = await fetchAction(api.auth.signIn, {
      provider: "cli-device",
      params: { code, secret },
    });
    if (!result.tokens) {
      return ok({ status: "expired" });
    }
    const me = await fetchQuery(
      api.users.me,
      {},
      { token: result.tokens.token },
    );
    return ok({
      status: "approved",
      tokens: result.tokens,
      email: me?.email ?? null,
    });
  } catch (err) {
    return fromError(err);
  }
}
