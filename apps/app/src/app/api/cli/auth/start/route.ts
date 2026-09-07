import { api } from "@convex/_generated/api";
import { fetchAction } from "convex/nextjs";
import { fail, fromError, ok, readJson } from "../../_lib/respond";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST { email } → sends the same 8-digit code the dashboard login sends. */
export async function POST(request: Request) {
  const body = await readJson(request);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email)) {
    return fail("Introduce un email válido", 400);
  }
  try {
    const result = await fetchAction(api.auth.signIn, {
      params: { email },
      provider: "resend-otp",
    });
    return ok({ started: Boolean(result.started) });
  } catch (error) {
    return fromError(error);
  }
}
