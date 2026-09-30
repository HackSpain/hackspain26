import assert from "node:assert/strict";
import { test } from "node:test";
import { CLOSING_PATH } from "./closing";
import { isPublicAppPath, PUBLIC_APP_PATHS } from "./public-paths";

test("only the intended app pages bypass the session gate", () => {
  assert.deepEqual(PUBLIC_APP_PATHS, [
    "/tv",
    "/cli-auth/handoff",
    "/final/cancelar",
    CLOSING_PATH,
  ]);

  for (const path of PUBLIC_APP_PATHS) {
    assert.equal(isPublicAppPath(path), true, path);
  }

  for (const path of ["/submit", "/final", "/cli-auth", "/tv/private"]) {
    assert.equal(isPublicAppPath(path), false, path);
  }
});
