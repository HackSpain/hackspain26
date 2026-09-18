# Telemetry schema `hackspain.telemetry.v1`

What `hackspain watch` records and sends, regardless of which AI coding harness produced it.
Source of truth for the TypeScript type and validator: `apps/cli/src/watcher/schema.ts`.

The watcher writes every event to a local spool
(`~/.local/state/hackspain/telemetry/YYYY-MM-DD.ndjson`, one JSON object per line) and, when a URL
is configured, POSTs the same lines as `application/x-ndjson` with
`Authorization: Bearer <Convex JWT>`. The dashboard verifies the participant and inserts accepted
events through the RawTree TypeScript SDK. RawTree stores the canonical objects in
`hackspain_telemetry` by default.

Before an HTTP request, the CLI atomically saves the exact batch in a per-user pending-upload file.
It removes that file only after a successful response, and retries it on the next flush or process
start. The server sorts the accepted rows and sends RawTree a stable ClickHouse insert-deduplication
token derived from the authenticated user and event ids. RawTree insert deduplication has a finite
window, so every downstream query must still treat `(identity.userId, eventId)` as the permanent
logical key.

The dashboard receipt accounts for every input line as accepted or rejected. Rejections include a
bounded event id, line number, and reason; the CLI records them in
`~/.local/state/hackspain/telemetry-upload-rejections.ndjson` and leaves the original event in the
local spool. Batches contain at most 200 events, and each event is limited to 32 KiB.

## Event

| Field | Type | Notes |
| --- | --- | --- |
| `schema` | `"hackspain.telemetry.v1"` | Bump for breaking changes |
| `type` | `usage` \| `session.start` \| `session.end` | `session.end` is reserved; no harness emits it yet |
| `eventId` | string | `${harness}:${sessionId}:${nativeId}`. Global dedupe key for queries and downstream processing |
| `occurredAt` | ISO-8601 UTC | When the harness recorded it. The hackathon window and every time bucket use this one, so usage read days later still lands when it happened |
| `observedAt` | ISO-8601 UTC | When the watcher read it |
| `harness` | `claude-code` \| `codex` \| `cursor` \| `opencode` \| `cline` \| `copilot` \| `gemini-cli` \| `qwen-code` \| `kilo-code` | Same ids as the insights dashboard. `cursor` and `copilot` have no local logs, so no collector yet |
| `harnessVersion` | string? | e.g. Claude Code `2.1.261`, Codex `0.130.0` |
| `sessionId` | string | Harness session / task id |
| `project` | `{ dirHash, name, gitBranch? }`? | `dirHash` = first 16 hex of sha256(cwd); `name` = basename only. Never a full path |
| `model` | `{ raw, family, provider? }`? | `family` ∈ `claude` \| `gpt` \| `gemini` \| `qwen` \| `other`; the insights mock still shows four buckets and folds `qwen` into `other` |
| `tokens` | `{ input, output, cacheRead, cacheWrite, reasoning? }`? | Non-negative integers. Required for `usage`. For every harness `input` excludes cache reads and `output` includes `reasoning` (which is a breakdown, never added on top) |
| `costUsd` | number? | Only when the harness itself reports a price |
| `identity` | `{ userId, teamId?, clientVersion }` | Stamped by the CLI from the logged-in user and their team at flush time |
| `native` | object? | Allowlisted harness-specific remainder. Currently only Claude `requestId` |

Derived values for the dashboard: `tokens.total = input + output + cacheRead + cacheWrite`,
`cachedTokens = cacheRead + cacheWrite`, sessions = distinct `sessionId` per harness, 30-minute
buckets on `occurredAt`.

## Per-harness mapping

| Harness | Source | Session id | `nativeId` | input | output | cacheRead | cacheWrite | model |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| claude-code | `~/.claude/projects/<slug>/<session>.jsonl`, lines with `type: "assistant"` | `sessionId` | `message.id` (several lines per response repeat it: dedupe) | `usage.input_tokens` | `usage.output_tokens` | `usage.cache_read_input_tokens` | `usage.cache_creation_input_tokens` | `message.model` (skip `<synthetic>`) |
| codex | `~/.codex/sessions/**/rollout-*.jsonl`, `event_msg` with `payload.type: "token_count"` | `session_meta.payload.session_id` | line index | `last_token_usage.input_tokens − cached_input_tokens` | `output_tokens` | `cached_input_tokens` | `cache_write_input_tokens` | `turn_context.payload.model` |
| opencode | `~/.local/share/opencode/opencode.db`, table `message`, assistant rows with `time.completed` | `session_id` | message `id` | `tokens.input` | `tokens.output` | `tokens.cache.read` | `tokens.cache.write` | `modelID` + `providerID` |
| cline | VS Code globalStorage `saoudrizwan.claude-dev/tasks/<task>/ui_messages.json`, `say: "api_req_started"` | task id | entry `ts` | `tokensIn` | `tokensOut` | `cacheReads` | `cacheWrites` | `task_metadata.json` `model_usage` |
| gemini-cli | `~/.gemini/tmp/<project>/chats/session-*.jsonl` (subagents one level deeper), records with `type: "gemini"` and a `tokens` object (a turn is appended again with the same `id` once usage arrives: dedupe) | metadata line `sessionId`, else the file name's short id | message `id` | `tokens.input − tokens.cached` | `tokens.output + tokens.thoughts` | `tokens.cached` | 0 (implicit caching) | `model`; `tokens.thoughts` → `reasoning` |
| kilo-code | `~/.local/share/kilo/kilo*.db` (OpenCode fork, same `message` table; channel builds use `kilo-<channel>.db`) | `session_id` | message `id` | `tokens.input` | `tokens.output` | `tokens.cache.read` | `tokens.cache.write` | `modelID` + `providerID` |
| qwen-code | `~/.qwen/projects/<slug>/chats/<session>.jsonl` (`QWEN_HOME` overrides), records with `type: "assistant"` and `usageMetadata` | `sessionId` | record `uuid` | `promptTokenCount − cachedContentTokenCount` | `candidatesTokenCount`, plus `thoughtsTokenCount` when the total counts it apart | `cachedContentTokenCount` | 0 | `model`; `thoughtsTokenCount` → `reasoning`; `version` → `harnessVersion` |

