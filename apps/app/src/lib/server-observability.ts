import "server-only";

export type ServerLogLevel = "error" | "warn";

/** Await delivery before Vercel can freeze, and retain failed deliveries in runtime logs. */
export async function reportServerEvent(
  level: ServerLogLevel,
  message: string,
  fields: Readonly<Record<string, unknown>> = {}
): Promise<void> {
  const logLevel = process.env.NEXT_PUBLIC_BETTER_STACK_LOG_LEVEL;
  if (logLevel === "off" || (logLevel === "error" && level === "warn")) {
    return;
  }
  const event = {
    dt: new Date().toISOString(),
    level,
    message,
    source: "dashboard",
    fields,
    vercel: {
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      region: process.env.VERCEL_REGION,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
      deploymentUrl: process.env.NEXT_PUBLIC_VERCEL_URL,
      project: process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
      git: {
        commit: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
        repo: process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG,
        ref: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF,
      },
      source: "dashboard",
    },
  };
  const fallback = (reason: string, status?: number): void => {
    // Never include the delivery exception, response body, URL or source token.
    console[level]("[observability]", {
      ...event,
      delivery: { destination: "better-stack", reason, status },
    });
  };
  const token =
    process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN ||
    process.env.BETTER_STACK_SOURCE_TOKEN ||
    process.env.NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN ||
    process.env.LOGTAIL_SOURCE_TOKEN;
  const url =
    process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_URL ||
    process.env.BETTER_STACK_INGESTING_URL ||
    process.env.NEXT_PUBLIC_LOGTAIL_URL ||
    process.env.LOGTAIL_URL;
  if (!token || !url) {
    fallback("unconfigured");
    return;
  }
  try {
    // @logtail/next's flush resolves on HTTP failures and swallows fetch errors.
    // Send its log-array shape directly so acceptance is checked explicitly.
    const response = await fetch(url, {
      body: JSON.stringify([event]),
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(3000),
    });
    await response.body?.cancel();
    if (!response.ok) {
      fallback("http_error", response.status);
    }
  } catch (error) {
    fallback(
      error instanceof Error && error.name === "TimeoutError" ? "timeout" : "delivery_error"
    );
  }
}
