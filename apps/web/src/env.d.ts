/// <reference types="astro/client" />

interface Window {
  __hsAnalyticsConsent?: "granted" | "denied" | null;
}

interface ImportMetaEnv {
  readonly DATABASE_URL?: string;
  /** Better Stack Errors DSN (public; embedded in client bundle). */
  readonly PUBLIC_BETTER_STACK_ERRORS_DSN?: string;
  readonly PUBLIC_BING_SITE_VERIFICATION?: string;
  readonly PUBLIC_GOOGLE_SITE_VERIFICATION?: string;
  /** Optional WhatsApp invitation link shown after attendance confirmation. */
  readonly PUBLIC_WHATSAPP_GROUP_URL?: string;
  readonly PUBLIC_YANDEX_SITE_VERIFICATION?: string;
  readonly RAWTREE_API_KEY?: string;
  readonly RAWTREE_BASE_URL?: string;
  readonly RAWTREE_DATABASE?: string;
  readonly RAWTREE_POLL_TABLE?: string;
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
