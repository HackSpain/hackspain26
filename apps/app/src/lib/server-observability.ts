import "server-only";

import { Logger } from "@logtail/next";

export type ServerLogLevel = "error" | "warn";

/** Flush each event because Vercel functions can freeze immediately after responding. */
export async function reportServerEvent(
  level: ServerLogLevel,
  message: string,
  fields: Readonly<Record<string, unknown>> = {}
): Promise<void> {
  try {
    const logger = new Logger({ autoFlush: false, source: "dashboard" });
    logger[level](message, fields);
    await logger.flush();
  } catch (error) {
    console.warn(`[observability] ${message}`, error);
  }
}
