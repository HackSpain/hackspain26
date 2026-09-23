import {
  browserTracingIntegration,
  init,
  replayIntegration,
} from "@sentry/astro";
import {
  isTokenPage,
  sanitizeBreadcrumb,
  sanitizeRecordingEvent,
  sanitizeTelemetryEvent,
} from "./telemetry-sanitize.js";

const dsn = import.meta.env.PUBLIC_BETTER_STACK_ERRORS_DSN;
const isDev = import.meta.env.DEV;

if (dsn) {
  const integrations = [
    browserTracingIntegration({
      tracePropagationTargets: [
        /^https?:\/\/localhost(:\d+)?/,
        /^https:\/\/(www\.)?hackspain\.com/,
        /^https:\/\/[^/]+\.vercel\.app$/,
      ],
    }),
    // Replay events skip `beforeSend`; an event processor is what they run through.
    { name: "TelemetrySanitizer", processEvent: sanitizeTelemetryEvent },
  ];
  // The recording's first event stores `location.href` and no hook can edit it,
  // so the pages reached through an emailed token link get no replay at all.
  const replayAllowed =
    !isDev &&
    typeof window !== "undefined" &&
    !isTokenPage(window.location.pathname);
  if (replayAllowed) {
    integrations.push(
      replayIntegration({
        beforeAddRecordingEvent: sanitizeRecordingEvent,
        block: ["[data-sentry-block]"],
        blockAllMedia: true,
        mask: ["[data-sentry-mask]", "input", "select", "textarea"],
        maskAllInputs: true,
        maskAllText: true,
      })
    );
  }

  init({
    beforeBreadcrumb: sanitizeBreadcrumb,
    beforeSendTransaction: sanitizeTelemetryEvent,
    dsn,
    sendDefaultPii: false,
    integrations,
    // Drop DOM error/rejection events mistaken for exceptions (e.g. script load failures).
    beforeSend(event, hint) {
      const ex = hint.originalException;
      if (ex instanceof Event) {
        return null;
      }
      return sanitizeTelemetryEvent(event);
    },
    // Enable logs to be sent to Sentry
    enableLogs: true,
    // Define how likely traces are sampled. Adjust this value in production,
    // or use tracesSampler for greater control.
    tracesSampleRate: 1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: isDev ? 0 : 1,
  });
}
