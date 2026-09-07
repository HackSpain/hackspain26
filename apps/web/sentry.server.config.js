import { init } from "@sentry/astro";

const dsn = import.meta.env.PUBLIC_SENTRY_DSN;
if (dsn) {
  init({
    dsn,
    sendDefaultPii: false,
    // Enable logs to be sent to Sentry
    enableLogs: true,
    // Define how likely traces are sampled. Adjust this value in production,
    // or use tracesSampler for greater control.
    tracesSampleRate: 1,
  });
}
