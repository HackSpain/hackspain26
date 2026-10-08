# Anti-slop lint policy

The root Oxlint config registers the bundled `anti-slop` plugin and selects six rules. Workspace configs inherit it alongside their existing presets. Run the configured `pnpm lint` and `pnpm lint:anti-slop:test` scripts; CI runs the gate tests on every PR.

## Distribution and compatibility

`ultracite-anti-slop` is an exact npm alias for `ultracite@7.12.0`, not a separate third-party plugin. Only its `oxlint/anti-slop` registration is imported. The existing Ultracite 7.6.2 presets, formatter, Oxlint 1.81.0, ignores and workspace checks remain in place. Both npm packages export an `ultracite` binary, so configured web/CLI commands invoke the original runner explicitly by path. Direct `pnpm exec ultracite` resolves the alias version; use the repository scripts for checks and fixes. The one deliberate native-rule change is disabling `unicorn/prefer-reflect-apply`, which would otherwise recommend a call that `no-reflect-apply` rejects.

Upgrading all presets to 7.12.2 failed configuration loading in app/web because its `no-unmodified-loop-condition` options require a newer Oxlint. In CLI it also introduced unrelated import, regex and sequential-await findings. The alias avoids that expansion and maintains an upstream-distributed bundle without copying generated plugin code into this repository. It adds a second tooling package and its transitive dependencies; neither application dependencies nor existing lockfile resolutions changed. Version 7.12.0 satisfies the installed Oxlint peer range. Its plugin bundle is byte-identical to the 7.12.2 bundle used for the initial audit.

The bundle identifies upstream [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) revision `e8c4880471b23ab7f216fba7b27d173a6ef07d4c`; attribution ships inside the installed package. This policy covers its 15 generic rules, not every rule a later upstream version may introduce. Effect-specific rules do not apply: this repository does not directly use Effect.

## Complete preset audit

Measured on the code at Git revision `bd19dab025e00c22accd822b906a65f36da92349`, before the assertion repairs, using Oxlint 1.81.0 and the existing workspace globs, ignores and overrides. Existing Oxlint checks produced no diagnostics. Forcing all 15 anti-slop rules produced **1,051 diagnostics**: app 522, web 132, CLI 397. Temporary-config diagnostics were excluded from these counts.

| Rule | App / web / CLI | Decision and observed reason |
| --- | --- | --- |
| `no-chained-type-assertions` | 15 / 3 / 14 | **Error in production.** Repair six chains across five production files. Leave the other 26 in fixtures: partial Convex contexts, fetch doubles and deliberately invalid score values are intentional. |
| `no-object-parameters` | 0 / 0 / 0 | **Error.** Prevent broad `object` inputs that provide no usable contract. |
| `no-reflect-apply` | 0 / 0 / 0 | **Error.** Prefer direct typed calls; retire the conflicting native suggestion explicitly. |
| `no-reflect-get` | 0 / 0 / 0 | **Error.** Require typed access or boundary parsing instead of reflective property reads. |
| `no-unknown-type-aliases` | 0 / 0 / 0 | **Error.** Prevent aliases that conceal `unknown` without adding a contract; raw `unknown` remains available at boundaries. |
| `no-widen-then-assert` | 0 / 0 / 0 | **Error.** Prevent known values being widened and then cast back through a local binding. |
| `no-known-value-widening` | 53 / 11 / 34 | **Not enabled.** Also flags explicit anonymous return contracts and open lookup tables, such as `useClosingData`, `parsePath` and `EVENT_LABELS`. Enabling it globally would force naming or inference changes without establishing a defect. Review actual evidence loss instead. |
| `no-runtime-typeof` | 121 / 43 / 97 | **Not enabled.** Existing boundary validation, environment checks and error classification need these probes. Replacing them merely to satisfy the rule can duplicate parsers or add wrappers. The audit used the preset's `allowInTypeGuards: true`. |
| `no-unknown-parameters` | 54 / 7 / 68 | **Not enabled.** Includes external-payload parsers and caught-error helpers. These functions are themselves the trust boundary; there is no earlier parser to move to. |
| `no-unknown-returns` | 12 / 0 / 4 | **Not enabled.** Includes generic CLI transport, raw JSONL decoding, test adapters and callbacks whose caller ignores their result. A named domain return type is useful only where the function actually owns that domain. |
| `no-unsafe-dictionary-type` | 40 / 2 / 27 | **Not enabled.** Includes external JSON/config objects and test contexts. Those values remain unknown until validation; manufacturing a domain shape to satisfy the rule would claim evidence the parser has not established. |
| `no-conditional-empty-object-spread` | 26 / 7 / 24 | **Not enabled.** Optional persistence and telemetry fields deliberately preserve omission. Replacing them with `undefined` can change the contract; mutation-based construction adds code without proving a defect. |
| `no-shape-in-symbol-names` | 11 / 19 / 0 | **Not enabled.** `shape` is real vocabulary in charts, memes and badge geometry, including `card-geometry.ts`. Renaming it would be a style sweep. |
| `require-safety-comment-for-type-assertion` | 190 / 40 / 129 | **Not enabled.** A mandatory marker on every assertion invites mechanical comments. Review the actual invariant and eliminate unsupported casts; keep comments when the reason is non-obvious. |
| `no-module-mocking` | 0 / 0 / 0 | **Not enabled.** The bundle targets Jest/Vitest calls, whereas current suites use Bun. A zero count does not demonstrate protection here, and banning all module doubles would impose a test-architecture policy beyond a concrete defect. |

Inactive rules are omitted from the explicit rule map. The full preset is not extended, so it cannot silently enable them or disable unrelated core rules.

## Scope and evidence

The chained-assertion rule excludes test/spec files and the existing `test`/`__tests__` directories from its initial reach. All other selected rules also reach tests. Generated files retain the existing preset exclusions. This is the stated scope of a new rule, not a suppression or exemption added to bypass an existing rule.

The repairs preserve the CLI's runtime proxy and historical Convex migration access with a single assertion at each adapter. Web uses the existing environment and `Window` contracts. Token validation narrows the checked numeric fields before calling the canonical total function; it does not change token arithmetic or error messages.

`scripts/anti-slop.test.mjs` runs the real workspace configurations against negative controls for all six rules, valid typed code, a deliberate test-only assertion chain and generated code. It verifies diagnostic codes and outcomes, not the config's spelling. It also extracts each configured check/fix runner and invokes only its `--version` option to prove it resolves the original version without running fixes. Every temporary in-tree fixture is removed in `finally`.

Local wall-clock medians of three runs each, in seconds:

| Workspace | Previous lint | Selected rules | All 15 rules |
| --- | ---: | ---: | ---: |
| app | 0.404 | 1.036 | 1.071 |
| web | 0.296 | 0.531 | 0.582 |
| CLI | 0.099 | 0.426 | 0.474 |

These are warm local Oxlint runs after the source repairs, not a CI latency guarantee. Loading the JS plugin adds a measurable fixed cost even with only six enabled rules. The three rule-inheritance tests took about 2.5 seconds locally; the runner regression test adds a separate version probe for each configured check/fix command. Re-evaluate compatibility, findings and cost before changing the selected rules or alias version; review the actual bundled source rather than assuming current upstream docs describe it.
