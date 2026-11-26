import assert from "node:assert/strict";
import { test } from "node:test";
import { isAdmin, resolvedLoginRole } from "./auth";

test("ADMIN_EMAILS only grants admin on first insert, never on later logins", () => {
  assert.equal(resolvedLoginRole(undefined, true), "admin");
  assert.equal(resolvedLoginRole(undefined, false), "user");
  assert.equal(resolvedLoginRole("user", true), "user");
  assert.equal(resolvedLoginRole("admin", false), "admin");
  assert.equal(resolvedLoginRole("admin", true), "admin");
  assert.equal(resolvedLoginRole("judge", true), "user");
});

test("admin is the boolean, with role as the transitional fallback", () => {
  assert.equal(isAdmin({ admin: true, role: "user" }), true);
  assert.equal(isAdmin({ role: "admin" }), true);
  assert.equal(isAdmin({ admin: false, role: "user" }), false);
  assert.equal(isAdmin({ role: "user" }), false);
});
