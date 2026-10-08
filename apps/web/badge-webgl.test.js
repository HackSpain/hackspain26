import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Compile the isolated browser capability probe with the project's TypeScript.
const source = readFileSync(
  new URL("src/components/share/badge-webgl.ts", import.meta.url),
  "utf8"
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
});
const exports = {};
runInNewContext(outputText, { exports });
const { supportsBadgeWebGL } = exports;

test("badge falls back when WebGL 2 is absent or context creation throws", () => {
  assert.equal(supportsBadgeWebGL({ getContext: () => null }), false);
  assert.equal(
    supportsBadgeWebGL({
      getContext() {
        throw new Error("WebGL disabled");
      },
    }),
    false
  );
});

test("badge accepts WebGL 2 and releases its probe context", () => {
  let released = false;
  const canvas = {
    getContext(version) {
      assert.equal(version, "webgl2");
      return {
        getExtension(name) {
          assert.equal(name, "WEBGL_lose_context");
          return {
            loseContext() {
              released = true;
            },
          };
        },
      };
    },
  };
  assert.equal(supportsBadgeWebGL(canvas), true);
  assert.equal(released, true);
  assert.equal(
    supportsBadgeWebGL({ getContext: () => ({ getExtension: () => null }) }),
    true
  );
});
