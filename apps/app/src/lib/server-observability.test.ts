import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";

mock.module("server-only", () => ({}));
const { reportServerEvent } = await import("./server-observability");

const ENV = [
  "NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN", "BETTER_STACK_SOURCE_TOKEN",
  "NEXT_PUBLIC_LOGTAIL_SOURCE_TOKEN", "LOGTAIL_SOURCE_TOKEN",
  "NEXT_PUBLIC_BETTER_STACK_INGESTING_URL", "BETTER_STACK_INGESTING_URL",
  "NEXT_PUBLIC_LOGTAIL_URL", "LOGTAIL_URL",
  "NEXT_PUBLIC_BETTER_STACK_LOG_LEVEL",
] as const;
const original = Object.fromEntries(ENV.map((name) => [name, process.env[name]]));

beforeEach(() => {
  for (const name of ENV) {
    delete process.env[name];
  }
  process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN = "private-source-token";
  process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_URL = "https://logs.example.test";
});

afterEach(() => {
  mock.restore();
  for (const name of ENV) {
    if (original[name] === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = original[name];
    }
  }
});

test("awaits accepted delivery and preserves the structured log fields", async () => {
  const errorLog = spyOn(console, "error").mockImplementation(() => {});
  const request = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 202 }));

  await reportServerEvent("error", "RawTree OTLP logs export failed", { batchSize: 20 });

  expect(request).toHaveBeenCalledTimes(1);
  const [url, init] = request.mock.calls[0] ?? [];
  expect(url).toBe("https://logs.example.test");
  expect(new Headers(init?.headers).get("authorization")).toBe("Bearer private-source-token");
  expect(init?.signal).toBeInstanceOf(AbortSignal);
  expect(JSON.parse(String(init?.body))).toEqual([expect.objectContaining({
    level: "error", message: "RawTree OTLP logs export failed", source: "dashboard", fields: { batchSize: 20 },
  })]);
  expect(errorLog).not.toHaveBeenCalled();
});

test("retains HTTP rejections in runtime logs without leaking transport secrets", async () => {
  const errorLog = spyOn(console, "error").mockImplementation(() => {});
  const request = spyOn(globalThis, "fetch");
  for (const status of [401, 429, 503]) {
    request.mockResolvedValueOnce(new Response("sensitive remote response", { status }));
    await reportServerEvent("error", "export failed", { batchSize: 20 });
    expect(errorLog).toHaveBeenLastCalledWith("[observability]", expect.objectContaining({
      level: "error", message: "export failed", fields: { batchSize: 20 },
      delivery: { destination: "better-stack", reason: "http_error", status },
    }));
  }
  expect(errorLog).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(errorLog.mock.calls)).not.toContain("private-source-token");
  expect(JSON.stringify(errorLog.mock.calls)).not.toContain("sensitive remote response");
});

test("network failures and timeouts preserve the original warning without throwing", async () => {
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  const request = spyOn(globalThis, "fetch");
  for (const [error, reason] of [
    [new Error("https://logs.example.test?token=secret"), "delivery_error"],
    [new DOMException("private timeout details", "TimeoutError"), "timeout"],
  ] as const) {
    request.mockRejectedValueOnce(error);
    await reportServerEvent("warn", "upstream failure", { kind: "network" });
    expect(warn).toHaveBeenLastCalledWith("[observability]", expect.objectContaining({
      level: "warn", message: "upstream failure", fields: { kind: "network" },
      delivery: { destination: "better-stack", reason, status: undefined },
    }));
  }
  expect(warn).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(warn.mock.calls)).not.toContain("secret");
  expect(JSON.stringify(warn.mock.calls)).not.toContain("private timeout details");
});

test("missing delivery configuration keeps the event locally without a request", async () => {
  delete process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN;
  const request = spyOn(globalThis, "fetch");
  const warn = spyOn(console, "warn").mockImplementation(() => {});

  await reportServerEvent("warn", "configuration missing", { kind: "diagnostic" });

  expect(request).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith("[observability]", expect.objectContaining({
    message: "configuration missing", fields: { kind: "diagnostic" },
    delivery: { destination: "better-stack", reason: "unconfigured", status: undefined },
  }));
});

test("a stalled delivery is aborted and falls back before the reporter returns", async () => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
    expect(milliseconds).toBe(3000);
    return timeout(10);
  });
  const errorLog = spyOn(console, "error").mockImplementation(() => {});
  spyOn(globalThis, "fetch").mockImplementation((_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  }));

  await reportServerEvent("error", "export stalled");

  expect(errorLog).toHaveBeenCalledWith("[observability]", expect.objectContaining({
    message: "export stalled",
    delivery: { destination: "better-stack", reason: "timeout", status: undefined },
  }));
});

test("retains the configured severity filter", async () => {
  const request = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 202 }));
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  const errorLog = spyOn(console, "error").mockImplementation(() => {});
  process.env.NEXT_PUBLIC_BETTER_STACK_LOG_LEVEL = "off";
  await reportServerEvent("error", "disabled");
  process.env.NEXT_PUBLIC_BETTER_STACK_LOG_LEVEL = "error";
  await reportServerEvent("warn", "below threshold");
  expect(request).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
  expect(errorLog).not.toHaveBeenCalled();
  await reportServerEvent("error", "enabled");
  expect(request).toHaveBeenCalledTimes(1);
});
