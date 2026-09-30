# Working on HackSpain

Keep instructions here only when they prevent a mistake that is easy to make after inspecting the code. State the situation, the required action and the reason. Keep file locations, command lists and product rules in their existing sources; remove instructions when their underlying constraint disappears.

## Code quality

- Before adding a type, validator, helper or state, check its existing owner and consumers. Derive types from the authoritative contract and fix behavior where it is owned. Add a layer for a current requirement; avoid copies that must be kept in sync or defaults that hide invalid internal state.
- Run the affected workspaces' configured lint, type, test and unused-code checks before marking work ready. Lint and typecheck warnings are failures. Fix findings rather than weakening checks; a demonstrated tool false positive may have a narrow, explained exception. Report checks that could not run as incomplete.
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

- Follow the existing design rules. Brand tokens have separate representations in the landing and dashboard; update them together. Keep machine-readable public content synchronized with visible copy.
