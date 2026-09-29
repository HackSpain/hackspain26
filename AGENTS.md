# Working on HackSpain

pnpm monorepo: `apps/web` is the Astro landing on Neon/Drizzle; `apps/app` is the Next.js dashboard with Convex; `apps/cli` is the Bun CLI. Setup and commands: [README](README.md) and [CLI README](apps/cli/README.md).

## Documentation

- Read [apps/web/src/data/design.md](apps/web/src/data/design.md) before building or changing UI. It is the public design and brand guide (tokens, components, motion, accessibility), served at `/design.md`, so it names no repo files. The landing implements it in `apps/web/src/components/ui/button-styles.ts`, `apps/web/src/components/form/field-classes.ts` and `apps/web/src/styles/global.css`; the dashboard maps the same tokens to shadcn variables in `apps/app/src/app/globals.css`.
- Keep this file for project-specific constraints and traps that are hard to infer from code. Personal preferences belong in each contributor's local agent configuration. Correct documentation that the task proves stale; avoid feature inventories and permanent bans based solely on past implementations.

## Code quality and review

- Quality checks are blocking. Run the affected workspaces' lint, typecheck/check and tests before marking work ready; web changes also run `pnpm --filter web knip:check`. CI errors, warnings and unused disable directives must be resolved, not downgraded or bypassed. Do not add ignores, baselines or `continue-on-error` to hide real findings. A verified tool false positive needs a narrowly scoped exception with the reason and evidence; keep the rule active wherever it applies.
- Before adding a helper, type, schema, mapper, wrapper or state, find its existing owner and consumers. Derive types from Convex validators/generated APIs; reuse owned behavior. Validate untrusted input at its boundary and pass the typed value inward. New abstractions must remove more concepts than they introduce or serve a concrete boundary.
- Review the complete final diff and its affected callers for correctness, duplicated behavior/contracts, unnecessary layers, mirrored state, fallbacks that hide invalid data, and logic in the wrong layer. Fix causes in their owning layer. Split responsibilities when that clarifies ownership; moving lines alone is not a cleanup.
- Every meaningful code or quality-gate change needs an independent review before it is ready: a human or a separate agent given the request and final diff, without the implementation conversation. The implementing agent must request this review and resolve its findings. Documentation-only edits may use self-review.
- Findings that affect correctness, security, contracts or maintainability block readiness. Repair defects introduced by the change in the same branch; do not turn them into follow-up suggestions. Record any disputed finding with concrete evidence. After repairs, rerun affected checks and have the reviewer verify the final diff.
- Report the reviewed commit or working-tree snapshot, reviewer, actual validation results, and the disposition of findings in the PR. A checked box without evidence is not a completed review. If validation or review is unavailable, state the blocker and keep the work unready.

## Project traps

- Production Convex deploys through the dashboard's Vercel build (`pnpm vercel-build`), which replaces whatever is deployed. Do not use `convex deploy` for local validation, and never deploy a branch to production by hand: its functions vanish on the next build and its rows can block the schema push. Signup migration imports real Neon data; seed/reset/clear and OTP stubs are development-only.
- Public signup still writes Neon; dashboard data belongs in Convex. Changing that boundary is a migration, not a routine endpoint edit.
- Landing brand tokens are duplicated in `apps/web/src/styles/global.css` and `apps/web/src/components/theme/palette.ts`, and mirrored in `apps/app/src/app/globals.css`; keep them synchronized. `apps/web/src/data/llms.txt` is served by middleware for markdown requests and must follow visible copy changes.
- Convex access wrappers enforce both permissions and event timing. Use `onboarded*` for new event features; use `anytimeOnboarded*` only when intentionally available outside the event. Check `apps/app/convex/lib/auth.ts` before choosing a wrapper.
- The CLI reaches Convex through allowlisted `/api/cli/*` handlers using the participant's bearer session. Public middleware routing does not remove endpoint authentication. Keep generated backend API imports type-only in the CLI; shared pure helpers are separate runtime dependencies.
- Preserve the CLI refresh-token lock: concurrent reuse of rotating tokens can invalidate sessions. Auth handoffs use `hs-code` / `hs-token`; a query parameter named `code` is consumed by Convex Auth middleware.
- CLI `--json` is a machine-readable contract: exactly one JSON object on stdout, no prompts, other output on stderr.
- Telemetry changes must preserve the [schema contract](apps/cli/docs/telemetry-schema.md), shared canonicalization, old-client/spool compatibility, and corresponding ingestion/query changes. Consumers permanently deduplicate by `(identity.userId, eventId)`; transport retry protection is insufficient.
- Telemetry excludes prompts, responses, code, full paths, credentials, and harness account IDs. The scheduled collection window uses `occurredAt`, including for admins; no schedule means no recording.
- Project submit is dashboard `/submit` (YouTube + public GitHub + optional product URL), not the CLI. One team, one track. The home Submit tile features from Sunday 08:00 Europe/Madrid (`apps/app/src/lib/event.ts`). CLI `saveDraft` still stores a draft; `hackspain submit` is gone.
- `/tv`, `/final/cancelar`, and the closing path skip login. Keep them in `isPublicAppPath` and the middleware public matcher together; the cancel page authenticates with the email token, not a session.
