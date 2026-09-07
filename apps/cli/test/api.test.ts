import { describe, expect, test } from "bun:test";
import {
  api,
  authVerify,
  createClient,
  functionName,
  makeRefresh,
} from "../src/lib/api";
import { RemoteError } from "../src/lib/errors";

type Call = { url: string; body: unknown; auth: string | null };

function fakeFetch(
  handler: (call: Call) => { status: number; body: unknown }
): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (
    input: string | URL | Request,
    init?: RequestInit
  ) => {
    const headers = new Headers(init?.headers);
    const call = {
      auth: headers.get("authorization"),
      body: JSON.parse(String(init?.body ?? "null")),
      url: String(input),
    };
    calls.push(call);
    const { status, body } = handler(call);
    return Response.json(body, {
      headers: { "content-type": "application/json" },
      status,
    });
  }) as typeof fetch;
  return { calls, fetch: fetchImpl };
}

describe("api proxy", () => {
  test("turns api.module.fn into the Convex function name", () => {
    expect(functionName(api.teams.mine)).toBe("teams:mine");
    expect(functionName(api.users.attachAfterLogin)).toBe(
      "users:attachAfterLogin"
    );
    expect(() => functionName({})).toThrow("Invalid function reference");
  });
});

describe("createClient", () => {
  test("posts { name, args } with the bearer token and unwraps the value", async () => {
    const { fetch, calls } = fakeFetch(() => ({
      body: { ok: true, value: { _id: "u1" } },
      status: 200,
    }));
    const client = createClient("https://app.test", async () => "tok", fetch);
    const me = await client.query(api.users.me, {});
    expect(me).toEqual({ _id: "u1" } as never);
    expect(calls[0]).toEqual({
      auth: "Bearer tok",
      body: { args: {}, name: "users:me" },
      url: "https://app.test/api/cli/rpc",
    });
  });

  test("relays ConvexError data as RemoteError and plain errors as Error", async () => {
    const { fetch } = fakeFetch((call) =>
      (call.body as { name: string }).name === "teams:join"
        ? {
            body: {
              error: {
                data: { code: "BAD_CODE", message: "nope" },
                kind: "convex",
              },
              ok: false,
            },
            status: 400,
          }
        : {
            body: {
              error: {
                kind: "error",
                message: "El dueño no puede salir del equipo",
              },
              ok: false,
            },
            status: 500,
          }
    );
    const client = createClient("https://app.test", async () => "tok", fetch);
    await expect(
      client.mutation(api.teams.join, { code: "x" })
    ).rejects.toBeInstanceOf(RemoteError);
    await expect(client.mutation(api.teams.leave, {})).rejects.toThrow(
      "El dueño no puede salir del equipo"
    );
  });

  test("on 401 refreshes the token once and retries", async () => {
    let attempt = 0;
    const { fetch, calls } = fakeFetch((call) => {
      attempt++;
      return call.auth === "Bearer fresh"
        ? { body: { ok: true, value: "ok" }, status: 200 }
        : {
            body: {
              error: { kind: "error", message: "No has iniciado sesión" },
              ok: false,
            },
            status: 401,
          };
    });
    const tokens = ["stale", "fresh"];
    const forced: boolean[] = [];
    const client = createClient(
      "https://app.test",
      async (force) => {
        forced.push(Boolean(force));
        return tokens.shift() ?? null;
      },
      fetch
    );
    expect(await client.query(api.users.me, {})).toBe("ok" as never);
    expect(attempt).toBe(2);
    expect(forced).toEqual([false, true]);
    expect(calls.map((c) => c.auth)).toEqual(["Bearer stale", "Bearer fresh"]);
  });

  test("a non-JSON answer is a clear server error, and a dead host is a network error", async () => {
    const html = (async () =>
      new Response("<html>", { status: 502 })) as unknown as typeof fetch;
    const client = createClient("https://app.test", async () => "tok", html);
    await expect(client.query(api.users.me, {})).rejects.toMatchObject({
      code: "SERVER",
    });
    const dead = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const offline = createClient("https://app.test", async () => "tok", dead);
    await expect(offline.query(api.users.me, {})).rejects.toMatchObject({
      code: "NETWORK",
      exitCode: 5,
    });
  });
});

describe("auth endpoints", () => {
  test("verify returns tokens, refresh rotates them", async () => {
    const { fetch, calls } = fakeFetch((call) => ({
      body: {
        ok: true,
        value: {
          tokens: {
            refreshToken: "r2",
            token: `t-${call.url.split("/").pop()}`,
          },
        },
      },
      status: 200,
    }));
    expect(
      await authVerify("https://app.test", "a@b.c", "00000000", fetch)
    ).toEqual({
      refreshToken: "r2",
      token: "t-verify",
    });
    expect(calls[0]?.body).toEqual({ code: "00000000", email: "a@b.c" });
    const refresh = makeRefresh("https://app.test", fetch);
    expect(await refresh("r1")).toEqual({
      refreshToken: "r2",
      token: "t-refresh",
    });
    expect(calls[1]?.body).toEqual({ refreshToken: "r1" });
  });
});
