# Telemetry schema `hackspain.telemetry.v1`

What `hackspain watch` records and sends, regardless of which AI coding harness produced it.
Source of truth for the TypeScript type and validator: `apps/cli/src/watcher/schema.ts`.

The telemetry store is still undecided (ClickHouse or an alternative). Until then the watcher
writes every event to a local spool (`~/.local/state/hackspain/telemetry/YYYY-MM-DD.ndjson`,
one JSON object per line) and, when a URL is configured, POSTs the same lines as
`application/x-ndjson` with `Authorization: Bearer <Convex JWT>`. Whichever store is chosen only
needs to accept that body; a ClickHouse `INSERT … FORMAT JSONEachRow` behind a small auth proxy
fits directly.

## Event

| Field | Type | Notes |
| --- | --- | --- |
| `schema` | `"hackspain.telemetry.v1"` | Bump for breaking changes |
| `type` | `usage` \| `session.start` \| `session.end` | `session.end` is reserved; no harness emits it yet |
| `eventId` | string | `${harness}:${sessionId}:${nativeId}`. Global dedupe key: the store must upsert on it |
| `occurredAt` | ISO-8601 UTC | When the harness recorded it |
| `observedAt` | ISO-8601 UTC | When the watcher read it |
| `harness` | `claude-code` \| `codex` \| `cursor` \| `opencode` \| `cline` \| `copilot` | Same ids as the insights dashboard. `cursor` and `copilot` have no local logs, so no collector yet |
| `harnessVersion` | string? | e.g. Claude Code `2.1.261`, Codex `0.130.0` |
| `sessionId` | string | Harness session / task id |
| `project` | `{ dirHash, name, gitBranch? }`? | `dirHash` = first 16 hex of sha256(cwd); `name` = basename only. Never a full path |
| `model` | `{ raw, family, provider? }`? | `family` ∈ `claude` \| `gpt` \| `gemini` \| `other`, the same four buckets as `MODELS` in the insights mock |
| `tokens` | `{ input, output, cacheRead, cacheWrite, reasoning? }`? | Non-negative integers. Required for `usage`. `input` excludes cache reads for every harness |
| `costUsd` | number? | Only when the harness itself reports a price |
| `identity` | `{ userId, teamId?, clientVersion }` | Stamped by the CLI from the logged-in user and their team at flush time |
| `native` | object? | Small harness-specific remainder (e.g. Claude `requestId`) |

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

Reasoning tokens go to `tokens.reasoning` when the harness reports them (Claude thinking,
Codex `reasoning_output_tokens`, OpenCode `tokens.reasoning`). Codex and OpenCode formats are
written from their documented shapes and fixtures, not from a local install; collectors log and
skip anything they cannot parse.

## Privacy

- No prompt or response text, ever. Fixtures under `apps/cli/test/fixtures` are redacted and a
  test fails if a home path sneaks in.
- Working directories are hashed; only the last path segment is kept.
- No harness account ids. Identity is the HackSpain user and team.
- `--backfill <hours>` is opt-in; by default only usage after the watcher starts is reported.

## Example

```json
{"schema":"hackspain.telemetry.v1","type":"usage","eventId":"claude-code:eb2f547c:msg_011CekYx","occurredAt":"2026-09-19T10:18:23.076Z","observedAt":"2026-09-19T10:18:30.002Z","harness":"claude-code","harnessVersion":"2.1.261","sessionId":"eb2f547c","project":{"dirHash":"9f2c1a7b3e4d5c6a","name":"agentos","gitBranch":"main"},"model":{"raw":"claude-fable-5-1","family":"claude","provider":"anthropic"},"tokens":{"input":2,"output":344,"cacheRead":26445,"cacheWrite":13687,"reasoning":127},"identity":{"userId":"j57…","teamId":"k97…","clientVersion":"0.1.0"},"native":{"requestId":"req_011…"}}
```
