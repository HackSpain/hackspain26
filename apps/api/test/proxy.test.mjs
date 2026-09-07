import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../src/index.ts";

const env = {
  RAWTREE_API_KEY: "tracking-only-secret",
  RAWTREE_DATABASE: "test",
  RAWTREE_PROXY_TABLE: "hackspain_proxy_usage",
};

test("forwards original credentials and bodies for every provider; tracking excludes private data", async (t) => {
  for (const [provider, host, name, value] of [
    ["exa", "api.exa.ai", "x-api-key", "exa-private"],
    ["helmcode", "api.helmcode.com", "authorization", "Bearer helm-private"],
    ["quiverai", "api.quiver.ai", "authorization", "Bearer quiver-private"],
    ["fal", "queue.fal.run", "authorization", "Key fal-private"],
  ]) {
    const pending = [];
    let event;
    t.mock.method(globalThis, "fetch", async (url, init) => {
      if (url.hostname === "api.rawtree.com") {
        event = JSON.parse(init.body)[0];
        assert.equal(init.headers.Authorization, "Bearer tracking-only-secret");
        return Response.json({ inserted: 1 });
      }
      assert.equal(url.hostname, host);
      assert.equal(url.search, "?private=query-secret");
      assert.equal(init.headers.get(name), value);
      assert.equal(init.headers.get("cookie"), null);
      assert.equal(init.redirect, "manual");
      assert.equal(await new Response(init.body).text(), "private prompt");
      return new Response("original response", {
        status: 429,
        headers: { "retry-after": "7" },
      });
    });
    const response = await worker.fetch(
      new Request(
        `https://api.hackspain.com/${provider}/search?private=query-secret`,
        {
          method: "POST",
          headers: { [name]: value, cookie: "private-cookie" },
          body: "private prompt",
        }
      ),
      env,
      { waitUntil: (promise) => pending.push(promise) }
    );
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "7");
    assert.equal(await response.text(), "original response");
    await Promise.all(pending);
    assert.equal(event.provider, provider);
    assert.equal(event.operation, "/search");
    assert.equal(event.status, 429);
    const serialized = JSON.stringify(event);
    for (const secret of [
      value,
      "private prompt",
      "query-secret",
      "private-cookie",
      "tracking-only-secret",
    ]) {
      assert.equal(serialized.includes(secret), false);
    }
    t.mock.restoreAll();
  }
});

test("tracking retries preserve deduplication and never replace the provider response", async (t) => {
  const pending = [];
  const tokens = [];
  const errors = [];
  t.mock.method(console, "error", (message) => errors.push(message));
  t.mock.method(globalThis, "fetch", (url) => {
    if (url.hostname === "api.rawtree.com") {
      tokens.push(url.searchParams.get("insert_deduplication_token"));
      return Promise.resolve(new Response(null, { status: 503 }));
    }
    assert.equal(url.hostname, "api.exa.ai");
    return Promise.resolve(new Response("ok"));
  });
  const response = await worker.fetch(
    new Request("https://api.hackspain.com/exa//evil.example/private-id"),
    env,
    {
      waitUntil: (promise) => pending.push(promise),
    }
  );
  assert.equal(await response.text(), "ok");
  await Promise.all(pending);
  assert.equal(tokens.length, 2);
  assert.equal(tokens[0], tokens[1]);
  assert.equal(errors.length, 1);
});
