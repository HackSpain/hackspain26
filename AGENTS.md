# Working on HackSpain

HackSpain is a pnpm monorepo: `apps/web` is the Astro landing on Neon/Drizzle, `apps/app` is the Next.js dashboard with Convex, and `apps/cli` is the Bun CLI calling the dashboard API. Use Node 22.13+ and the pnpm version pinned in `package.json`.

## Before changing code

- Read the relevant entries in [docs/learnings.md](docs/learnings.md), especially for auth, telemetry, networking, production incidents, or deployments.
- When you discover a non-obvious failure mode, operational constraint, misleading assumption, or recurring mistake, add or update an entry there in the same change. Record the symptom, evidence and cause (mark uncertainty), the fix or mitigation, and how to prevent and verify recurrence. Include a date and useful code/PR references; omit secrets and personal data. Update an existing entry instead of duplicating it. A hypothesis or an open PR is not a verified production fix.
- Keep this file for actionable coding instructions and invariants. Put setup in the [README](README.md), detailed feature documentation beside the feature, and incident findings in `docs/learnings.md`. Do not add branch status, changelogs, screen inventories, or copies of implementation details here.
- Check the current implementation before relying on old documentation. When a task exposes a contradictory instruction, correct it in the same change.

## Scope and verification

- Use `samuel/<feature-name>` for new branches unless the user specifies otherwise.
- Match existing patterns; no unrelated formatting, import cleanup, refactors, or dependency changes. Use strict TypeScript; no `any`.
- Add or change tests only for behavior this task introduces or fixes. Use the file's actual test runner; `bun:test` requires Bun.
- Do not commit temporary harness, fixture, environment, configuration, dependency, or logging workarounds used to make local verification pass. Remove them before finishing and disclose what was temporarily changed. Ask before keeping a local workaround as a production change.
- Run the relevant checks from workspace scripts. Dashboard: `pnpm --filter app typecheck` and `pnpm --filter app lint`; landing: `pnpm check`; CLI: `pnpm --filter cli typecheck`, `pnpm --filter cli lint`, and `pnpm test:cli`. Verify UI changes in the browser.
- Distinguish pre-existing check failures from regressions with evidence. Report pending/failed checks honestly; mergeability alone does not mean validation passed.

## Setup and deployment

See [README.md](README.md) for environment variables and deployment, and [apps/cli/README.md](apps/cli/README.md) for CLI development.

- `pnpm dev` runs the landing; `pnpm dev:app` runs the dashboard; `pnpm dev:convex` runs the development backend; `pnpm dev:all` runs all three.
- Production Convex deploys through the dashboard's Vercel build (`pnpm vercel-build`). Do not run `convex deploy` from a laptop for local checks. Production changes require shipping intent.
- `pnpm migrate:convex` imports Neon signups; run it only for an intended import. Preserve idempotency by email and never undo existing acceptance.
- Seed/reset/clear commands are development-only. Never enable the OTP stub or seed production. The stub must map to a per-account random code; a shared stored OTP collides with Convex Auth's unique hash lookup.
- Keep server secrets in server-side environment variables. Never commit env files or expose credentials through `PUBLIC_` / `NEXT_PUBLIC_` variables.

## Landing

- Keep public signup data in Neon until a separate migration is requested. New dashboard data belongs in Convex.
- Reuse `src/lib/signup-validation.ts` and `mentor-sponsor-validation.ts` in forms and APIs; do not invent parallel schemas. Keep BotID, content-type validation, and duplicate handling on the public signup APIs. Dashboard firewall exceptions do not change landing protections.
- Generate Drizzle migrations from schema changes; do not hand-edit applied SQL.
- The landing is a full-viewport mosaic, not a scrolling page. Respect reduced motion. Keep Spanish-first routes without locale prefixes and without trailing slashes.
- When adding a landing section, update `section-routes.ts`, mosaic cells, `landing-meta.ts`, and its route. Keep `src/data/llms.txt` consistent with visible copy; middleware serves it for markdown requests.
- Keep brand tokens in `src/styles/global.css` and `src/components/theme/palette.ts` synchronized. Reuse existing form/button components. Landing and dashboard have separate layouts.

## Dashboard and Convex

Paths below are relative to `apps/app`.

