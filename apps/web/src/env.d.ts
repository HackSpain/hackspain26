/// <reference types="astro/client" />

interface Window {
  __hsAnalyticsConsent?: "granted" | "denied" | null;
}

interface ImportMetaEnv {
  /** Dashboard Convex deployment the landing writes to. */
  readonly CONVEX_URL?: string;
  readonly DATABASE_URL?: string;
  /** Better Stack Errors DSN (public; embedded in client bundle). */
  readonly PUBLIC_BETTER_STACK_ERRORS_DSN?: string;
  /** Canonical public origin used in shared links. */
  readonly SITE_URL?: string;
  /** Shared secret that must match the Convex deployment. */
  readonly SUBSCRIBE_SECRET?: string;
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
