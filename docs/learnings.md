# Engineering learnings

Add an entry only for an evidenced, non-obvious project fact that helps prevent a recurring or costly mistake. Skip routine debugging, generic advice, and unverified theories. Each entry should explain the symptom, evidence/cause, corrective action, and prevention/verification. Separate a confirmed cause from a hypothesis, a mitigation from a fix, and a merged change from a verified production result. Update related entries instead of appending duplicates. Do not include credentials, raw request bodies, OTPs, or participant data.

## 2026-09-23 - Commander exit overrides reach only the subcommands created after them

**Evidence and consequence.** `runToExitCode()` and the menu's `dispatch()` called `program.exitOverride()` and `program.configureOutput()` on the root after `buildProgram()` had registered every subcommand. Commander copies both settings in `copyInheritedSettings()` while `.command()` creates a subcommand, and never again, so the root threw `CommanderError` while `team join`, `feed --bogus` and every other subcommand still called `process.exit(1)`: usage errors exited 1 instead of 2, `--json` callers got no envelope on stdout, and a Commander error inside the interactive menu killed the menu (#330). The unit tests passed because they built a bare `Command` and let `runToExitCode()` configure it before any subcommand existed.

**Correction and prevention.** `overrideExits()` in `apps/cli/src/lib/run.ts` applies both settings to the root and, recursively, to `program.commands`; `runToExitCode()` and the menu dispatcher call it on whatever program they receive. Commander configuration that must reach subcommands goes either before the `register*` calls in `buildProgram()` or into that recursive helper. `addCommand()` never copies inherited settings, not even before registration.

**Verification.** `bun src/index.ts --json team join` exits 2 with one `{"ok":false,"code":"USAGE",…}` line on stdout and `bun src/index.ts feed --bogus` exits 2. `test/run.test.ts` exercises a subcommand usage error through `buildProgram()`, not only through a bare program.
## 2026-09-23: Production Convex can run code that master never had

