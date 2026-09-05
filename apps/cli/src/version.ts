// Replaced at build time via `bun build --define process.env.HACKSPAIN_VERSION=...`.
export const VERSION: string = process.env.HACKSPAIN_VERSION ?? "0.0.0-dev";

export const IS_DEV_BUILD = VERSION === "0.0.0-dev";

/**
 * The dashboard the CLI talks to (its /api/cli/* routes). Release binaries
 * default to production; a source checkout targets the local `bun dev:app`.
 * Overridable at build time with --define process.env.HACKSPAIN_APP_URL_DEFAULT.
 */
export const DEFAULT_APP_URL: string =
  process.env.HACKSPAIN_APP_URL_DEFAULT ??
  (IS_DEV_BUILD ? "http://localhost:3000" : "https://app.hackspain.com");
