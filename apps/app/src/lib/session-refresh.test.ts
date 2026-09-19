import assert from "node:assert/strict";
import { test } from "node:test";
import { recoveringTokenFetcher, waitForSessionRetry } from "./session-refresh";

const force = { forceRefreshToken: true };

test("an outage beyond the SDK retries recovers without returning an unauthenticated token", async () => {
  let attempts = 0;
  let reports = 0;
  let waits = 0;
  const recovery = recoveringTokenFetcher(async () => {
    if (++attempts <= 3) { throw new TypeError("Failed to fetch"); }
    return "renewed-token";
  }, () => { reports++; }, async () => { waits++; });
  assert.equal(await recovery.fetch(force), "renewed-token");
  assert.equal(attempts, 4);
  assert.equal(waits, 3);
  assert.equal(reports, 1);
});

test("concurrent forced refreshes share recovery and still delegate to the SDK", async () => {
  let calls = 0;
  let resume!: () => void;
  const recovery = recoveringTokenFetcher(async () => {
    if (++calls === 1) { throw new TypeError("Load failed"); }
    return "renewed-token";
  }, () => {}, () => new Promise<void>((resolve) => { resume = resolve; }));
  const first = recovery.fetch(force);
  const second = recovery.fetch(force);
  assert.equal(first, second);
  await Promise.resolve();
  resume();
  assert.deepEqual(await Promise.all([first, second]), ["renewed-token", "renewed-token"]);
  assert.equal(calls, 2);
});

test("logout or unmount cancels recovery and a subsequent login can refresh", async () => {
  let calls = 0;
  const recovery = recoveringTokenFetcher(async () => {
    if (++calls === 1) { throw new TypeError("Failed to fetch"); }
    return "new-session-token";
  }, () => {}, (signal) => new Promise<void>((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  }));
  const pending = recovery.fetch(force);
  await Promise.resolve();
  recovery.cancel();
  assert.equal(await pending, null);
  assert.equal(calls, 1);
  assert.equal(await recovery.fetch(force), "new-session-token");
});

test("invalid sessions and non-network errors retain the SDK outcome without retries", async () => {
  const wait = async () => { assert.fail("must not retry"); };
  const report = () => { assert.fail("must not classify as transport loss"); };
  assert.equal(await recoveringTokenFetcher(async () => null, report, wait).fetch(force), null);
  for (const error of [new Error("Invalid refresh token"), new Error("HTTP 429"), new TypeError("bug in app")]) {
    const recovery = recoveringTokenFetcher(async () => { throw error; }, report, wait);
    await assert.rejects(recovery.fetch(force), (actual) => actual === error);
  }
});

test("cached token reads do not start a refresh", async () => {
  const recovery = recoveringTokenFetcher(async (args) => {
    assert.equal(args.forceRefreshToken, false);
    return "cached-token";
  }, () => {});
  assert.equal(await recovery.fetch({ forceRefreshToken: false }), "cached-token");
});

test("retry wait wakes on connectivity and releases listeners when cancelled", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const target = new EventTarget();
  let listeners = 0;
  const add = target.addEventListener.bind(target);
  const remove = target.removeEventListener.bind(target);
  target.addEventListener = (...args) => { listeners++; add(...args); };
  target.removeEventListener = (...args) => { listeners--; remove(...args); };
  Object.defineProperty(globalThis, "window", { value: target, configurable: true });
  try {
    const online = waitForSessionRetry(new AbortController().signal);
    target.dispatchEvent(new Event("online"));
    await online;
    assert.equal(listeners, 0);
    const controller = new AbortController();
    const cancelled = waitForSessionRetry(controller.signal);
    controller.abort();
    await cancelled;
    assert.equal(listeners, 0);
    await waitForSessionRetry(controller.signal);
    assert.equal(listeners, 0);
  } finally {
    if (original) { Object.defineProperty(globalThis, "window", original); }
    else { Reflect.deleteProperty(globalThis, "window"); }
  }
});


test("a cancelled in-flight response cannot replace a newer recovery", async () => {
  const complete: ((token: string) => void)[] = [];
  const recovery = recoveringTokenFetcher(() => new Promise<string>((resolve) => { complete.push(resolve); }), () => {});
  const previous = recovery.fetch(force);
  recovery.cancel();
  const current = recovery.fetch(force);
  complete[0]("old-session-token");
  assert.equal(await previous, null);
  assert.equal(recovery.fetch(force), current);
  complete[1]("new-session-token");
  assert.equal(await current, "new-session-token");
});
