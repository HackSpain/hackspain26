import { api } from "@convex/_generated/api";
import { fetchAction } from "convex/nextjs";
import { fail, fromError, ok, readJson } from "../../_lib/respond";

const CODE_PATTERN = /^\d{8}$/;

/** POST { email, code } → { tokens: { token, refreshToken } } on success. */
export async function POST(request: Request) {
  const body = await readJson(request);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!(email && CODE_PATTERN.test(code))) {
    return fail("Se necesitan email y un código de 8 dígitos", 400);
  }
  try {
    const result = await fetchAction(api.auth.signIn, {
      provider: "resend-otp",
      params: { email, code },
    });
    if (!result.tokens) {
      return fail("Could not verify code", 401);
    }
    return ok({ tokens: result.tokens });
  } catch (err) {
    return fromError(err);
  }
}
