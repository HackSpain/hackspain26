import {
  browserTracingIntegration,
  init,
  replayIntegration,
} from "@sentry/astro";

const dsn = import.meta.env.PUBLIC_SENTRY_DSN;
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
  ];
  if (!isDev) {
    integrations.push(
      replayIntegration({
        block: ["[data-sentry-block]"],
        blockAllMedia: true,
        mask: ["[data-sentry-mask]", "input", "select", "textarea"],
        maskAllInputs: true,
        maskAllText: true,
      })
    );
  }

  init({
    dsn,
    sendDefaultPii: false,
    integrations,
    // Drop DOM error/rejection events mistaken for exceptions (e.g. script load failures).
    beforeSend(event, hint) {
      const ex = hint.originalException;
      if (ex instanceof Event) {
        return null;
      }
      return event;
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
