/// <reference types="astro/client" />

interface Window {
  __hsAnalyticsConsent?: "granted" | "denied" | null;
}

interface ImportMetaEnv {
  readonly DATABASE_URL?: string;
  /** Better Stack Errors DSN (public; embedded in client bundle). */
  readonly PUBLIC_BETTER_STACK_ERRORS_DSN?: string;
  /** Server-only API key for transactional email delivery through Resend. */
  readonly RESEND_API_KEY?: string;
  /** Verified Resend sender, including its optional display name. */
  readonly RESEND_FROM?: string;
  /** Canonical public origin used in transactional email links. */
  readonly SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.svg?raw" {
  const content: string;
  export default content;
}

declare module "*.txt?raw" {
  const content: string;
  export default content;
}
