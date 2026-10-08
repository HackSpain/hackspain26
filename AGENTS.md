# Working on HackSpain

Keep instructions here only when they prevent a mistake that is easy to make after inspecting the code. State the situation, the required action and the reason. Keep file locations, command lists and product rules in their existing sources; remove instructions when their underlying constraint disappears.

## Scope and shared skills

- Before planning or implementing code, read and use [Ponytail](.agents/skills/ponytail/SKILL.md), including for fixes, refactors, architecture and dependency choices. Default to `full` unless the user chooses another mode. Before finalizing or reviewing a code change, also read and use [Ponytail Review](.agents/skills/ponytail-review/SKILL.md); complexity review complements correctness, security and accessibility review.
- Shared skills live in `.agents/skills/`. Codex and Cursor read that source directly; `.claude/skills/` links to it for Claude Code discovery. Edit the source, never a separate copy. If a tool does not surface a skill, read it by path rather than skipping it.
- Keep one objective per change. Preserve user-owned work and exclude unrelated linting, formatting, refactoring and imports. Review findings outside the objective are observations, not permission for a cleanup.
- Name new branches `samuel/feature-name` unless the user requests another name.
- Read the nearest applicable `AGENTS.md` before editing below it, even when the session starts at the root; nested instructions may not have been loaded. Use the existing README and task-specific docs for setup, commands and product rules.

## Code quality

- Before adding a type, validator, helper or state, check its existing owner and consumers. Derive types from the authoritative contract and fix behavior where it is owned. Add a layer for a current requirement; avoid copies that must be kept in sync or defaults that hide invalid internal state.
- Validate external input where it enters the system, then preserve the owned type internally. Do not widen known values to `unknown` or an open dictionary and recover them with casts; `as any`, double assertions and copied shapes do not repair a contract mismatch. Keep generated files generated; change their source instead.
- Do not mirror query, server or route state just to derive a value. Introduce separate state only when it represents an independent interaction or lifecycle; effects that synchronize two copies add another owner to keep correct.
- Use stable IDs for persistence, permissions and dispatch, not display labels. Missing required config or business data is invalid state; only use a fallback for a documented optional case. Do not turn unexpected failures into empty arrays, success results or silent no-ops.

## Verification and harness changes

- Run the affected workspaces' configured lint, type, test and unused-code checks before marking code ready, plus formatting checks on changed files. Warnings are failures. Documentation and skill-only changes need link, discovery and instruction review, not an application build; executable tooling changes need a runnable check of the behavior they change. Report commands actually run and checks that could not run as incomplete.
- Fix the cause of lint findings. Do not add casts, renames, wrappers or suppressions to evade a rule, or weaken severity, globs, assertions, timeouts or baselines to admit the implementation. A demonstrated tool false positive may have a narrow exception with its rationale, defect reference and removal condition; existing exceptions do not authorize new ones.
- Harness changes must serve the requested objective. Before adding a rule, check the installed preset and measure its findings on the intended files; do not duplicate an existing check or enable a whole preset based on its name. Syntax and import constraints belong in low-noise mechanical checks; ownership and behavior tradeoffs still need review. Read the installed version rather than assuming it contains rules from another repository.
- Add or modify tests only for behavior introduced or fixed by the task. Use the existing test tools and assert observable behavior or contracts; do not add ad hoc production self-checks or change production interfaces just to fit a mock.
- Do not keep harness, E2E, fixture, environment, build, dependency, lockfile or logging changes merely to make local verification pass. Remove temporary changes before finishing, state what was removed, and never commit or push local workarounds without explicit authorization. If a workaround appears necessary as a durable production change, ask before keeping it; ask when a test or tooling change's scope is unclear.
- Behavior, contract, architecture and quality-gate changes require independent review of the final diff and affected callers. Blocking feedback needs a concrete defect or maintenance cost. Resolve it, rerun affected checks and have the fixes rechecked. Record the reviewer and validation results in the PR. Documentation and purely mechanical edits may use self-review.

## Deployment and data

- Use development deployments for validation, seeding, resets and OTP stubs. Production Convex is deployed by the dashboard's Vercel build: manual branch deployments are overwritten and can leave rows that block the next schema push. Migration scripts may import real signup data.
- Moving signup data between Neon and Convex requires a migration plan covering existing rows and writers; changing an endpoint does not complete that migration.

## Authentication and CLI

- Convex access wrappers enforce event timing as well as identity and permissions. Choose access outside the event window only when the feature requires it.
- Public routes must agree across middleware and the application auth gate. Public routing does not authenticate an endpoint; token-based pages must still validate their token.
- Serialize CLI token refreshes: concurrent reuse of rotating refresh tokens can invalidate the session. Preserve the handoff parameters `hs-code` and `hs-token`; the auth provider consumes a query parameter named `code`.
- Keep generated Convex API imports type-only in the CLI; runtime sharing belongs in pure modules. In CLI JSON mode, emit exactly one JSON object on stdout, send other output to stderr and skip prompts.

## Telemetry

- Evolve the canonical telemetry schema and normalization across collectors, ingestion and consumers together. Preserve old-client and spool compatibility. Deduplicate permanently by `(identity.userId, eventId)`; transport retry protection alone does not prevent duplicate events.
- Exclude prompts, responses, code, full paths, credentials and harness account IDs. Use the event's `occurredAt` for the collection window, including for admins. An absent schedule means recording is disabled.

## UI consistency

- For every UI change, read and use [Emil Design Engineering](.agents/skills/emil-design-eng/SKILL.md) before planning or editing and when reviewing the result. For web motion use [Animate](.agents/skills/animate/SKILL.md); for mobile web behavior use [Mobile Native](.agents/skills/mobile-native/SKILL.md); for Sonner use [Ask Sonner](.agents/skills/ask-sonner/SKILL.md). Read only the companion skills relevant to the task; this does not authorize adding motion, dependencies, demos or an audit beyond the requested scope. Preserve the existing design system, accessibility and reduced-motion behavior.
- Use the remaining Emil skills for their stated tasks. `review-animations` requires explicit invocation; general UI work does not start a specialized motion audit or review.
- Follow the existing design rules. Brand tokens have separate representations in the landing and dashboard; update them together. Keep machine-readable public content synchronized with visible copy.
