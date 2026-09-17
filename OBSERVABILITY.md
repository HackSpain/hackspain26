# Better Stack observability

HackSpain uses Better Stack as the observability backend. The Sentry packages
remain intentionally: Better Stack Errors accepts the Sentry envelope protocol,
so the existing SDK instrumentation, source maps and privacy controls can be
kept without retaining Sentry as a provider.

## Better Stack resources

Create these resources in the Better Stack team:

1. Three Errors applications, one for `hackspain.com`, one for
   `hackspain.app` and one for the Convex backend.
2. One Telemetry JavaScript/Next.js source for `hackspain.app` logs and Web
   Vitals.
3. Vercel log drains for both Vercel projects. The drain captures platform and
   function logs; application events that need stable fields should still use
   the structured dashboard logger.
4. Uptime monitors for `https://hackspain.com/` and
   `https://hackspain.app/api/tv`. The second check also exercises the public
   Convex dependency and returns `503` when it is unavailable.

## Convex errors

Convex runs outside Vercel, so the web SDK and Vercel drains cannot observe
backend exceptions there. On every production and preview deployment, open
**Deployment Settings -> Integrations -> Sentry** and paste the DSN from the
Convex Better Stack Errors application. Better Stack accepts the Sentry
protocol used by Convex. Convex's exception-reporting integration requires a
Professional plan.

This sends failed query, mutation, action and HTTP-action exceptions, including
their server stack, function name, request ID and deployment metadata. It does
not stream successful executions, `console.*` output or scheduler statistics;
those require a separate Convex Log Stream and are intentionally outside this
integration.

The CLI is deliberately excluded. Do not send local CLI output, prompts, code,
paths, environment variables or credentials to Better Stack.

## Vercel environment

Set the following separately on each Vercel project. Values come from
**Errors → Applications → Ingest/Advanced settings**:

```text
PUBLIC_BETTER_STACK_ERRORS_DSN       # Astro landing only
NEXT_PUBLIC_BETTER_STACK_ERRORS_DSN  # Next.js dashboard only
BETTER_STACK_API_TOKEN               # server-only source-map upload token
BETTER_STACK_ERRORS_ORG
BETTER_STACK_ERRORS_PROJECT
BETTER_STACK_SOURCEMAPS_URL
```

The dashboard also needs the values from its Telemetry source:

```text
NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN
NEXT_PUBLIC_BETTER_STACK_INGESTING_URL
NEXT_PUBLIC_BETTER_STACK_PROXY_PATH=/betterstack
NEXT_PUBLIC_BETTER_STACK_LOG_LEVEL=info
```

The source token is public by design in Better Stack's Next.js client. Browser
events are sent through `/betterstack/*`; the route always returns `204` if the
upstream is slow or unavailable, so observability cannot break the dashboard.

Do not add Better Stack's standalone JavaScript tag while the Sentry-compatible
SDK is loaded. The tag embeds another Sentry browser SDK and Better Stack warns
that running both on one page can corrupt events.

## Data handling

- Default PII collection is disabled.
- Error events discard query strings, cookies, request bodies and auth/cookie
  headers. This protects OTPs, CLI handoff tokens and signup management links.
- Replay is disabled for normal sessions and enabled only around an error.
  Inputs and text are masked and media is blocked.
- Structured server logs must never include email addresses, bearer tokens,
  request bodies or participant telemetry payloads.

## Cutover

Set the Better Stack variables on Vercel Preview first. Verify a browser error,
a server error, a replay, source maps, a structured dashboard warning and Web
Vitals there. Then copy the variables to Production, deploy, remove the old
`PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN` variables, and disable ingestion in
the old Sentry project. Keep the old project available until its retained error
history is no longer useful.
