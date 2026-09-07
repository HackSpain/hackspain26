# Provider proxy

Participants send their own provider credentials unchanged. No HackSpain key or provider secrets are configured on the Worker. Providers authenticate requests and enforce their own quotas. Paths, queries, bodies, status codes and streamed responses pass through; destinations are fixed.

| Public base | Upstream | Participant header |
| --- | --- | --- |
| /exa | https://api.exa.ai | x-api-key: EXA_API_KEY |
| /helmcode | https://api.helmcode.com | Authorization: Bearer HELMCODE_API_KEY |
| /quiverai | https://api.quiver.ai | Authorization: Bearer QUIVERAI_API_KEY |
| /fal | https://queue.fal.run | Authorization: Key FAL_KEY |

Use https://api.hackspain.com/helmcode/v1 as an OpenAI-compatible base URL. Credentials belong in participant backends, not public frontend bundles.

fal returns its original queue URLs. To track subsequent status/result/cancel calls, replace https://queue.fal.run with https://api.hackspain.com/fal in those URLs. File uploads, direct fal SDK integration and WebSockets are not covered. Redirects are returned without being followed by the Worker.

## RawTree tracking

Separate table: `hackspain_proxy_usage`. Each `hackspain.proxy.v1` event records eventId, occurredAt, provider, normalized operation, method, status, headersDurationMs and outcome. Duration measures time to upstream response headers, not full generation/stream completion. No request/response bodies, raw paths, query strings, credentials, credential hashes, IPs or participant identifiers are collected. Unknown endpoints are grouped as other; fal model requests as inference.

Tracking uses waitUntil, a five-second timeout per attempt, and two attempts with a stable RawTree deduplication token. Failures are logged by event ID and do not fail the proxy. Delivery is best effort, not durable accounting. No token, model-from-body or cost metrics are inferred.

Set RAWTREE_API_KEY (write_only) and RAWTREE_DATABASE in ignored apps/api/.dev.vars. Provision the table in that database using the same JSON/Dynamic ingestion setup as the existing CLI telemetry table. The Worker does not create tables.

```sh
pnpm dev:api
pnpm check:api
pnpm --filter app exec tsx --test ../api/test/proxy.test.mjs
cd apps/api
pnpm exec wrangler deploy --secrets-file .dev.vars
```

Provider secrets are not needed. The deployment account must own the domain. RawTree credentials stay server-side.

To inspect usage, aggregate the event fields after deduplicating by eventId: request count, count of status >= 400, and average headersDurationMs, grouped by provider and operation. Polling calls count separately from inference submissions. No dashboard is included.
