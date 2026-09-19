# Telemetry schema `hackspain.telemetry.v2`

What `hackspain watch` records and sends, regardless of which AI coding harness produced it.
Source of truth for the TypeScript type and validator: `apps/cli/src/watcher/schema.ts`.

**One schema, one meaning per field.** Every field below means the same for every harness, and
every derived field (`model.name`, `model.family`, `model.provider`, `tokens.total`) comes from a
single pure module, `apps/app/src/app/api/cli/telemetry/canonical.ts`. The CLI runs it when it
stamps an event (`canonicalize`); the dashboard runs it again on ingestion and never trusts the
client's values. So exported logs are homogeneous across harnesses and CLI versions: a
`hackspain.telemetry.v1` event from a binary up to 0.4.x is accepted and canonicalised with the
same v2 semantics before export. What only some harnesses can report lives under `native`, which
is explicitly not comparable.

The watcher writes every event to a local spool
(`~/.local/state/hackspain/telemetry/YYYY-MM-DD.ndjson`, one JSON object per line) and, when a URL
is configured, POSTs the same lines as `application/x-ndjson` with
`Authorization: Bearer <Convex JWT>`. The dashboard verifies the participant, converts accepted
events to OTLP logs and sends them to RawTree's native `POST /otlp/v1/logs` endpoint. RawTree uses
the fixed `hackspain_otel_logs` table for both ingestion and Insights queries.

Before an HTTP request, the CLI atomically saves the exact batch in a per-user pending-upload file.
It removes that file only after a successful response, and retries it on the next flush or process
start. Native OTLP ingestion does not promise insert deduplication, so a retry can create another
physical row. Every downstream query treats (`hackspain.user.id`, `event.id`) as the permanent
logical key. Claude usage additionally correlates `(userId, sessionId, native.requestId)`
when present: native OTLP and old transcripts use different event ids for the same API response.
Keep both rules, including for historical v1/v2 rows; session starts retain their existing ids.

The dashboard receipt accounts for every input line as accepted or rejected. Rejections include a
bounded event id, line number, and reason; the CLI records them in
`~/.local/state/hackspain/telemetry-upload-rejections.ndjson` and leaves the original event in the
local spool. Batches contain at most 200 events, and each event is limited to 32 KiB.

## Event

| Field | Type | Notes |
| --- | --- | --- |
| `schema` | `"hackspain.telemetry.v2"` | Bump for breaking changes. v1 is accepted on ingestion and upgraded |
| `type` | `usage` \| `session.start` \| `session.end` | `session.end` is reserved; no harness emits it yet |
| `eventId` | string | `${harness}:${sessionId}:${nativeId}`. Global dedupe key for queries and downstream processing |
| `occurredAt` | ISO-8601 UTC | When the harness recorded it. The hackathon window and every time bucket use this one, so usage read days later still lands when it happened |
| `observedAt` | ISO-8601 UTC | When the watcher read it |
| `harness` | `claude-code` \| `codex` \| `cursor` \| `opencode` \| `cline` \| `copilot` \| `gemini-cli` \| `qwen-code` \| `kilo-code` \| `pi` \| `omp` \| `antigravity` \| `devin` | Same ids as the insights dashboard |
| `harnessVersion` | string? | e.g. Claude Code `2.1.261`, Codex `0.130.0` |
| `sessionId` | string | Harness session / task id |
| `project` | `{ dirHash, name, gitBranch?, repo? }`? | `dirHash` = first 16 hex of sha256(cwd); `name` = basename only. Never a full path. `gitBranch` is the harness's own when it logs one (Claude Code, Codex, Copilot CLI, Qwen Code), else read from the repository's `.git/HEAD`; absent outside a repository or on a detached HEAD. `repo` is only the sanitized `owner/name` of a `github.com` origin; the raw remote URL, credentials and non-GitHub remotes never leave the machine |
| `model` | `{ raw, name, family, provider }` | Required for `usage`. `raw` is exactly what the harness logged. `name` is the grouping key: lower case, no gateway path, variant tag, release date or cloud prefix, version dots as dashes, so `anthropic/claude-sonnet-4.5`, `claude-sonnet-4-5-20250929` and `us.anthropic.claude-sonnet-4-5-20250929-v1:0` are all `claude-sonnet-4-5`. `family` ∈ `claude` \| `gpt` \| `gemini` \| `qwen` \| `other`. `provider` is always set: who served the request when the harness says (as a slug, aliases folded), else who makes the model (`anthropic`, `openai`, `google`, `alibaba`, `unknown`) |
| `tokens` | `{ input, output, cacheRead, cacheWrite, total, reasoning? }`? | Non-negative integers. Required for `usage`. For every harness: `input` excludes cache reads, `output` includes `reasoning`, `total` = `input + output + cacheRead + cacheWrite`. `reasoning` is a breakdown of `output`, absent when the harness does not report it (Cline) |
| `identity` | `{ userId, teamId?, clientVersion }` | Stamped by the CLI from the logged-in user and their team at flush time |
| `native` | `{ requestId?, costUsd? }`? | What only some harnesses report, so never comparable across them. `requestId`: Claude Code. `costUsd`: the price OpenCode, Kilo Code and Cline compute themselves (top-level `costUsd` in v1). A cost that compares across harnesses has to be computed from `tokens` and `model.name` |

