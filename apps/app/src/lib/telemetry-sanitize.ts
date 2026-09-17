type RequestTelemetry = {
  cookies?: unknown;
  data?: unknown;
  headers?: Record<string, string>;
  query_string?: unknown;
  url?: string;
};

type TelemetryEvent = {
  request?: RequestTelemetry;
};

const PRIVATE_HEADERS = new Set(["authorization", "cookie", "set-cookie"]);

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