- Enforce permissions in Convex wrappers, not only navigation. Default new event features to `onboarded*`; use `anytimeOnboarded*` only for features intentionally available outside the event (such as perks). Keep profile/onboarding access on the appropriate `authed*`, `accepted*`, or `profileMutation` wrapper.
- Use `convex/lib/auth.ts`, `eventWindow.ts`, and `userTypes.ts` as the access model. Admins bypass the event gate; judging access comes from user-type sections. Do not reintroduce a separate judge role.
- Every account, including admins/judges, needs the profile fields derived by `convex/lib/profile.ts`. Reuse `missingProfileFields` and the onboarding `planSteps` helper instead of adding a completion flag or another gate.
- Preserve structured OTP outcomes (`UNREGISTERED`, `BAD_OTP`, `OTP_EXPIRED`, `TOO_MANY_ATTEMPTS`, `SEND_FAILED`). Expected validation failures must remain distinguishable from transport or server failures.
- Team creation/join/transfer and project/track submission use the CLI; the dashboard's teams/tracks views are read-only except the existing logo controls. `challengeIds` is an array for compatibility, but `submissions.ts` enforces one track per team. Preserve its capacity checks and submission-window enforcement.
- Normalize phone numbers through `convex/lib/phone.ts`, also bundled by the CLI. Phones are unverified data; do not restore the removed SMS verification flow.
- Parse directory cards through `convex/lib/directory.ts` and curated aliases in `directoryOptions.ts`. Reuse those helpers in forms; incomplete cards must not enter the directory. Normalizing existing data is a separate, intentional mutation.
- GitHub linking uses the custom OAuth flow in `convex/github.ts`, not a Convex Auth OAuth provider. The production callback goes directly to `https://api.hackspain.com/github/callback`; preserve one-time state, same-origin return paths, and account ownership checks.
- Serve uploaded images through authenticated `/api/files/<storageId>` paths. Preserve storage attachment/ownership checks and the cookie-or-bearer flow. A GitHub avatar is a valid fallback; removing the last profile photo is not allowed.
- Reuse `src/lib/layout.ts` for shell widths and existing brand tokens/components. Preserve admin edits when filling missing track defaults.

## CLI and telemetry

- The CLI calls allowlisted `/api/cli/*` handlers, never Convex directly. Run backend functions with the participant's bearer session. Extend `apps/app/src/app/api/cli/_lib/functions.ts` when needed. Public middleware routing does not remove endpoint authentication.
- Backend imports in the CLI are type-only from Convex's generated API, except shared pure modules such as phone normalization and telemetry canonicalization. Refresh generated types through the development/codegen workflow when changing functions.
- Use `ConvexError({ code, message })` for expected CLI failures; preserve the route's structured error envelope and CLI exit codes. Unexpected server failures need sanitized diagnostic logs.
- Preserve the refresh-token lock: concurrent use of stale rotating tokens can invalidate sessions. Web handoff tokens are single-use and short-lived. Use `hs-code` / `hs-token`, never a query parameter named `code`, which Convex Auth middleware consumes.
- `--json` emits exactly one JSON object on stdout and disables prompts; other output goes to stderr. Source runs target localhost; release binaries target `https://hackspain.app`.
- Follow [the telemetry schema](apps/cli/docs/telemetry-schema.md). Collectors emit only harness facts and fail soft. Derive shared model/token fields in `apps/app/src/app/api/cli/telemetry/canonical.ts`, and canonicalize again on ingestion. Do not derive competing meanings inside collectors.
- Change the schema, client/server validators, docs, relevant tests, and all consumers together. Breaking field/type/meaning changes require a schema version and compatibility window. Keep old spool/client ingestion compatible during rollout.
- Never collect prompts, responses, code, full paths, env values, credentials, or harness account IDs. Keep fixtures redacted and native fields allowlisted.
- Record only events whose `occurredAt` is inside the scheduled hackathon window, including for admins. No schedule means no recording. Preserve spool durability, retry across restarts, and collection of eligible logs written while the watcher was closed.
- RawTree OTLP logs are the telemetry store; inspect `telemetry/otlp.ts` and `api/tv/insights/usage.ts` before changing ingestion or queries. Do not restore the old dual-write/custom-table path. Consumers must deduplicate by `(identity.userId, eventId)` permanently; transport retry protection is insufficient.
- Insights/TV consume live aggregates. Do not fill gaps with synthetic usage, cost, sessions, or milestones. Keep unsupported data visibly unavailable. GitHub activity cannot be attributed to an AI harness.
- Preserve the GitHub feed's polling ETags and `externalId` deduplication. Use the deployment's authenticated GitHub client; shared unauthenticated egress quotas are insufficient. Reset repository cache state when a team changes its repo.
