# hackspain CLI

Terminal client for HackSpain participants. It is another interface onto the dashboard: same
users, same Convex Auth session, and every Convex call runs inside the dashboard's `/api/cli/*`
routes (`apps/app/src/app/api/cli`). The binary only knows the dashboard's address.

## Install

```sh
curl -fsSL https://hackspain.com/install.sh | sh      # macOS and Linux, into ~/.local/bin
hackspain update                                      # later, to get the newest release
```

Windows: download `hackspain-windows-x64.exe` from the
[releases page](https://github.com/HackSpain/hackspain26/releases) and rename it `hackspain.exe`.
Binaries are self-contained; nothing else to install.

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

hackspain watch [--interval 30] [--backfill <hours>] [--no-toast] [--no-upload] [--once]
hackspain telemetry stats       # what the watcher recorded on this machine

hackspain --json <command>      # one JSON object on stdout, prompts disabled
```

## Watcher

`hackspain watch` runs during the hackathon. Every 30 s it reads the local session logs of the
AI coding harnesses it finds (Claude Code, Codex, OpenCode, Cline), normalises them into one
schema ([docs/telemetry-schema.md](docs/telemetry-schema.md)), writes them to a local spool
(`~/.local/state/hackspain/telemetry/`), and uploads the same NDJSON to the dashboard's
`/api/cli/telemetry` with your session. The server acknowledges and validates batches; where it
stores them is decided server-side (the store is still being chosen), so no CLI update is
needed when that lands. `--no-upload` keeps everything local; `--sink-url` or `telemetry.url`
in `~/.config/hackspain/config.json` point the upload elsewhere.

Every 10 s it also polls organiser broadcasts and shows them in the terminal and as a desktop
notification (`notify-send`, macOS Notification Center, Windows toast). No prompt text or full
paths ever leave the machine; only token counts, model, session ids, and a hash of the project
directory. By default only usage after the watcher starts is reported; `--backfill 6` includes
the last six hours.

One watcher per machine (`watch.lock`); Ctrl+C flushes and exits.

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

## Release

Tag `master` with `cli-vX.Y.Z` (matching `apps/cli/package.json`) and push the tag. The
`cli-release` workflow cross-compiles the five targets on Linux, writes `SHA256SUMS`, and attaches
everything to a GitHub release; `install.sh` and `hackspain update` read that release. Release
binaries target `https://app.hackspain.com`; the optional repository variable
`HACKSPAIN_APP_URL` overrides that at build time. Nothing else to configure. `cli-ci` runs
typecheck, lint, tests, and a host compile on every PR that touches `apps/cli` or the Convex
functions.

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
