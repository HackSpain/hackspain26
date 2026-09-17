import { init } from "@sentry/astro";
import { sanitizeTelemetryEvent } from "./telemetry-sanitize.js";

const dsn = import.meta.env.PUBLIC_BETTER_STACK_ERRORS_DSN;
if (dsn) {
  init({
    beforeSend: sanitizeTelemetryEvent,
    beforeSendTransaction: sanitizeTelemetryEvent,
    dsn,
    sendDefaultPii: false,
    // Enable logs to be sent to Sentry
    enableLogs: true,
    // Define how likely traces are sampled. Adjust this value in production,
    // or use tracesSampler for greater control.
    tracesSampleRate: 1,
  });
}
