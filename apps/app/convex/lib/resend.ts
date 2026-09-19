const DEFAULT_FROM = "HackSpain <onboarding@resend.dev>";

/** Prefer the dashboard names (`RESEND_*`); keep `AUTH_*` as a fallback. */
export function resendApiKey(): string | undefined {
  return process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY;
}

export function resendFrom(): string {
  return process.env.RESEND_FROM ?? process.env.AUTH_EMAIL ?? DEFAULT_FROM;
}
