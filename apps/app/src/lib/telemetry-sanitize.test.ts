import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareTelemetryEvent } from "./telemetry-sanitize";

test("drops errors raised by an injected browser extension", () => {
  const event = {
    exception: {
      values: [
        {
          stacktrace: {
            frames: [{ filename: "app:///scripts/inpage.js" }],
          },
        },
      ],
    },
  };

  assert.equal(prepareTelemetryEvent(event), null);
});

test("keeps and sanitizes application errors", () => {
  const event = {
    exception: {
      values: [
        {
          stacktrace: {
            frames: [{ filename: "app:///onboarding" }],
          },
        },
      ],
    },
    request: {
      headers: { authorization: "Bearer secret", accept: "text/html" },
      url: "https://hackspain.app/onboarding?code=secret",
    },
  };

  assert.deepEqual(prepareTelemetryEvent(event), {
    exception: event.exception,
    request: {
      cookies: undefined,
      data: undefined,
      headers: { accept: "text/html" },
      query_string: undefined,
      url: "https://hackspain.app/onboarding",
    },
  });
});
