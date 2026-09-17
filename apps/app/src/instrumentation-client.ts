import {
  captureRouterTransitionStart,
  init,
  replayIntegration,
} from "@sentry/nextjs";
import { sanitizeTelemetryEvent } from "@/lib/telemetry-sanitize";

const dsn = process.env.NEXT_PUBLIC_BETTER_STACK_ERRORS_DSN;

if (dsn) {
  init({
    dsn,
    beforeSend: sanitizeTelemetryEvent,
    beforeSendTransaction: sanitizeTelemetryEvent,
    integrations: [
      replayIntegration({
        block: ["[data-sentry-block]"],
        blockAllMedia: true,
        mask: ["[data-sentry-mask]", "input", "select", "textarea"],
        maskAllInputs: true,
        maskAllText: true,
      }),
    ],
    replaysOnErrorSampleRate: 1,
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
    tracesSampleRate: 1,
  });
}

export const onRouterTransitionStart = captureRouterTransitionStart;
