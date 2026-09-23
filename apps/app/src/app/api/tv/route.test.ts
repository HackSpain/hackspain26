import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ConvexError } from "convex/values";
import { SCREEN_MAX_DIMENSION, SCREEN_URL_MAX_LENGTH } from "@convex/lib/tvScreens";

process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";

const mutate = mock(async (..._args: unknown[]): Promise<unknown> => ({
  preset: "entradas", message: "", revision: 0, reloadVersion: 0,
}));

mock.module("convex/browser", () => ({
  ConvexHttpClient: class {
    mutation = mutate;
    query = mock(async () => ({}));
  },
}));

const { POST } = await import("./route");

const valid = {
  key: "Entrada", clientId: "client-1234567890", url: "https://hackspain.app/tv?screen=entrada&token=private",
  initialPreset: "entradas", width: 2560, height: 1080, receivedRevision: 0, receivedReloadVersion: 0,
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/tv", {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

beforeEach(() => {
  mutate.mockClear();
  mutate.mockImplementation(async () => ({ preset: "entradas", message: "", revision: 0, reloadVersion: 0 }));
});

describe("public TV heartbeat route", () => {
  test("forwards a valid heartbeat with the normalized screen name", async () => {
    const response = await POST(request(valid));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ preset: "entradas", message: "", revision: 0, reloadVersion: 0 });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]?.[1]).toEqual({ ...valid, key: "entrada" });
  });

  test("refuses sizes and counters that are not safe integers within range before calling Convex", async () => {
    const cases: Record<string, unknown>[] = [
      { width: -1 }, { height: 1.5 }, { width: SCREEN_MAX_DIMENSION + 1 }, { height: 1e308 }, { width: "2560" },
      { width: null }, { receivedRevision: -1 }, { receivedReloadVersion: 0.5 }, { receivedRevision: Number.MAX_SAFE_INTEGER + 2 },
    ];
    for (const patch of cases) {
      const response = await POST(request({ ...valid, ...patch }));
      expect(response.status).toBe(400);
    }
    expect(mutate).not.toHaveBeenCalled();
    expect((await POST(request({ ...valid, width: 0, height: SCREEN_MAX_DIMENSION }))).status).toBe(200);
  });

  test("refuses bad URLs, names and client ids with 400", async () => {
    const cases: Record<string, unknown>[] = [
      { url: "not a url" }, { url: "ftp://hackspain.app/tv" }, { url: "https://hackspain.app/admin/tv" },
      { url: `https://hackspain.app/tv?x=${"a".repeat(SCREEN_URL_MAX_LENGTH)}` },
      { key: "bad/name" }, { key: "" }, { key: "x".repeat(49) }, { clientId: "short" }, { clientId: "with spaces 1234567890" },
    ];
    for (const patch of cases) {
      const response = await POST(request({ ...valid, ...patch }));
      expect(response.status).toBe(400);
    }
    expect(mutate).not.toHaveBeenCalled();
  });

  test("refuses oversized and malformed bodies", async () => {
    expect((await POST(request(`{"pad":"${"x".repeat(4096)}"}`))).status).toBe(400);
    expect((await POST(request("{not json"))).status).toBe(400);
    expect((await POST(request("null"))).status).toBe(400);
    expect(mutate).not.toHaveBeenCalled();
  });

  test("maps the screen cap to 429 with its message and other failures to 503", async () => {
    mutate.mockImplementation(async () => {
      throw new ConvexError({ code: "SCREEN_LIMIT", message: "Ya hay 50 pantallas registradas." });
    });
    const capped = await POST(request(valid));
    expect(capped.status).toBe(429);
    expect(await capped.json()).toEqual({ error: "Ya hay 50 pantallas registradas." });

    mutate.mockImplementation(async () => { throw new Error("boom"); });
    const down = await POST(request(valid));
    expect(down.status).toBe(503);
    expect(down.headers.get("Cache-Control")).toBe("no-store");
  });
});
