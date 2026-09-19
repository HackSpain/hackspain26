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

test("redacts auth handoff values from breadcrumbs", () => {
  const event = {
    breadcrumbs: [
      {
        category: "navigation",
        data: {
          from: "/cli-auth?hs-code=secret-code",
          to: "/cli-auth/handoff?hs-token=secret-token&step=done",
        },
      },
      {
        category: "fetch",
        data: {
          url: "https://storage.example/file?token=storage-token&width=80",
        },
        message: "GET /callback?code=oauth-code",
      },
    ],
  };

  assert.deepEqual(prepareTelemetryEvent(event), {
    breadcrumbs: [
      {
        category: "navigation",
        data: {
          from: "/cli-auth?hs-code=[Filtered]",
          to: "/cli-auth/handoff?hs-token=[Filtered]&step=done",
        },
      },
      {
        category: "fetch",
        data: {
          url: "https://storage.example/file?token=[Filtered]&width=80",
        },
        message: "GET /callback?code=[Filtered]",
      },
    ],
  });
});