**Evidence and consequence.** After the Vercel ignore script was fixed (#368), the first production build of the dashboard failed in `convex deploy` with `Schema validation failed`: a `linkedinProfiles` row carried `about` and `education`, which the validator on master does not declare. `npx convex data linkedinProfiles --prod --format jsonl` (read-only) showed 291 rows, 201 with those fields, all created within 15 seconds on 2026-09-21 at 15:49 UTC. `npx convex function-spec --prod` listed `directory:importLinkedinProfiles`, a function that exists in no pushed branch, and a `saveLinkedinProfile` whose args already accept both fields. Someone deployed a local branch straight to production and ran the import. Every deploy from master was blocked until the table validator accepted the rows, and the next successful deploy replaces the production functions with master's, so the unpushed import disappears from production.

**Correction and prevention.** The validator now carries `about`, `education` and `skills` as optional fields with the shapes production's `saveLinkedinProfile` accepts (`education` items are `{ name, detail? }`, `skills` is `string[]`), and a test validates that shape with `convex-helpers/validators`. Production Convex is only ever the dashboard's Vercel build of master; code deployed by hand must reach master before the next build, or its functions vanish and its rows can block the schema push. When a production build fails on schema validation, run `convex function-spec --prod` and `convex data <table> --prod --format jsonl` first: both are read-only and tell whether the offending rows came from master or from a direct deploy. Do not delete the rows to make the push pass; extend the validator or migrate the data on purpose.

## 2026-09-22 — The landing legal footer is an in-flow flex item, not fixed

**Evidence and consequence.** The first legal footer (3eef3b4) was
`position: fixed; bottom: 0` in `layout.astro`. It covered the mosaic's bottom
band on `/` (social links, credits, © row) and the last lines of every
scrolling page. Making `<body>` a flex column exposed a second trap: with
`html, body { height: 100% }` the body had a definite height, so a `main` with
an explicit `min-h-dvh` (privacy, conduct) shrank to 100dvh and its content
overflowed across the footer. An explicit min-height disables a flex item's
automatic content-based minimum. A third trap: the text pages keep a
`fixed inset-0 -z-10` mosaic backdrop inside a `relative z-0` root, which paints
above a static sibling, so a non-positioned footer was invisible under it.

**Correction and verification.** Body is `flex flex-col` plus `h-dvh
overflow-hidden` (no scroll) or `min-h-dvh` (scroll); only `html` keeps
`height: 100%`, so the body grows with content. The footer is an in-flow
`relative z-10 shrink-0` item after the slot. Full-viewport pages (`/`, `/comparte`,
confirmed `/confirmacion`) size their root with `flex-1 min-h-0` and children
use `h-full`, never `h-dvh` or `fixed inset-0`. Short centered pages (`/404`,
`/cancelacion`) use `flex-1` instead of `min-h-dvh` so the footer stays in view.
Verify with headless Chrome at 1440×900 and 390×844: on `/` the stage bottom
must equal the footer top, and `/privacy` scrolled to the end must show the
footer after the text.

## 2026-09-21 — Directory GitHub GraphQL needs GITHUB_TOKEN, not the OAuth app

**Evidence and consequence.** `/participantes` showed “GitHub no responde” on the
person sheet. `hasGithubAuth()` is true whenever `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET` exist, so the directory action posted GraphQL with Basic
auth. GitHub GraphQL only accepts a bearer token; REST public user/repo reads do
not need one.

**Correction and verification.** Call GraphQL only when `GITHUB_TOKEN` is set.
Otherwise (and on GraphQL HTTP errors other than 403/429) read
`/users/{login}` and `/repos`. Unit tests cover the REST payload mapper. After
deploy, open a ficha with a public GitHub: profile and recent repos should
render without the token; the contribution calendar still needs `GITHUB_TOKEN`.

## 2026-09-21 — Directory person usage is a Next query, not a Convex action

**Evidence and consequence.** CLI telemetry is stored only in RawTree
(`hackspain_otel_logs`), keyed by `hackspain.user.id`. `RAWTREE_API_KEY` lives
on the Vercel dashboard (ingestion + `/api/tv/insights`), not on Convex. A
Convex action would look unconfigured even when Insights works.

**Correction and verification.** `/api/directory/usage` authenticates with the
cookie session, gates with `directory.usageWindow`, and reuses the TV dedupe
CTE scoped to one user id. Tests cover the allowlisted id interpolation and
the harness/model rollup. Do not name RawTree on the sponsor ficha.

## 2026-09-19 — Historical telemetry needs source replay, not just saved cursors

**Evidence and consequence.** Login did not collect history; file modification filters,
shallow Claude discovery and OpenCode/Kilo timestamp-only pagination could omit retained
records. A local-only run could also advance cursors before any upload.

**Correction and verification.** Use the configured event start and end consistently across
CLI collection, ingestion and Insights. On login and watcher startup, replay retained source
records and the current user's spool with stable ids; never treat spool presence as proof of
delivery or append another spool copy on replay. Tests cover old mtimes, archived/nested
sessions, over 500 equal-timestamp database rows, unfinished Cline requests, exact start
boundaries, schedule changes, and authenticated HTTP recovery across all harness ids after
saved cursors. Cursor history predating hooks has no token counters; do not claim it is
reconstructible.

Antigravity has separate `antigravity-cli`, `antigravity` and `antigravity-ide` roots
under `~/.gemini`; discovering only the CLI root excluded desktop/IDE users.
The [community compatibility audit](https://github.com/mjacobs/agy-reader/blob/main/COMPATIBILITY.md)
reports the shared SQLite schema, and [a reader targeting all three roots](https://github.com/hacklabubu/cli/blob/main/src/scanners/antigravity.ts)
reads `steps.metadata` usage. Preserve conversation/step event ids across roots so migrated
copies deduplicate. Tests cover IDE-only discovery, incremental reads and duplicate delivery;
participant IDE validation remains outstanding. The IDE reasoning field is unverified and
must stay omitted until checked against real counters; missing summaries leave project unset.

## 2026-09-19 — Native telemetry and transcripts have different event identities

**Evidence and consequence.** [Claude Code's native API event](https://code.claude.com/docs/en/monitoring-usage#api-request-event)
identifies a request by `request_id`; the transcript collector uses `message.id` as its event id
and already retains transcript `requestId` in `native.requestId`. Enabling both inputs without
correlation counts one API response twice. The documented event sequence resets per process,
so it cannot replace request identity across restarts. Native logs also contain account/resource
attributes that do not belong in HackSpain telemetry.

**Correction and verification.** Keep existing event ids and schema v2. Apply the same additional
user/session/request alias in the scanner, local replay, stats and ingestion. Insights first
collapse retries by user/event, then correlate Claude request ids and prefer the native record.
Allowlist usage before writing the receiver queue, and enforce the event window before its
acknowledgement. Tests cover both arrival orders, participant isolation, native HTTP reception,
restart, transcript fallback and preservation of existing exporter settings. No request id means
transcript fallback, not a timestamp or sequence heuristic. Cursor's documented native export is
Enterprise/server-side to public HTTPS; it cannot be wired to a participant's loopback listener.

A review reproduced a crash/retry regression when all spool records were treated as delivered:
spool writes can succeed before an upload has even been staged. Rebuild delivery aliases only
from successfully checkpointed recent ids; keep the board's local deduplication separate. Test
restart with the actual spool and a failed sink, not an empty injected history. When adding a
new Insights aggregate, use the same request correlation for people, models and team totals.

## 2026-09-19 — Watcher discovery and checkpoints can fail independently

**Evidence and consequence.** Discovery and hook-window writes ran outside collector error
boundaries, and setup ran only at startup. A discovery exception could end the entire watcher;
a tool installed later could remain unprepared. Cursor hook commands also inherited the GUI's
state-directory environment instead of the watcher's, so custom XDG state could split the window
and event log. The inspected Cursor extension-host runtime executes Windows hooks through
PowerShell (and supplies its call operator for quoted executables); use literal single-quoted
arguments with doubled apostrophes, not expandable double quotes or Unix backslash escapes.
Devin discovery used a Unix-only data path even though
[Cognition documents](https://docs.devin.ai/cli/troubleshooting) its
Windows data directory under `%APPDATA%\devin\cli`.

The scanner queued an entire catch-up before flushing into buffers capped at 5,000 events;
excess events were removed before either sink wrote them. Shutdown saved cursors even after a
failed flush. Tests reproduce this with over 5,000 events and with a failing sink across restarts.

**Correction and verification.** Retry isolated preparation/discovery each scan, pin Cursor's
recorder paths in its command, and use Devin's platform data root with an explicit path override.
Read Devin by bounded row-id pages instead of trusting mtime equality; validate each usage row,
observe live WAL writes, and reset watermarks on replacement or a lower maximum row id. Flush
before filling a batch; defer scanning on failure without committing unread source positions.
Persist shutdown cursors only after successful delivery. Render the last diagnostic rather than
keeping errors in invisible screen state. Keep focused tests for these cases; simulated path
resolution alone is not verification on a native Windows machine.

A Linux ARM64 container running Bun 1.3.11 also reproduced a hook exiting successfully without
reading redirected file input through `process.stdin`; the native `Bun.stdin.stream()` read both
file-backed input and a pipe. macOS with Bun 1.4.0 did not reproduce that input failure.
The original participant reports did not include enough detail to establish that these were
their only causes.

## 2026-09-19 — TV presence does not prove configuration delivery

**Evidence and consequence.** Named screens sent HTTP heartbeats but ignored their
configuration responses, making command delivery depend entirely on WebSocket.
In a local browser with the Convex WebSocket unavailable, a controlled successful
heartbeat response rendered its notice only after restoring HTTP delivery. A later
response with a lower revision did not replace it. This verifies the fallback;
the reported Safari tablet failure has not been reproduced on the affected device.

**Prevention and verification.** Apply heartbeat configurations through the same
reload/version handling as subscriptions. Discard HTTP responses overtaken by a
subscription and never roll back either configuration or reload versions, including
after WebSocket reconnects. HTTP connectivity covers configuration and commands;
individual live widgets still need their own subscriptions. Verify the affected
tablet after deployment before claiming the Safari incident is resolved.

## 2026-09-19 — Copilot CLI usage is cumulative and shutdown-only

**Evidence and consequence.** Copilot CLI's released session schema stores per-model token totals
in `session.shutdown.data.modelMetrics` under
`~/.copilot/session-state/<session>/events.jsonl`. The runtime normalizes `inputTokens` as the
total including cache reads and writes, while the session log records another cumulative shutdown
when a session is resumed. Counting every shutdown as an independent request would double-count
the earlier portion; treating `inputTokens` as uncached would double-count cache tokens. There is
no equivalent stable local usage record for editor Copilot Chat or cloud coding-agent sessions.

**Prevention and verification.** Persist the last per-model totals in the file cursor, emit only
non-negative growth, and subtract both cache counters from canonical input. Use the shutdown id
plus sorted model index for stable event ids. Attribute usage to the shutdown timestamp and state
the limitation: a crash, a session left open past the event, or a CLI transition that omits the
shutdown cannot be reconstructed. Fixtures must cover cache normalization, resumed-session
deltas, restart cursors, and the session-directory fallback.

## 2026-09-19 — Cursor usage is available at hook time, not in transcripts

**Evidence and consequence.** Current Cursor agent transcripts under `~/.cursor/projects` retain
messages but no token usage. Cursor's current local runtime passes `conversation_id`,
`generation_id`, model, version, workspace roots, and input/output/cache counters to the
`afterAgentResponse` user hook. Treating the transcript as a usage source would either report
fabricated estimates or leave Cursor invisible.

**Prevention and verification.** Install additive `afterAgentResponse` and `stop` hooks from `hackspain watch`, preserve
unrelated Cursor hooks and replace obsolete HackSpain commands, and allowlist only usage metadata into HackSpain's private local state;
never retain the hook's response text or user email. Cursor input includes cache reads and writes,
so subtract both before canonicalization. Deduplicate with `(conversation_id, generation_id)` and
accept that sessions before installation and cloud agents cannot be backfilled. Focused tests must
cover hook merging, the privacy allowlist, cache normalization, restart deduplication, and invalid
configuration failing without overwriting the user's file.

## 2026-09-19 — GitHub Insights reads the feed's canonical event names

**Evidence.** GitHub's API sends `PushEvent` and `PullRequestEvent`, but `githubFeed:pollRepos` deliberately stores the normalized values `push` and `pull_request` in feed posts. Insights compared stored posts with the upstream API names, so production returned zero GitHub activity even when the feed contained events. Teams may link several repositories, so one ETag on the team also cannot represent every poll target.

**Prevention and verification.** Keep stored GitHub event names in the shared `GITHUB_FEED_EVENTS` contract and aggregate those canonical values. Poll the submission repo and every URL from `teamRepoList`, retaining ETags per repository with the old primary ETag only as a migration fallback. When neither source declares a repo, the CLI may fall back to a GitHub origin observed from an authenticated agent session; sanitize it locally to `owner/repo`, never transmit the raw remote or path, and never let an observed repo override official project configuration. Focused tests must cover API-to-feed normalization, the names accepted by Insights, official-source precedence, observed fallback, credential removal, and Git worktrees.

## 2026-09-19 — Sanitize remote text before adding terminal styling

**Evidence and consequence.** Feed fields reached the CLI renderer before sanitization, and `fit()` returned strings unchanged when they already fit. Bun reproduced OSC clipboard, hyperlink, cursor, DCS, and C1 sequences as terminal instructions rather than visible text, so a participant-controlled post could forge terminal output or modify the clipboard in compatible terminals.

**Correction and prevention.** Pass every remote feed field through `terminalText()` before applying HackSpain's own ANSI styling. That boundary uses Bun's maintained ANSI parser, removes residual Unicode control and bidirectional formatting characters, and preserves only tabs and line feeds needed by the renderer. Do not sanitize after adding trusted colors, and do not rely on truncation as a security boundary.

**Verification.** Keep focused feed tests for OSC 52, OSC 8, CSI, DCS, carriage returns, and bidirectional controls, alongside the full CLI check. New terminal surfaces that render server, repository, or participant data must use the same boundary.

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

**Follow-up, 2026-09-19.** Better Stack recorded the same refresh transport failure
with `@convex-dev/auth` 0.0.95. Its `verifyCode` exhausts two short network retries
and throws; Convex 1.45.0's scheduled `refetchToken` does not catch that rejection
or schedule recovery. The dashboard now wraps the public auth token-fetcher hook,
keeping a forced refresh pending across recognized browser network errors and
retrying after 15 seconds or an online event. Concurrent calls share the attempt;
logout/unmount cancels recovery. SDK token storage and cross-tab locking are
unchanged. Report the first transport failure, preserve null-token responses and
non-network errors, and never describe this as a repair of the underlying network
or edge rejection. Tests cover recovery, cancellation, concurrent calls, and
preservation of SDK outcomes. Production recovery still needs verification.

## 2026-09-18 — Unexpected API failures need server diagnostics

**Evidence.** `/api/cli/rpc` returned 21 HTTP 500s against 8,687 HTTP 200s in the investigated period. Its catch block converted exceptions to responses without logging the failing function, so historical logs could not identify the root cause.

**Correction.** [PR #154](https://github.com/HackSpain/hackspain26/pull/154) logs function name/kind and normalized error name/message for unexpected 500 responses in [the RPC route](../apps/app/src/app/api/cli/rpc/route.ts). Request arguments and bearer tokens are excluded.

**Prevention and verification.** When catching and normalizing an exception at an API boundary, retain safe diagnostics for unexpected server failures. Use [reportServerEvent](../apps/app/src/lib/server-observability.ts), which flushes before a Vercel function can freeze. Review error messages as well as structured fields for secrets; never log whole requests, bodies, cookies, OTPs, or tokens. Preserve client error envelopes and expected validation outcomes. Confirm the next failure identifies the operation and cause. Instrumentation makes a failure diagnosable; it does not repair the underlying 500. Post-deploy recurrence/root-cause verification remained outstanding at the end of this investigation.

The same rule applies to the authenticated image proxy. A burst of 154 upstream 502 responses could not be separated into network failure, upstream status, or missing response body. Log those categories and thumbnail conversion failures without recording storage URLs, ids, credentials, or request data. This instrumentation makes the next occurrence diagnosable; it is not evidence that the upstream failure has been repaired.

## 2026-09-18 — Classify expected auth failures and extension noise precisely

**Evidence.** The log window included 34 `BAD_OTP`, four `OTP_EXPIRED`, and 12 errors attributed to injected MetaMask code. These should not all count as application server failures, but genuine auth delivery/transport failures must remain visible.

**Corrections.** [PR #156](https://github.com/HackSpain/hackspain26/pull/156) upgraded `@convex-dev/auth` from 0.0.90 to 0.0.95 and its `@auth/core` peer from 0.37.0 to 0.41.3. The inspected upstream changes lowered expected auth-flow log levels and made failed code verification consistently return null tokens without consuming rejected codes. Frozen installation, app typecheck, and three OTP route tests passed. These tests do not replace checking production login and refresh after deployment.

[PR #155](https://github.com/HackSpain/hackspain26/pull/155) added a browser-only filter in [telemetry-sanitize.ts](../apps/app/src/lib/telemetry-sanitize.ts) for known extension URL schemes and the observed exact `app:///scripts/inpage.js` frame. Application request sanitization remains in place; focused tests cover filtering and preservation of ordinary errors.

**Prevention and verification.** Read dependency behavior and peer requirements before patching around SDK errors. Keep domain error codes intact. Filter noise using narrow source/stack evidence, not broad message matches such as “Failed to fetch” or “MetaMask.” Inspect mixed application/extension stacks before expanding a filter: extension presence alone does not prove every failure is harmless. Verify genuine application errors still arrive and retain request sanitization in browser/server/edge hooks.

## 2026-09-18 — Request sanitization does not cover every URL

**Evidence.** Better Stack contained CLI handoff credentials in Vercel proxy paths and referers, and browser error breadcrumbs retained the same query parameters. The existing sanitizer removed request query strings but did not inspect breadcrumbs. No credential values belong in this file, and the observation does not establish misuse.

**Correction and prevention.** New CLI links place `hs-code` and `hs-token` in URL fragments, which browsers do not send in HTTP requests. The dashboard still accepts query links from older CLI versions and removes either form after reading it. Error breadcrumbs redact the known authentication parameters as a second layer. Old CLI links can still reach the proxy log before client code scrubs them, so verify the result after the updated CLI is distributed and handle retention of historical logs separately. The move also created a client-side trap: any code that copies `window.location` for a later redirect must include `hash`, or the credential is lost. The auth gate's login return-to stashed `pathname + search` only and accepted `/cli-auth?` alone, so fragment links landed on `/` after sign-in (#275). Both helpers now live in `apps/app/src/lib/cli-handoff.ts` with unit tests; add a case there before changing the link shape again.

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

**Follow-up, 2026-09-19.** A later production sample still measured 52 uncached
`teams:list` executions with a 2.22 s median and one execution reading 937 documents.
Parallel reads alone did not eliminate repeated track reads or signup lookups for
already-named users. Reuse track promises only within one handler invocation and
read a signup only when the user's name is nullish. Preserve empty names, deleted
track handling, owner order, and the authorization wrapper. Regression tests cover
these outputs and read counts; measure production latency after deployment rather
than equating fewer reads with a guaranteed duration.

## 2026-09-18 — Stale agent instructions can reintroduce removed behavior

**Evidence.** The previous `AGENTS.md` simultaneously called Insights mock-only and described live insights, documented a superseded RawTree dual-write path, and described unrestricted multi-track projects despite the track-combination validation. The dashboard README also explicitly forbade the auth bypass needed to correct the observed firewall problem.

**Correction and prevention.** Keep agent instructions focused on coding invariants and pointers. Read the current implementation when documentation conflicts, then fix the relevant documentation with the task. Current telemetry ingestion exports OTLP logs, and insights read those logs with permanent event deduplication; do not revive the old custom-table write or add a second source of truth. A project may enter one track, or exactly two when one is THEKER; enforce that rule in participant and admin writes rather than inferring policy from the `challengeIds` array type. Put dated evidence and operational lessons here instead of appending implementation histories or “this branch” status to `AGENTS.md`.

## 2026-09-19 — TV heartbeat cleanup must exclude live peers from its read set

**Evidence and consequence.** Production Convex Insights reported 80 retried
`tvPlayback:heartbeat` operations against `tvScreenConnections` in its 72-hour
window. Every heartbeat patched its own connection and then collected all peers
for the screen, so another device's presence update invalidated that read set.
The sample did not show permanent OCC failures.

**Correction and verification.** Use the `screenId,lastSeenAt` index to read only
connections older than 24 hours, deleting at most 100 per heartbeat. Excess old
connections are removed by later heartbeats. A regression test records the read
set and verifies that live peers and other screens are not read or deleted.
Check production conflict counts after deployment; this does not claim to fix
unrelated TV transport or rendering failures.

## 2026-09-23 — The Vercel ignore script must survive a shallow clone

**Evidence and consequence.** Every `hackspain-app` production build from
115d6cb (13:10) to 072c834 failed before installing anything, with
`fatal: bad object 4a7cb74…` from the ignoreCommand
`scripts/vercel-ignore.sh`. Vercel clones shallowly and sets
`VERCEL_GIT_PREVIOUS_SHA` to the last *successful* deployment; skipped builds
("Not affected") do not move it. After two days of landing-only commits that
commit was outside the clone, `git diff --quiet $prev HEAD` exited 128, and
`set -e` turned that into the script's exit code. Only 0 (skip) and 1 (build)
mean anything to Vercel; anything else fails the deployment. Because failed
builds do not move the previous SHA either, every later build failed the same
way, including docs-only commits. Production Convex kept serving the 09-21 code
(verified with `convex function-spec --prod`: `byEmail` still present), so no
partial deploy happened. The landing project was not affected.

**Correction and verification.** The script now fetches the previous commit by
SHA (`git fetch --depth=1 origin $prev`, which GitHub allows) when it is not in
the clone, builds with a stderr note when it still cannot see it, and maps any
`git diff` error to exit 1. Tested on a fresh `--depth 2` clone from GitHub
with `4a7cb74` as the previous SHA: the old script exits 128, the new one exits
1 for `apps/app` (changed) and 0 for an unchanged path.

**Prevention.** A red `Vercel – hackspain-app` status on master with the last
green deploy days back is this failure until the log says otherwise; the log
is one line, before "Running install command". Never let the ignoreCommand exit
with anything but 0 or 1. Keep the paths argument list in
[apps/app/vercel.json](../apps/app/vercel.json) in sync with what the dashboard
build reads.

