const PRIVATE_HEADERS = new Set(["authorization", "cookie", "set-cookie"]);
const URL_HEADERS = new Set(["referer", "referrer"]);

/**
 * Query parameters whose value grants an action on its own: the signup
 * management token, the pre-signup token and the dashboard's auth handoff.
 * The value is replaced wherever the parameter shows up, at the start of a
 * bare query string included.
 */
const PRIVATE_QUERY_PARAMETER =
  /(^|[?&])(token|pre_signup_token|code|hs-code|hs-token)=[^&#\s]*/gi;

/**
 * Pages opened from an emailed link whose query is the credential itself.
 * Their whole query string is dropped, whatever the parameter is called.
 */
const TOKEN_PAGE_PATH = /^\/(?:confirmacion|cancelacion)\/?$/;
const TOKEN_PAGE_URL_QUERY =
  /(^|\s)((?:https?:\/\/[^/?#\s]+)?\/(?:confirmacion|cancelacion)\/?)\?[^#\s]*/gi;

/** Whether the landing page at `pathname` is reached through a token link. */
export function isTokenPage(pathname) {
  return TOKEN_PAGE_PATH.test(pathname);
}

/** Redact the credentials a URL, path or query string may carry. */
export function redactUrl(value) {
  return value
    .replace(TOKEN_PAGE_URL_QUERY, "$1$2")
    .replace(PRIVATE_QUERY_PARAMETER, "$1$2=[Filtered]");
}

function redactStringValues(record) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      typeof value === "string" ? redactUrl(value) : value,
    ])
  );
}

/** `beforeBreadcrumb` hook: navigation, fetch and console breadcrumbs carry URLs. */
export function sanitizeBreadcrumb(breadcrumb) {
  if (typeof breadcrumb.message === "string") {
    breadcrumb.message = redactUrl(breadcrumb.message);
  }
  if (breadcrumb.data && typeof breadcrumb.data === "object") {
    breadcrumb.data = redactStringValues(breadcrumb.data);
  }
  return breadcrumb;
}

/**
 * Replay `beforeAddRecordingEvent` hook. It only receives rrweb custom events
 * (breadcrumbs and performance spans), whose payload repeats the page and
 * request URLs. The recording's first event stores `location.href` outside
 * this hook, so replay must not start on a token page at all.
 */
export function sanitizeRecordingEvent(event) {
  const payload = event.data?.payload;
  if (!payload || typeof payload !== "object") {
    return event;
  }
  if (typeof payload.message === "string") {
    payload.message = redactUrl(payload.message);
  }
  if (typeof payload.description === "string") {
    payload.description = redactUrl(payload.description);
  }
  if (payload.data && typeof payload.data === "object") {
    payload.data = redactStringValues(payload.data);
  }
  return event;
}

/**
 * Keep errors, transactions and replay events useful without exporting auth
 * codes, management tokens, form bodies or sessions. Runs as `beforeSend`,
 * `beforeSendTransaction` and as an event processor, so it must be idempotent.
 */
export function sanitizeTelemetryEvent(event) {
  for (const breadcrumb of event.breadcrumbs ?? []) {
    sanitizeBreadcrumb(breadcrumb);
  }
  if (typeof event.transaction === "string") {
    event.transaction = redactUrl(event.transaction);
  }
  const traceData = event.contexts?.trace?.data;
  if (traceData && typeof traceData === "object") {
    event.contexts.trace.data = redactStringValues(traceData);
  }
  for (const span of event.spans ?? []) {
    if (typeof span.description === "string") {
      span.description = redactUrl(span.description);
    }
    if (span.data && typeof span.data === "object") {
      span.data = redactStringValues(span.data);
    }
  }
  if (Array.isArray(event.urls)) {
    event.urls = event.urls.map((url) =>
      typeof url === "string" ? redactUrl(url) : url
    );
  }

  const request = event.request;
  if (!request) {
    return event;
  }

  request.cookies = undefined;
  request.data = undefined;
  request.query_string = undefined;
  if (request.url) {
    request.url = request.url.split("?", 1)[0];
  }
  if (request.headers) {
    request.headers = Object.fromEntries(
      Object.entries(request.headers)
        .filter(([header]) => !PRIVATE_HEADERS.has(header.toLowerCase()))
        .map(([header, value]) => [
          header,
          URL_HEADERS.has(header.toLowerCase()) && typeof value === "string"
            ? value.split("?", 1)[0]
            : value,
        ])
    );
  }
  return event;
}
