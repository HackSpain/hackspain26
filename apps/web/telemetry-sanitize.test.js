import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isTokenPage,
  redactUrl,
  sanitizeBreadcrumb,
  sanitizeRecordingEvent,
  sanitizeTelemetryEvent,
} from "./telemetry-sanitize.js";

test("drops the whole query on the token pages", () => {
  assert.equal(
    redactUrl("https://hackspain.com/confirmacion?token=abc-123"),
    "https://hackspain.com/confirmacion"
  );
  assert.equal(
    redactUrl("/cancelacion?pre_signup_token=abc-123&utm_source=mail#top"),
    "/cancelacion#top"
  );
  assert.equal(redactUrl("/cancelacion/?anything=goes"), "/cancelacion/");
});

test("redacts the known parameters anywhere else", () => {
  assert.equal(
    redactUrl("https://hackspain.com/otra?token=abc&x=1"),
    "https://hackspain.com/otra?token=[Filtered]&x=1"
  );
  assert.equal(
    redactUrl("pre_signup_token=abc&token=def"),
    "pre_signup_token=[Filtered]&token=[Filtered]"
  );
  assert.equal(
    redactUrl("GET /callback?code=oauth&hs-token=secret"),
    "GET /callback?code=[Filtered]&hs-token=[Filtered]"
  );
  assert.equal(redactUrl("/signup?ref=amigo"), "/signup?ref=amigo");
});

test("knows which landing pages carry a token", () => {
  assert.equal(isTokenPage("/confirmacion"), true);
  assert.equal(isTokenPage("/cancelacion/"), true);
  assert.equal(isTokenPage("/signup"), false);
  assert.equal(isTokenPage("/confirmacion-extra"), false);
});

test("redacts breadcrumb messages and string data", () => {
  const breadcrumb = sanitizeBreadcrumb({
    category: "navigation",
    data: {
      count: 2,
      from: "/confirmacion?token=abc",
      to: "/comparte?token=def&n=1",
    },
    message: "GET /cancelacion?pre_signup_token=abc",
  });

  assert.deepEqual(breadcrumb, {
    category: "navigation",
    data: {
      count: 2,
      from: "/confirmacion",
      to: "/comparte?token=[Filtered]&n=1",
    },
    message: "GET /cancelacion",
  });
});

test("redacts replay custom events and leaves other recording events alone", () => {
  const span = sanitizeRecordingEvent({
    data: {
      payload: {
        data: { from: "/cancelacion?token=abc", to: "/comparte?token=def" },
        description: "https://hackspain.com/confirmacion?token=abc",
        op: "navigation.push",
      },
      tag: "performanceSpan",
    },
    type: 5,
  });
  assert.deepEqual(span.data.payload, {
    data: { from: "/cancelacion", to: "/comparte?token=[Filtered]" },
    description: "https://hackspain.com/confirmacion",
    op: "navigation.push",
  });

  const meta = { data: { height: 1, href: "x", width: 1 }, type: 4 };
  assert.equal(sanitizeRecordingEvent(meta), meta);
});

test("sanitizes request, breadcrumbs, trace, spans and replay urls", () => {
  const event = sanitizeTelemetryEvent({
    breadcrumbs: [
      {
        category: "fetch",
        data: { method: "GET", url: "https://hackspain.com/api/x?token=abc" },
      },
    ],
    contexts: {
      trace: {
        data: {
          "http.request.header.referer":
            "https://hackspain.com/cancelacion?token=abc",
          "sentry.source": "url",
          "url.full": "https://hackspain.com/confirmacion?token=abc",
          "url.query": "token=abc",
        },
        op: "pageload",
      },
    },
    request: {
      cookies: { session: "x" },
      data: { fullName: "Ana" },
      headers: {
        Accept: "text/html",
        Cookie: "session=x",
        Referer: "https://hackspain.com/cancelacion?pre_signup_token=abc",
      },
      query_string: "token=abc",
      url: "https://hackspain.com/confirmacion?token=abc",
    },
    spans: [
      {
        data: { "http.method": "GET", "http.query": "token=abc" },
        description: "GET https://hackspain.com/api/badge?token=abc",
      },
    ],
    transaction: "/confirmacion?token=abc",
    type: "replay_event",
    urls: [
      "https://hackspain.com/confirmacion?token=abc",
      "https://hackspain.com/comparte?token=def",
    ],
  });

  assert.deepEqual(event, {
    breadcrumbs: [
      {
        category: "fetch",
        data: {
          method: "GET",
          url: "https://hackspain.com/api/x?token=[Filtered]",
        },
      },
    ],
    contexts: {
      trace: {
        data: {
          "http.request.header.referer": "https://hackspain.com/cancelacion",
          "sentry.source": "url",
          "url.full": "https://hackspain.com/confirmacion",
          "url.query": "token=[Filtered]",
        },
        op: "pageload",
      },
    },
    request: {
      cookies: undefined,
      data: undefined,
      headers: {
        Accept: "text/html",
        Referer: "https://hackspain.com/cancelacion",
      },
      query_string: undefined,
      url: "https://hackspain.com/confirmacion",
    },
    spans: [
      {
        data: { "http.method": "GET", "http.query": "token=[Filtered]" },
        description: "GET https://hackspain.com/api/badge?token=[Filtered]",
      },
    ],
    transaction: "/confirmacion",
    type: "replay_event",
    urls: [
      "https://hackspain.com/confirmacion",
      "https://hackspain.com/comparte?token=[Filtered]",
    ],
  });
});

test("is idempotent and keeps events without request data intact", () => {
  const event = { exception: { values: [{ type: "Error" }] } };
  assert.deepEqual(sanitizeTelemetryEvent(sanitizeTelemetryEvent(event)), {
    exception: { values: [{ type: "Error" }] },
  });
});
