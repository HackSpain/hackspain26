import { beforeEach, describe, expect, mock, test } from "bun:test";

const signIn = mock(async (..._args: unknown[]) => ({
  started: true,
  reason: undefined as string | undefined,
}));
const report = mock(async () => {});

mock.module("convex/nextjs", () => ({ fetchAction: signIn }));
mock.module("@/lib/server-observability", () => ({ reportServerEvent: report }));

const { POST } = await import("./route");

function request(body: unknown): Request {
  return new Request("http://localhost/api/login/otp", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

beforeEach(() => {
  signIn.mockClear();
  signIn.mockImplementation(async () => ({ started: true, reason: undefined }));
  report.mockClear();
});

describe("login OTP behind the managed firewall", () => {
  test("accepts a valid email without BotID headers and normalizes it", async () => {
    const response = await POST(request({ email: " Hacker@Example.com " }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signIn.mock.calls[0]?.[1]).toEqual({
      params: { email: "hacker@example.com" },
      provider: "resend-otp",
    });
  });

  test("still refuses invalid email before calling Convex", async () => {
    const response = await POST(request({ email: "invalid" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "INVALID_EMAIL", ok: false });
    expect(signIn).not.toHaveBeenCalled();
  });

  test("still refuses participants who are not registered", async () => {
    signIn.mockImplementation(async () => ({
      started: false,
      reason: "UNREGISTERED",
    }));
    const response = await POST(request({ email: "unknown@example.com" }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "UNREGISTERED", ok: false });
  });
});
