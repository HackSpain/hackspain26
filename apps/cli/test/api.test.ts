import { describe, expect, test } from "bun:test";
import type { Session } from "../src/lib/api";
import {
  api,
  authSignOut,
  authStart,
  authVerify,
  createClient,
  devicePoll,
  deviceStart,
  functionName,
  makeRefresh,
  uploadImage,
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
  test("sets a deadline on RPC requests", async () => {
    let signal: AbortSignal | null | undefined;
    const fetchImpl = (async (
      _input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      signal = init?.signal;
      return Response.json({ ok: true, value: null });
    }) as typeof fetch;
    await createClient("https://app.test", async () => "tok", fetchImpl).query(
      api.users.me,
      {}
    );
    expect(signal).toBeInstanceOf(AbortSignal);
  });

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

  test("rejects malformed envelopes and a success body on an error status", async () => {
    const responses = [
      { status: 200, body: { ok: true } },
      { status: 400, body: { ok: false, error: { kind: "error" } } },
      {
        status: 200,
        body: { ok: false, error: { kind: "error", message: "bad" } },
      },
      { status: 500, body: { ok: true, value: "wrong status" } },
      { status: 200, body: { ok: "true", value: "wrong type" } },
    ];
    for (const response of responses) {
      const { fetch } = fakeFetch(() => response);
      const client = createClient("https://app.test", async () => "tok", fetch);
      await expect(client.query(api.users.me, {})).rejects.toMatchObject({
        code: "SERVER",
      });
    }
  });
});

describe("auth endpoints", () => {
  test("accepts the documented start and signout responses", async () => {
    const start = fakeFetch(() => ({
      status: 200,
      body: { ok: true, value: { started: true } },
    }));
    expect(await authStart("https://app.test", "a@b.c", start.fetch)).toBe(
      true
    );

    const signout = fakeFetch(() => ({
      status: 200,
      body: { ok: true, value: { signedOut: true } },
    }));
    await expect(
      authSignOut("https://app.test", "tok", signout.fetch)
    ).resolves.toBeUndefined();
  });

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

  test("device start sends the secret, poll relays pending then tokens", async () => {
    const secret = "s".repeat(43);
    const responses = [
      { code: "abcdmnpq2345", expiresAt: 1234 },
      { status: "pending" },
      {
        status: "approved",
        tokens: { token: "t1", refreshToken: "r1" },
        email: "a@b.c",
      },
    ];
    const { fetch, calls } = fakeFetch(() => ({
      status: 200,
      body: { ok: true, value: responses.shift() },
    }));
    expect(await deviceStart("https://app.test", secret, fetch)).toEqual({
      code: "abcdmnpq2345",
      expiresAt: 1234,
    });
    expect(calls[0]).toEqual({
      url: "https://app.test/api/cli/auth/device/start",
      body: { secret },
      auth: null,
    });
    expect(
      await devicePoll("https://app.test", "abcdmnpq2345", secret, fetch)
    ).toEqual({ status: "pending" });
    expect(calls[1]).toEqual({
      url: "https://app.test/api/cli/auth/device/poll",
      body: { code: "abcdmnpq2345", secret },
      auth: null,
    });
    expect(
      await devicePoll("https://app.test", "abcdmnpq2345", secret, fetch)
    ).toEqual({
      status: "approved",
      tokens: { token: "t1", refreshToken: "r1" },
      email: "a@b.c",
    });
  });

  test("rejects malformed auth values before accepting or storing tokens", async () => {
    const malformed = (value: unknown) =>
      fakeFetch(() => ({ status: 200, body: { ok: true, value } })).fetch;

    await expect(
      authStart("https://app.test", "a@b.c", malformed({ started: "yes" }))
    ).rejects.toMatchObject({ code: "SERVER" });
    await expect(
      authVerify(
        "https://app.test",
        "a@b.c",
        "00000000",
        malformed({
          tokens: { token: "", refreshToken: "r1" },
        })
      )
    ).rejects.toMatchObject({ code: "SERVER" });
    await expect(
      makeRefresh("https://app.test", malformed({}))("r1")
    ).rejects.toMatchObject({ code: "SERVER" });
    await expect(
      deviceStart(
        "https://app.test",
        "secret",
        malformed({
          code: "abc",
          expiresAt: "tomorrow",
        })
      )
    ).rejects.toMatchObject({ code: "SERVER" });
    await expect(
      devicePoll(
        "https://app.test",
        "abc",
        "secret",
        malformed({
          status: "approved",
          email: null,
        })
      )
    ).rejects.toMatchObject({ code: "SERVER" });
    await expect(
      authSignOut(
        "https://app.test",
        "tok",
        malformed({
          signedOut: false,
        })
      )
    ).rejects.toMatchObject({ code: "SERVER" });
  });
});

test("upload returns a valid image id and rejects an invalid one", async () => {
  const session: Session = {
    authenticated: true,
    client: createClient("https://app.test", async () => "tok"),
    token: async () => "tok",
    url: "https://app.test",
    urlSource: "flag",
  };
  const validFetch = (async () =>
    Response.json({
      ok: true,
      value: { imageId: "image-123" },
    })) as unknown as typeof fetch;
  expect(
    await uploadImage(session, new Uint8Array([1]), "image/png", validFetch)
  ).toBe("image-123");

  const invalidFetch = (async () =>
    Response.json({
      ok: true,
      value: { imageId: 42 },
    })) as unknown as typeof fetch;

  await expect(
    uploadImage(session, new Uint8Array([1]), "image/png", invalidFetch)
  ).rejects.toMatchObject({ code: "SERVER" });
});
