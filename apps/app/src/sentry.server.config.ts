import { init } from "@sentry/nextjs";
import { sanitizeTelemetryEvent } from "@/lib/telemetry-sanitize";

const dsn = process.env.NEXT_PUBLIC_BETTER_STACK_ERRORS_DSN;

if (dsn) {
  init({
    dsn,
    beforeSend: sanitizeTelemetryEvent,
    beforeSendTransaction: sanitizeTelemetryEvent,
    sendDefaultPii: false,
    tracesSampleRate: 1,
  });
}
