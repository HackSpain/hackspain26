# Working on HackSpain

pnpm monorepo: `apps/web` is the Astro landing on Neon/Drizzle; `apps/app` is the Next.js dashboard with Convex; `apps/cli` is the Bun CLI. Setup and commands: [README](README.md) and [CLI README](apps/cli/README.md).

## Working agreements

- Use `samuel/<feature-name>` for branches unless instructed otherwise.
- Keep changes scoped: no unrelated formatting, imports, refactors, or dependency updates. Prefer precise TypeScript types; justify any necessary `any` at the boundary where it is used.
- Add or modify tests only for behavior introduced or fixed by the task. Run the affected workspace's checks; verify UI in the browser when behavior or appearance changes warrant it.
- Do not retain temporary harness, fixture, environment, build, dependency, or logging workarounds just to pass local checks. Remove them and disclose what was temporarily changed. Do not commit or push local-only workarounds without explicit authorization; ask before keeping one as a production change.

## Documentation

- Consult relevant entries in [docs/learnings.md](docs/learnings.md) before working in an affected area.
- Add or update a learning when the task establishes a non-obvious, project-specific fact that will prevent a recurring or costly mistake. Record the evidence, consequence, and prevention/verification step. Mark unknown causes explicitly. Skip routine debugging, generic advice, and unverified theories; update an existing entry rather than duplicating it.
- Keep this file for working agreements and traps that are hard to infer from code. Put setup in README and historical explanations in learnings. Correct documentation that the task proves stale; avoid feature inventories and permanent bans based solely on past implementations.

## Project traps

- Production Convex deploys through the dashboard's Vercel build (`pnpm vercel-build`). Do not use `convex deploy` for local validation. Signup migration imports real Neon data; seed/reset/clear and OTP stubs are development-only.
- Public signup still writes Neon; dashboard data belongs in Convex. Changing that boundary is a migration, not a routine endpoint edit.
- Landing brand tokens are duplicated in `apps/web/src/styles/global.css` and `apps/web/src/components/theme/palette.ts`; keep them synchronized. `apps/web/src/data/llms.txt` is served by middleware for markdown requests and must follow visible copy changes.
- Convex access wrappers enforce both permissions and event timing. Use `onboarded*` for new event features; use `anytimeOnboarded*` only when intentionally available outside the event. Check `apps/app/convex/lib/auth.ts` before choosing a wrapper.
- The CLI reaches Convex through allowlisted `/api/cli/*` handlers using the participant's bearer session. Public middleware routing does not remove endpoint authentication. Keep generated backend API imports type-only in the CLI; shared pure helpers are separate runtime dependencies.
- Preserve the CLI refresh-token lock: concurrent reuse of rotating tokens can invalidate sessions. Auth handoffs use `hs-code` / `hs-token`; a query parameter named `code` is consumed by Convex Auth middleware.
- CLI `--json` is a machine-readable contract: exactly one JSON object on stdout, no prompts, other output on stderr.
- Telemetry changes must preserve the [schema contract](apps/cli/docs/telemetry-schema.md), shared canonicalization, old-client/spool compatibility, and corresponding ingestion/query changes. Consumers permanently deduplicate by `(identity.userId, eventId)`; transport retry protection is insufficient.
- Telemetry excludes prompts, responses, code, full paths, credentials, and harness account IDs. The scheduled collection window uses `occurredAt`, including for admins; no schedule means no recording.
