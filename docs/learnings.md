# Engineering learnings

Add an entry only for an evidenced, non-obvious project fact that helps prevent a recurring or costly mistake. Skip routine debugging, generic advice, and unverified theories. Each entry should explain the symptom, evidence/cause, corrective action, and prevention/verification. Separate a confirmed cause from a hypothesis, a mitigation from a fix, and a merged change from a verified production result. Update related entries instead of appending duplicates. Do not include credentials, raw request bodies, OTPs, or participant data.

## 2026-09-18 — Backend routes must not receive browser bot challenges

**Symptom and evidence.** During the investigation from 17:00 Europe/Madrid (15:00 UTC), Vercel's managed bot filter returned 429s for `/betterstack/web-vitals` and some `/api/auth` requests. The existing bypass covered only `^/api/(cli|files)/` and a separate GET `/api/tv` monitor. It left auth and observability endpoints exposed to challenges. Better Stack's `@logtail/next@0.4.0` fetch fallback also attempted to replace the browser User-Agent with `next-logtail/v0.4.0`, which was associated with the challenged telemetry requests.

**Correction.** On 2026-09-18 the `hackspain-app` Vercel project rule **Allow application backend routes** was published, enabled, ahead of Bot Protection, with Request Path matching `^/(api|betterstack)/` and action **Bypass**. This covers auth, CLI, files, TV APIs, and Better Stack proxies. The [firewall rules](https://vercel.com/hackspain/hackspain-app/firewall/rules) are external configuration; a Git merge does not configure them. Vercel requires Save, then Publish; staged changes are not live. The success message and active rule were checked after publishing.

[PR #153](https://github.com/HackSpain/hackspain26/pull/153) also introduced [the browser metrics reporter](../apps/app/src/components/better-stack-web-vitals.tsx), keeping the browser User-Agent while preserving the proxy payload, batching, beacon, and fetch fallback.

**Prevention.** Own backend clients must receive API responses, not browser challenges. Keep these backend/proxy paths exempt from Bot Protection and project firewall rate limits; check rule ordering and coverage when adding endpoints, a new route prefix, or new firewall rules. Do not work around edge rejection by adding application retries. Preserve endpoint authentication, authorization, validation, and intentional domain controls such as OTP attempt limits. The separate landing project still uses BotID on public signup forms.

**Verification and limits.** Correlate Firewall decisions with request path, time, action, rule, and status. Edge rejections never execute the route, so missing application logs do not prove requests succeeded. Confirm legitimate browser auth refresh, CLI calls, file requests, and telemetry reach their handlers, and check for recurring challenges after deployment. Do not send test OTPs to real participants. Custom bypass does not bypass Vercel's system DDoS mitigations or platform limits; system bypasses are IP/CIDR-based. Do not describe this as a guarantee of unlimited requests or disable global DDoS protection to fix a path-specific bot challenge.

## 2026-09-18 — A network error does not identify its cause

**Evidence.** Ten client auth refresh failures (`Failed to fetch` / `Load failed`) appeared up to 21:02 Madrid, often near WebSocket disconnects and Convex query responses taking 20–58 seconds. Some `/api/auth` requests were challenged by Vercel, but the evidence did not establish that the firewall caused every client failure. Two middleware 504s at approximately 19:13–19:14 also had no established root cause.

**Lesson.** Correlate browser events, edge decisions, route logs, Convex executions, and deployment times before choosing a fix. Separate auth rejection, edge rejection, function timeout, backend latency, and transport loss. Do not hide all fetch errors or assume reconnects mean Convex functions failed.

**Verification.** State the timezone, exact interval, source, pagination/retention limits, and last occurrence. The Convex CLI sample available during this investigation covered only roughly 2,000 recent completions around 21:18–21:20 and contained no function errors; it did not establish that Convex was error-free since 17:00. No recurrence in a short sample is not proof of resolution. Recheck comparable traffic after a mitigation and report remaining uncertainty.

## 2026-09-18 — Unexpected API failures need server diagnostics

**Evidence.** `/api/cli/rpc` returned 21 HTTP 500s against 8,687 HTTP 200s in the investigated period. Its catch block converted exceptions to responses without logging the failing function, so historical logs could not identify the root cause.

**Correction.** [PR #154](https://github.com/HackSpain/hackspain26/pull/154) logs function name/kind and normalized error name/message for unexpected 500 responses in [the RPC route](../apps/app/src/app/api/cli/rpc/route.ts). Request arguments and bearer tokens are excluded.

**Prevention and verification.** When catching and normalizing an exception at an API boundary, retain safe diagnostics for unexpected server failures. Use [reportServerEvent](../apps/app/src/lib/server-observability.ts), which flushes before a Vercel function can freeze. Review error messages as well as structured fields for secrets; never log whole requests, bodies, cookies, OTPs, or tokens. Preserve client error envelopes and expected validation outcomes. Confirm the next failure identifies the operation and cause. Instrumentation makes a failure diagnosable; it does not repair the underlying 500. Post-deploy recurrence/root-cause verification remained outstanding at the end of this investigation.

## 2026-09-18 — Classify expected auth failures and extension noise precisely

**Evidence.** The log window included 34 `BAD_OTP`, four `OTP_EXPIRED`, and 12 errors attributed to injected MetaMask code. These should not all count as application server failures, but genuine auth delivery/transport failures must remain visible.

**Corrections.** [PR #156](https://github.com/HackSpain/hackspain26/pull/156) upgraded `@convex-dev/auth` from 0.0.90 to 0.0.95 and its `@auth/core` peer from 0.37.0 to 0.41.3. The inspected upstream changes lowered expected auth-flow log levels and made failed code verification consistently return null tokens without consuming rejected codes. Frozen installation, app typecheck, and three OTP route tests passed. These tests do not replace checking production login and refresh after deployment.

[PR #155](https://github.com/HackSpain/hackspain26/pull/155) added a browser-only filter in [telemetry-sanitize.ts](../apps/app/src/lib/telemetry-sanitize.ts) for known extension URL schemes and the observed exact `app:///scripts/inpage.js` frame. Application request sanitization remains in place; focused tests cover filtering and preservation of ordinary errors.

**Prevention and verification.** Read dependency behavior and peer requirements before patching around SDK errors. Keep domain error codes intact. Filter noise using narrow source/stack evidence, not broad message matches such as “Failed to fetch” or “MetaMask.” Inspect mixed application/extension stacks before expanding a filter: extension presence alone does not prove every failure is harmless. Verify genuine application errors still arrive and retain request sanitization in browser/server/edge hooks.

## 2026-09-18 — A GitHub 404 can be repository configuration or access

**Evidence.** Convex `githubFeed:pollRepos` warned about a configured team repository; a separate authenticated GitHub request also returned 404. This established inaccessibility with the credentials used, not whether the repository was deleted, private, misspelled, or renamed.

**Prevention and verification.** Check the team's configured repo URL and the deployment token's access before changing poller logic. A developer's local GitHub session does not establish deployment-token permissions. Keep authenticated polling, ETags, and deduplication; retries cannot repair a bad URL or missing access. Verify a successful poll after the configuration/access correction. That correction was still outstanding when investigated.

## 2026-09-18 — Mergeable, checked, deployed, and fixed are different states

**Evidence.** GitHub marked all four incident PRs mergeable while some Vercel previews were pending. PR #156's CLI CI failed on formatting in untouched `apps/cli/src/commands/submit.ts` and `apps/cli/test/menu.test.ts`; those files matched the base branch, whose CLI CI was also failing. Dependency changes can trigger CLI CI through the shared lockfile even when no CLI code changes.

**Prevention.** Inspect checks for the current commit and identify failed steps before recommending a merge. Do not report inherited failures as new regressions or claim all checks passed. Do not add unrelated formatting or harness changes to make an incident PR green. Run tests with the correct runner (`bun:test` needs Bun).

**Deployment verification.** The dashboard's [Vercel configuration](../apps/app/vercel.json) runs `pnpm vercel-build`, which deploys Convex and builds Next.js using the configured deployment key. Production keys belong only to the Production environment; previews need separate preview configuration. Do not run an extra laptop production deploy merely because a dependency changed. Verify the production deployment and user-facing behavior after merge. PRs #153–#156 were present in `master` at `5bec539` when this document was written; that establishes merge status, not production recovery. Firewall publication and code deployment are separate operations.

## 2026-09-18 — Team listing latency came from sequential reads

**Evidence.** In a production sample of 1,984 Convex completions, teams:list ran 396 times. Its 339 uncached executions had a 1,975 ms median, 2,629 ms p95, and up to 909 documents read. The handler waited for each team's members, submission, tracks, and profiles before starting the next team's reads.

**Correction and verification.** Keep the response and access wrapper unchanged, but start independent reads together with Promise.all. The change reduces serialized wait time rather than document count. Compare uncached execution time after deployment; do not claim fewer database reads or treat this latency as the cause of unrelated browser disconnects.

## 2026-09-18 — Stale agent instructions can reintroduce removed behavior

**Evidence.** The previous `AGENTS.md` simultaneously called Insights mock-only and described live insights, documented a superseded RawTree dual-write path, and said projects could enter multiple tracks despite the current one-track validation. The dashboard README also explicitly forbade the auth bypass needed to correct the observed firewall problem.

**Correction and prevention.** Keep agent instructions focused on coding invariants and pointers. Read the current implementation when documentation conflicts, then fix the relevant documentation with the task. Current telemetry ingestion exports OTLP logs, and insights read those logs with permanent event deduplication; do not revive the old custom-table write or add a second source of truth. `challengeIds` remains an array but its name/type does not imply multiple tracks are allowed. Put dated evidence and operational lessons here instead of appending implementation histories or “this branch” status to `AGENTS.md`.