Reasoning tokens go to `tokens.reasoning` when the harness reports them (Claude thinking,
Codex `reasoning_output_tokens`, OpenCode `tokens.reasoning`, Gemini CLI and Qwen Code thought
counts). Codex, OpenCode, Gemini CLI and Qwen Code formats are written from their documented
shapes or recorder source and fixtures, not from a local install; collectors log and skip
anything they cannot parse. Gemini-style prompt counts include the cached part, so `input` is
the prompt minus the cache read for those two.

Gemini-style usage and OpenCode (so Kilo Code too) keep reasoning next to the output count, while
Claude and Codex already include it. OpenCode was checked against a real database: total 31456 =
input 39 + output 74 + reasoning 111 + cache read 31232. `outputWithReasoning` (`schema.ts`) settles it per
record from the harness's own total: thoughts are added only when the total counts them apart.
Without a total, Gemini CLI and OpenCode add them and Qwen Code does not (it converts
OpenAI-style usage, where completion tokens include reasoning).

## Collection window

Nobody records outside the hackathon window, and nothing outside it is stored. The window is
`[startsAt, endsAt)` from `users.me.event`, applied to `occurredAt`, for every account (organisers
included). No scheduled hackathon means no window and nothing recorded.

- CLI (`watcher/window.ts`): `since` is the start of the hackathon rather than the last run, so
  the whole window is reported no matter when the watcher was opened. It runs before the start
  (waiting), after the end (delivering what was never sent) and without a schedule (idle), showing
  "Not recording" in all three, and re-reads the window every five minutes. The cursor store
  remembers the earliest `since` it was read with (`coveredSince`); an earlier one (the first
  windowed run, or organisers moving the start) starts the cursors over, and event ids already in
  the local spool are skipped so nothing is sent twice.
- Server (`occurredInWindow` in `telemetry/rawtree.ts`): the route answers 403 before the start
  and rejects every event outside the window with `outside_event_window`, whatever the binary.
  Both the canonical table and the OpenTelemetry copy only ever receive accepted events.

Moving the window later does not remove rows stored under the old one; clean those in RawTree.

## OpenTelemetry copy

When `RAWTREE_OTLP_LOGS_TABLE` is set, the dashboard also sends each accepted batch to RawTree's
OTLP endpoint (`POST /otlp/v1/logs`, OTLP/JSON) for its OpenTelemetry explorer
(`apps/app/src/app/api/cli/telemetry/otlp.ts`). One log record per event: `timeUnixNano` is
`occurredAt`, `observedTimeUnixNano` is `observedAt`, `eventName` is `hackspain.<type>`.

| Event field | Log attribute |
| --- | --- |
| `eventId` | `event.id` |
| `sessionId` | `gen_ai.conversation.id` |
| `model.raw` / `model.provider` / `model.family` | `gen_ai.request.model` / `gen_ai.provider.name` / `hackspain.model.family` |
| `tokens.input` / `tokens.output` | `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` |
| `tokens.cacheRead` / `cacheWrite` / `reasoning` | `hackspain.usage.cache_read_tokens` / `cache_write_tokens` / `reasoning_tokens` |
| `costUsd` | `hackspain.cost_usd` |
| `harness` / `harnessVersion` | `hackspain.harness` / `hackspain.harness.version` |
| `identity.userId` / `teamId` | `hackspain.user.id` / `hackspain.team.id` |
| `identity.clientVersion` | resource `service.version` (`service.name` is `hackspain-cli`) |
| `project.*` | `hackspain.project.dir_hash` / `name` / `git_branch` |
| `native.requestId` | `hackspain.request.id` |

The copy is best effort and has no insert deduplication, so a retried batch can land twice: the
canonical table stays the source of truth, and queries on the logs table dedupe on
(`hackspain.user.id`, `event.id`).

## Privacy

- No prompt or response text, ever. Fixtures under `apps/cli/test/fixtures` are redacted and a
  test fails if a home path sneaks in.
- Working directories are hashed; only the last path segment is kept.
- No harness account ids. Identity is the HackSpain user and team.
- `native` keys are allowlisted in both CLI and server validation; unknown keys are rejected.
- Only the hackathon window is recorded; nothing from before or after it leaves the machine, and
  nothing at all while no hackathon is scheduled.

## Example

```json
{"schema":"hackspain.telemetry.v1","type":"usage","eventId":"claude-code:eb2f547c:msg_011CekYx","occurredAt":"2026-09-19T10:18:23.076Z","observedAt":"2026-09-19T10:18:30.002Z","harness":"claude-code","harnessVersion":"2.1.261","sessionId":"eb2f547c","project":{"dirHash":"9f2c1a7b3e4d5c6a","name":"agentos","gitBranch":"main"},"model":{"raw":"claude-fable-5-1","family":"claude","provider":"anthropic"},"tokens":{"input":2,"output":344,"cacheRead":26445,"cacheWrite":13687,"reasoning":127},"identity":{"userId":"j57…","teamId":"k97…","clientVersion":"0.1.0"},"native":{"requestId":"req_011…"}}
```