Derived values for the dashboard: `cachedTokens = cacheRead + cacheWrite`, sessions = distinct `sessionId` per harness, 30-minute
buckets on `occurredAt`.

## Per-harness mapping

| Harness | Source | Session id | `nativeId` | input | output | cacheRead | cacheWrite | model |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| claude-code (native OTLP) | authenticated loopback OTLP/HTTP JSON, `claude_code.api_request` | `session.id` | `request:<request_id>`; correlated with transcript `requestId` | `input_tokens` | `output_tokens` | `cache_read_tokens` | `cache_creation_tokens` | `model` |
| claude-code (transcript fallback) | `~/.claude/projects/<slug>/<session>.jsonl`, lines with `type: "assistant"` | `sessionId` | `message.id` (several lines per response repeat it: dedupe) | `usage.input_tokens` | `usage.output_tokens` | `usage.cache_read_input_tokens` | `usage.cache_creation_input_tokens` | `message.model` (skip `<synthetic>`) |
| codex | `~/.codex/sessions/**/rollout-*.jsonl`, `event_msg` with `payload.type: "token_count"` | `session_meta.payload.session_id` | line index | `last_token_usage.input_tokens − cached_input_tokens` | `output_tokens` | `cached_input_tokens` | `cache_write_input_tokens` | `turn_context.payload.model` |
| cursor | HackSpain's user-level `afterAgentResponse` / `stop` hooks in `~/.cursor/hooks.json`, allowlisted into the local state log | `conversation_id` | `generation_id` | `input_tokens − cache_read_tokens − cache_write_tokens` | `output_tokens` | `cache_read_tokens` | `cache_write_tokens` | `model`; common hook input also supplies `cursor_version` and `workspace_roots` |
| opencode | `~/.local/share/opencode/opencode.db`, table `message`, assistant rows with `time.completed` | `session_id` | message `id` | `tokens.input` | `tokens.output` | `tokens.cache.read` | `tokens.cache.write` | `modelID` + `providerID` |
| cline | VS Code globalStorage `saoudrizwan.claude-dev/tasks/<task>/ui_messages.json`, `say: "api_req_started"` | task id | entry `ts` | `tokensIn` | `tokensOut` | `cacheReads` | `cacheWrites` | `task_metadata.json` `model_usage` |
| copilot | `~/.copilot/session-state/<session>/events.jsonl`, cumulative `session.shutdown.data.modelMetrics` from Copilot CLI | `session.start.data.sessionId`, else the directory name | shutdown `id` + sorted model index | increase in `usage.inputTokens` − increases in both cache counters | increase in `usage.outputTokens` (already includes reasoning) | increase in `usage.cacheReadTokens` | increase in `usage.cacheWriteTokens` | each key in `modelMetrics`; `usage.reasoningTokens` → `reasoning`; `session.start.data.copilotVersion` → `harnessVersion` |
| gemini-cli | `~/.gemini/tmp/<project>/chats/session-*.jsonl` (subagents one level deeper), records with `type: "gemini"` and a `tokens` object (a turn is appended again with the same `id` once usage arrives: dedupe) | metadata line `sessionId`, else the file name's short id | message `id` | `tokens.input − tokens.cached` | `tokens.output + tokens.thoughts` | `tokens.cached` | 0 (implicit caching) | `model`; `tokens.thoughts` → `reasoning` |
| kilo-code | `~/.local/share/kilo/kilo*.db` (OpenCode fork, same `message` table; channel builds use `kilo-<channel>.db`) | `session_id` | message `id` | `tokens.input` | `tokens.output` | `tokens.cache.read` | `tokens.cache.write` | `modelID` + `providerID` |
| qwen-code | `~/.qwen/projects/<slug>/chats/<session>.jsonl` (`QWEN_HOME` overrides), records with `type: "assistant"` and `usageMetadata` | `sessionId` | record `uuid` | `promptTokenCount − cachedContentTokenCount` | `candidatesTokenCount`, plus `thoughtsTokenCount` when the total counts it apart | `cachedContentTokenCount` | 0 | `model`; `thoughtsTokenCount` → `reasoning`; `version` → `harnessVersion` |
| pi | `~/.pi/agent/sessions/<project>/*.jsonl` (nested sessions included), `type: "message"` with `message.role: "assistant"` | header `id` | entry `id` | `usage.input` (already uncached) | `usage.output` (already includes reasoning) | `usage.cacheRead` | `usage.cacheWrite` | `message.model` + `provider`; `usage.reasoning` → `reasoning`; `usage.cost.total` → `native.costUsd` |
| omp | `~/.omp/agent/sessions/<project>/*.jsonl` (nested sessions included), `type: "message"` with `message.role: "assistant"` | header `id` | entry `id` | `usage.input` (already uncached) | `usage.output` (already includes reasoning) | `usage.cacheRead` | `usage.cacheWrite` | `message.model` + `provider`; `usage.reasoningTokens` → `reasoning`; `usage.cost.total` → `native.costUsd` |
| antigravity | `~/.gemini/antigravity-cli/conversations/<uuid>.db` (Antigravity CLI, `agy`), table `steps`, rows whose protobuf `metadata` carries a usage message (field 9); `gen_metadata` names the model codes and the sibling `conversation_summaries.db` gives the workspace | the file name's uuid | step `idx` | usage field 2 (already net of cache reads) | usage field 3 (already includes thoughts) | usage field 5 | 0 (implicit caching) | usage field 1 → `gen_metadata` name; usage field 10 (thoughts) → `reasoning` |
| devin | `~/.local/share/devin/cli/sessions.db` (Devin CLI; Windows: `%APPDATA%\devin\cli\sessions.db`; Unix: `XDG_DATA_HOME` overrides; `HACKSPAIN_DEVIN_DB` selects a custom file), table `message_nodes`, rows whose `chat_message` JSON is an assistant message with `metadata.metrics` (the same message sits in two chains: dedupe) | `session_id` | `message_id` | `metrics.input_tokens` (already net of cache reads) | `metrics.output_tokens` | `metrics.cache_read_tokens` | `metrics.cache_creation_tokens` | `sessions.model` + `sessions.backend_type` (the session's current model; the message does not name one) |

Reasoning tokens go to `tokens.reasoning` when the harness reports them (Claude thinking,
Codex `reasoning_output_tokens`, Copilot `reasoningTokens`, OpenCode `tokens.reasoning`, Gemini CLI and Qwen Code thought
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

Pi and Oh My Pi formats are checked against their upstream sources:
[Pi session manager](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts),
[Pi usage](https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/types.ts),
[OMP sessions](https://github.com/can1357/oh-my-pi/blob/main/docs/session.md) and
[OMP usage](https://github.com/can1357/oh-my-pi/blob/main/packages/catalog/src/types.ts).
Their header `version` describes the session format, so it is not sent as `harnessVersion`.
Custom session directories (including OMP profiles or XDG storage) can be selected with
`HACKSPAIN_PI_SESSION_DIR` and `HACKSPAIN_OMP_SESSION_DIR`, pointing directly to the sessions
folder. Both tools share `PI_CODING_AGENT_DIR` / `PI_CODING_AGENT_SESSION_DIR`; the watcher
intentionally uses separate overrides to avoid attributing the same logs to both harnesses.
Only persisted assistant usage is collected, not compaction summaries or estimated counts.

## Known limits

- `tokens.cacheWrite` is always 0 for Gemini CLI, Qwen Code and Antigravity: their caching is
  implicit and no write is billed or reported.
- `harnessVersion` exists only where the harness logs it (Claude Code, Codex, Copilot CLI, Cursor, Qwen Code).
- Devin reports no reasoning count, and its model is the session's at read time: a `/model`
  switch mid-session is attributed to the new model for every message of that session.
- Antigravity's step schema is undocumented: the field numbers come from decoding real
  conversations (output = candidates + thoughts on every one of 7.7k steps checked). A step whose
  model code no conversation names is reported as `unknown`.
- Cline reports no reasoning count, and its `tokensIn` follows whatever the provider adapter did
  with cached tokens; there is no total in the record to check it against.
- Codex, Copilot CLI, Gemini CLI, Qwen Code, Kilo Code, Pi and Oh My Pi collectors are written from documented formats, not
  checked against a local install. Claude Code, OpenCode, Antigravity and Devin are checked against
  real logs.
- Cursor's own transcripts omit usage. Its collector starts with the first `hackspain watch`,
  which installs `afterAgentResponse` and `stop` recorders, preserving unrelated hooks and
  replacing obsolete HackSpain commands. Both deduplicate by generation id. Each hook allowlists usage
  metadata into HackSpain's private local state and discards response text, email and tool data.
  It covers local IDE and CLI sessions that run user hooks, not earlier sessions or cloud agents.
- Copilot CLI persists usage only at `session.shutdown`, as cumulative totals per model. The
  collector diffs later shutdowns after a resume and attributes each increment to that shutdown's
  timestamp. Sessions that crash, stay open beyond the collection window, or switch with a CLI
  path that omits the shutdown record cannot be recovered. Editor Copilot Chat and cloud coding
  agents use other stores and are not collected.

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
  The OTLP logs table only receives accepted events.

Moving the window later does not remove rows stored under the old one; clean those in RawTree.

## OpenTelemetry storage

The dashboard sends every accepted batch to RawTree's OTLP endpoint as OTLP/JSON
(`apps/app/src/app/api/cli/telemetry/otlp.ts`). This is the only server-side persistence path.
There is one log record per event: `timeUnixNano` is `occurredAt`, `observedTimeUnixNano` is
`observedAt`, and `eventName` is `hackspain.<type>`.

| Event field | Log attribute |
| --- | --- |
| `eventId` | `event.id` |
| `sessionId` | `gen_ai.conversation.id` |
| `model.name` / `model.provider` / `model.family` / `model.raw` | `gen_ai.request.model` / `gen_ai.provider.name` / `hackspain.model.family` / `hackspain.model.raw` |
| `tokens.input` / `tokens.output` | `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` |
| `tokens.cacheRead` / `cacheWrite` / `reasoning` / `total` | `hackspain.usage.cache_read_tokens` / `cache_write_tokens` / `reasoning_tokens` / `total_tokens` |
| `native.costUsd` / `native.requestId` | `hackspain.native.cost_usd` / `hackspain.native.request_id` |
| `harness` / `harnessVersion` | `hackspain.harness` / `hackspain.harness.version` |
| `identity.userId` / `teamId` | `hackspain.user.id` / `hackspain.team.id` |
| `identity.clientVersion` | resource `service.version` (`service.name` is `hackspain-cli`) |
| `project.*` | `hackspain.project.dir_hash` / `name` / `git_branch` / `repo` |

Native OTLP has no insert deduplication guarantee, so queries on the logs table dedupe on
(`hackspain.user.id`, `event.id`), then correlate Claude rows by user, session and nonempty
`hackspain.native.request_id`. When both sources reached storage, prefer the native API record;
never merge different participants or requests without a request id. The ingestion receipt may
reject a second representation in one batch as `duplicate_request`. Legacy ids and schema v2
remain unchanged.

## Native input

Continuous watch configures Claude Code's supported `http/json` logs exporter, preserving existing
exporter settings and opt-outs. The local receiver accepts only authenticated `POST /v1/logs`,
limits bodies to 1 MiB and binds to `127.0.0.1`. It is not a generic protobuf/gRPC collector.
Resource `service.name` must be `claude-code` or `claude-code-desktop`; only `event.name=api_request`
records with valid counts, timestamp, session and request id survive the allowlist. Resource
attributes, log bodies and all other event types are discarded before disk or upload. Tokens keep
the same canonical semantics as transcript usage; `cost_usd` is optional native cost.

The receiver enforces the current collection window on `event.timestamp` (OTLP `timeUnixNano`
when absent), fsyncs sanitized events before acknowledging, and returns 503 on write failure or
pause. `<state-dir>/claude-otel.jsonl` is consumed before transcripts through the existing
scan/batch/spool pipeline. A fully consumed queue is atomically replaced only after successful
sink delivery; interrupted writes are repaired before the exporter retries. User ids in this local
queue come from the authenticated watcher, never from the producer's attributes. Read/restart
failures retain transcript fallback. Spool records only restore delivery aliases when their ids
were checkpointed after a successful flush: a local write alone does not prove upload. Board
replay independently deduplicates all local records. Older events can be resent after the bounded
recent-id history expires; permanent cross-device/old-client deduplication remains the dashboard's
responsibility.

Cursor Enterprise export requires a public endpoint and organization-to-participant identity
mapping, so it is not connected to this loopback receiver. Cursor hooks and Devin SQLite remain
supported input adapters.

## Privacy

- No prompt or response text, ever. Fixtures under `apps/cli/test/fixtures` are redacted and a
  test fails if a home path sneaks in.
- Working directories are hashed; only the last path segment is kept.
- Git remotes are reduced locally to a GitHub `owner/repo`; raw URLs, credentials and
  non-GitHub remotes are discarded.
- No harness account ids. Identity is the HackSpain user and team.
- `native` keys are allowlisted in both CLI and server validation; unknown keys are rejected.
- Only the hackathon window is recorded; nothing from before or after it leaves the machine, and
  nothing at all while no hackathon is scheduled.

## Example

```json
{"schema":"hackspain.telemetry.v2","type":"usage","eventId":"claude-code:eb2f547c:msg_011CekYx","occurredAt":"2026-09-19T10:18:23.076Z","observedAt":"2026-09-19T10:18:30.002Z","harness":"claude-code","harnessVersion":"2.1.261","sessionId":"eb2f547c","project":{"dirHash":"9f2c1a7b3e4d5c6a","name":"agentos","gitBranch":"main","repo":"hackspain/agentos"},"model":{"raw":"claude-fable-5-1","name":"claude-fable-5-1","family":"claude","provider":"anthropic"},"tokens":{"input":2,"output":344,"cacheRead":26445,"cacheWrite":13687,"reasoning":127,"total":40478},"identity":{"userId":"j57…","teamId":"k97…","clientVersion":"0.5.0"},"native":{"requestId":"req_011…"}}
```
