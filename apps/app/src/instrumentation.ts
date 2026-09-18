import { captureRequestError } from "@sentry/nextjs";

export async function register(): Promise<void> {
  if (!process.env.NEXT_PUBLIC_BETTER_STACK_ERRORS_DSN) {
    return;
  }
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = captureRequestError;
