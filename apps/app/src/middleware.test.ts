import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
// Next statically reads this literal too. Reading it avoids loading the
// server-only auth runtime while exercising Next's actual matching engine.
const source = readFileSync(
  new URL("middleware.ts", import.meta.url),
  "utf8"
);
const matcher = source.match(/matcher:\s*(\[[\s\S]*?\])/);
assert.ok(matcher, "Middleware must declare a static matcher");
const config = {
  matcher: JSON.parse(matcher[1].replace(/,\s*\]/, "]")) as string[],
};

test("middleware protects dotted page paths and every API path", () => {
  for (const path of [
    "/",
    "/submit",
    "/people/first.last",
    "/people/first.last/edit",
    "/api/private.json",
    "/api/files/avatar.png",
  ]) {
    assert.equal(
      unstable_doesMiddlewareMatch({
        config,
        url: `https://hackspain.app${path}`,
      }),
      true,
      path
    );
  }
});

test("middleware skips Next internals and static asset extensions", () => {
  for (const path of [
    "/_next/static/chunks/app.js",
    "/_next/image?url=logo.svg",
    "/logo.svg",
    "/sponsors/tv/cursor.svg",
    "/fonts/bungee.woff2",
    "/favicon.ico",
  ]) {
    assert.equal(
      unstable_doesMiddlewareMatch({
        config,
        url: `https://hackspain.app${path}`,
      }),
      false,
      path
    );
  }
});
