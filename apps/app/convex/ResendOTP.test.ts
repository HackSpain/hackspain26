import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { ConvexError } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import { sendVerificationRequest } from "./ResendOTP";

const ENV_KEYS = ["RESEND_API_KEY", "AUTH_RESEND_KEY", "ALLOW_EMAIL_OTP_STUB"] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};
const consoleLog = console.log;
const consoleWarn = console.warn;
let logged: string[] = [];

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  logged = [];
  console.log = (...args: unknown[]) => { logged.push(args.map(String).join(" ")); };
  console.warn = (...args: unknown[]) => { logged.push(args.map(String).join(" ")); };
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
  console.log = consoleLog;
  console.warn = consoleWarn;
});

const request = {
  identifier: "ana@example.com",
  token: "48213967",
  expires: new Date("2026-09-23T10:00:00Z"),
  provider: {},
};

test("without a Resend key and without the stub, the code is refused and never logged", async () => {
  const runMutation = async () => { throw new Error("must not store the code"); };
  const ctx = { runMutation } as unknown as ActionCtx;

  await assert.rejects(sendVerificationRequest(request, ctx), (error: unknown) => {
    assert.ok(error instanceof ConvexError);
    assert.equal((error as ConvexError<{ code: string }>).data.code, "SEND_FAILED");
    return true;
  });
  const output = logged.join("\n");
  assert.ok(output.includes("ALLOW_EMAIL_OTP_STUB is off"));
  assert.ok(!output.includes(request.token), `token leaked into logs: ${output}`);
  assert.ok(!output.includes(request.identifier), `email leaked into logs: ${output}`);
});

test("with the stub enabled, the code is remembered and printed for local login", async () => {
  process.env.ALLOW_EMAIL_OTP_STUB = "true";
  const stored: unknown[] = [];
  const runMutation = async (_ref: unknown, args: unknown) => { stored.push(args); };
  const ctx = { runMutation } as unknown as ActionCtx;

  await sendVerificationRequest(request, ctx);

  assert.deepEqual(stored, [{ code: request.token, email: request.identifier, expiresAt: request.expires.getTime() }]);
  assert.ok(logged.join("\n").includes(request.token));
});
