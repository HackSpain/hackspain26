# hackspain CLI

Terminal client for HackSpain participants. It is another interface onto the dashboard: same
users, same Convex Auth session, and every Convex call runs inside the dashboard's `/api/cli/*`
routes (`apps/app/src/app/api/cli`). The binary only knows the dashboard's address.

```
hackspain auth login            # email + 8-digit code, same as the dashboard
hackspain auth status | logout

hackspain team create <name> [-m github:x -m a@b.c]
hackspain team join <code>      # 8-character code from the owner
hackspain team show | list | leave | code [--regenerate] | repo [url|--clear]
hackspain stack set nextjs convex claude-code

hackspain track list
hackspain track register <slug…> | unregister <slug…> | move <from> <to>
hackspain submit [--draft]      # interactive form; flags for scripts
hackspain project show | list
hackspain perk list

hackspain milestone add firstCommit|firstBuild|firstDemo|custom [--label …] [--at ISO]
hackspain milestone list [--all]

hackspain --json <command>      # one JSON object on stdout, prompts disabled
```

Tracks live on the project: `track register` saves a draft with the chosen challenges, and
`submit` freezes everything. Commands that need a team, an accepted signup, or completed
onboarding fail fast with the next step to take.

## Develop

```sh
bun dev:app                                        # the CLI talks to localhost:3000 in dev
bun dev:cli -- auth login --email you@example.com --code 00000000
bun run typecheck && bun run lint && bun test      # from apps/cli
bun run build:bin:host && ./dist/hackspain --version
HACKSPAIN_SMOKE_EMAIL=… scripts/smoke.sh           # end-to-end through the local dashboard
```

- A dev Convex deployment with `ALLOW_EMAIL_OTP_STUB=true` accepts `00000000` as the code.
- Server resolution: `--url` → `HACKSPAIN_APP_URL` → `~/.config/hackspain/config.json`
  (`appUrl`) → `http://localhost:3000` from source, `https://app.hackspain.com` in release
  binaries (`HACKSPAIN_APP_URL_DEFAULT` at build time overrides).
- Credentials live in `~/.config/hackspain/credentials.json` (mode 600). Access tokens last
  1 h and are refreshed through `/api/cli/auth/refresh` under a lock file, because Convex Auth
  rotates refresh tokens and reusing an old one logs every process out.
- Backend types come from `apps/app/convex/_generated/api.d.ts` (type-only import). At runtime
  `api.teams.join` is just the function name sent to `/api/cli/rpc`; the server keeps an
  allowlist in `apps/app/src/app/api/cli/_lib/functions.ts`. Add a function there when a new
  command needs it. Run `bun dev:convex` after backend changes so the types update.

## Exit codes

| Code | Meaning |
| ---: | --- |
| 0 | OK |
| 1 | Server or generic error |
| 2 | Usage error (bad flags, missing input in non-interactive mode) |
| 3 | Not logged in or session expired |
| 4 | Not eligible yet (no signup, not accepted, onboarding incomplete) |
| 5 | Could not reach the backend |
| 130 | Interrupted |
