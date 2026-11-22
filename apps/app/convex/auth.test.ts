import assert from "node:assert/strict";
import { test } from "node:test";
import { signIn, signInWithProvider } from "./auth";

test("the library sign-in action is internal; the wrapper stays public", () => {
  assert.equal(
    (signInWithProvider as { isInternal?: boolean }).isInternal,
    true
  );
  assert.equal((signIn as { isPublic?: boolean }).isPublic, true);
});
