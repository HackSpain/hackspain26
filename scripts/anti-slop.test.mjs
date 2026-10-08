import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const oxlint = join(root, "node_modules/.bin/oxlint");

const invalid = `
export const chained = ({ id: "example" } as unknown) as { id: string };
export type Unparsed = unknown;
export function untyped(value: object) { return value; }
export function property(value: { id: string }) { return Reflect.get(value, "id"); }
export function call(fn: (value: number) => number) { return Reflect.apply(fn, null, [1]); }
export function widened(value: { id: string }) {
  const loose: unknown = value;
  return loose as { id: string };
}
`;

const valid = `
export type User = { id: string };
export function id(user: User) { return user.id; }
export function call(fn: (value: number) => number) { return fn(1); }
export const modes = ["full", "lite"] as const;
`;

const rules = [
  "no-chained-type-assertions",
  "no-object-parameters",
  "no-reflect-apply",
  "no-reflect-get",
  "no-unknown-type-aliases",
  "no-widen-then-assert",
];

for (const workspace of ["app", "web", "cli"]) {
  test(`anti-slop reaches ${workspace} through its real workspace config`, () => {
    const cwd = join(root, "apps", workspace);
    const directory = mkdtempSync(join(cwd, "src/.anti-slop-"));
    try {
      const lint = (name, source) => {
        const path = join(directory, name);
        writeFileSync(path, source);
        const result = spawnSync(
          oxlint,
          [
            "-c",
            "oxlint.config.mjs",
            "--deny-warnings",
            "--report-unused-disable-directives-severity=error",
            "--no-error-on-unmatched-pattern",
            "--format=json",
            path,
          ],
          { cwd, encoding: "utf8" }
        );
        assert.equal(result.error, undefined);
        assert.equal(result.signal, null);
        return { status: result.status, ...JSON.parse(result.stdout) };
      };

      const negative = lint("invalid.ts", invalid);
      assert.equal(negative.status, 1);
      for (const rule of rules) {
        assert.ok(
          negative.diagnostics.some(
            (diagnostic) => diagnostic.code === `anti-slop(${rule})`
          ),
          `${workspace} did not reject ${rule}`
        );
      }

      const positive = lint("valid.ts", valid);
      assert.equal(positive.status, 0, JSON.stringify(positive.diagnostics));
      assert.deepEqual(positive.diagnostics, []);

      const fixture = lint(
        "fixture.test.ts",
        "export const partial = ({ id: 'example' } as unknown) as { id: string };"
      );
      assert.equal(fixture.status, 0, JSON.stringify(fixture.diagnostics));
      assert.deepEqual(fixture.diagnostics, []);

      mkdirSync(join(directory, "_generated"));
      const generated = lint("_generated/client.ts", invalid);
      assert.equal(generated.status, 0, JSON.stringify(generated.diagnostics));
      assert.deepEqual(generated.diagnostics, []);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test("workspace check and fix commands use the pinned Ultracite runner", () => {
  const installed = JSON.parse(
    readFileSync(join(root, "node_modules/ultracite/package.json"), "utf8")
  );
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(installed.version, manifest.devDependencies.ultracite);
  for (const workspace of ["web", "cli"]) {
    const cwd = join(root, "apps", workspace);
    const { scripts } = JSON.parse(
      readFileSync(join(cwd, "package.json"), "utf8")
    );
    for (const command of workspace === "web"
      ? ["lint", "fix"]
      : ["lint", "fix", "check"]) {
      const invocations = scripts[command]
        .split("&&")
        .map((step) => step.trim())
        .filter((step) => step.includes("ultracite"));
      assert.equal(
        invocations.length,
        1,
        `${workspace} ${command} must invoke one Ultracite runner`
      );
      const invocation = invocations[0].match(/^(.*)\s(?:check|fix)(?:\s.*)?$/);
      assert.ok(
        invocation,
        `${workspace} ${command} has no Ultracite check/fix invocation`
      );
      const result = spawnSync(
        "/bin/sh",
        ["-c", `${invocation[1]} --version`],
        {
          cwd,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${root}/node_modules/.bin:${process.env.PATH}`,
          },
        }
      );
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        result.stdout.trim(),
        installed.version,
        `${workspace} ${command} resolved the wrong runner`
      );
    }
  }
});
