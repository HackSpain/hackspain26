type RequestTelemetry = {
  cookies?: unknown;
  data?: unknown;
  headers?: Record<string, string>;
  query_string?: unknown;
  url?: string;
};

type TelemetryEvent = {
  exception?: {
    values?: {
      stacktrace?: { frames?: { filename?: string }[] };
    }[];
  };
  request?: RequestTelemetry;
};

const PRIVATE_HEADERS = new Set(["authorization", "cookie", "set-cookie"]);
const EXTENSION_FRAME_PREFIXES = [
  "chrome-extension://",
  "moz-extension://",
  "safari-web-extension://",
];

function comesFromBrowserExtension(event: TelemetryEvent): boolean {
  return Boolean(
    event.exception?.values?.some((value) =>
      value.stacktrace?.frames?.some(({ filename = "" }) =>
        filename === "app:///scripts/inpage.js" ||
        EXTENSION_FRAME_PREFIXES.some((prefix) => filename.startsWith(prefix))
      )
    )
  );
}

/** Drop failures raised by injected browser extensions before error tracking. */
export function prepareTelemetryEvent<T extends TelemetryEvent>(
  event: T
): T | null {
  if (comesFromBrowserExtension(event)) {
    return null;
  }
  return sanitizeTelemetryEvent(event);
}

/** Keep errors useful without exporting auth codes, form bodies or sessions. */
export function sanitizeTelemetryEvent<T extends TelemetryEvent>(event: T): T {
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
      Object.entries(request.headers).filter(
        ([header]) => !PRIVATE_HEADERS.has(header.toLowerCase())
      )
    );
  }
  return event;
}
