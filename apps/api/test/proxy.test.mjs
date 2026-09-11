import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/index.ts";

test("Elysia leaves JSON and multipart bytes untouched and relays decoded responses", async (t) => {
  for (const [contentType, body] of [
    ["application/json", '{ "query": "hello" }'],
    [
      "multipart/form-data; boundary=example",
      "--example\r\nContent-Disposition: form-data; name=upload\r\n\r\nraw\u0000bytes\r\n--example--\r\n",
    ],
  ]) {
    t.mock.method(globalThis, "fetch", async (_url, init) => {
      assert.equal(init.headers.get("content-type"), contentType);
      assert.equal(await new Response(init.body).text(), body);
      assert.equal(init.duplex, "half");
      return new Response("decoded", {
        headers: { "content-encoding": "gzip", "content-length": "27" },
      });
    });
    const response = await createApp({}, (promise) => promise).handle(
      new Request("https://api.hackspain.com/exa/search", {
        method: "POST",
        headers: { "content-type": contentType },
        body,
      })
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "decoded");
    assert.equal(response.headers.get("content-encoding"), null);
    assert.equal(response.headers.get("content-length"), null);
    t.mock.restoreAll();
  }
});

const env = {
  RAWTREE_API_KEY: "tracking-only-secret",
  RAWTREE_DATABASE: "test",
  RAWTREE_PROXY_TABLE: "hackspain_proxy_usage",
};

test("fal routes sync, queue and legacy paths without changing credentials or tracking", async (t) => {
  for (const [path, host, upstreamPath, method, operation] of [
    [
      "/fal/run/fal-ai/flux/dev",
      "fal.run",
      "/fal-ai/flux/dev",
      "POST",
      "inference",
    ],
    [
      "/fal/queue/fal-ai/flux/dev",
      "queue.fal.run",
      "/fal-ai/flux/dev",
      "POST",
      "inference",
    ],
    [
      "/fal/fal-ai/flux/dev",
      "queue.fal.run",
      "/fal-ai/flux/dev",
      "POST",
      "inference",
    ],
    [
      "/fal/queue/fal-ai/flux/requests/id/status",
      "queue.fal.run",
      "/fal-ai/flux/requests/id/status",
      "GET",
      "queue.status",
    ],
    [
      "/fal/queue/fal-ai/flux/requests/id",
      "queue.fal.run",
      "/fal-ai/flux/requests/id",
      "GET",
      "queue.result",
    ],
    [
      "/fal/queue/fal-ai/flux/requests/id/cancel",
      "queue.fal.run",
      "/fal-ai/flux/requests/id/cancel",
      "PUT",
      "queue.cancel",
    ],
    [
      "/fal/run//evil.example/model",
      "fal.run",
      "//evil.example/model",
      "POST",
      "other",
    ],
    ["/fal/runner/model", "queue.fal.run", "/runner/model", "POST", "other"],
  ]) {
    const pending = [];
    let event;
    t.mock.method(globalThis, "fetch", async (url, init) => {
      if (url.hostname === "api.rawtree.com") {
        event = JSON.parse(init.body)[0];
        return Response.json({ inserted: 1 });
      }
      assert.equal(url.hostname, host);
      assert.equal(url.pathname, upstreamPath);
      assert.equal(url.search, "?logs=1");
      assert.equal(init.method, method);
      assert.equal(init.headers.get("authorization"), "Key participant-secret");
      if (method === "POST") {
        assert.equal(
          await new Response(init.body).text(),
          '{"prompt":"private"}'
        );
      }
      return new Response("provider result", { status: 202 });
    });
    const response = await createApp(env, (promise) =>
      pending.push(promise)
    ).handle(
      new Request(`https://api.hackspain.com${path}?logs=1`, {
        method,
        headers: {
          authorization: "Key participant-secret",
          "content-type": "application/json",
        },
        body: method === "POST" ? '{"prompt":"private"}' : undefined,
      })
    );
    assert.equal(response.status, 202);
    assert.equal(await response.text(), "provider result");
    await Promise.all(pending);
    assert.equal(event.provider, "fal");
    assert.equal(event.operation, operation);
    assert.equal(JSON.stringify(event).includes("participant-secret"), false);
    t.mock.restoreAll();
  }
});

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
    const app = createApp(env, (promise) => pending.push(promise));
    const response = await app.handle(
      new Request(
        `https://api.hackspain.com/${provider}/search?private=query-secret`,
        {
          method: "POST",
          headers: { [name]: value, cookie: "private-cookie" },
          body: "private prompt",
        }
      )
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
  const app = createApp(env, (promise) => pending.push(promise));
  const response = await app.handle(
    new Request("https://api.hackspain.com/exa//evil.example/private-id")
  );
  assert.equal(await response.text(), "ok");
  await Promise.all(pending);
  assert.equal(tokens.length, 2);
  assert.equal(tokens[0], tokens[1]);
  assert.equal(errors.length, 1);
});
