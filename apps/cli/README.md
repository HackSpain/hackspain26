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
hackspain                       # where you stand, then a navigable menu (interactive terminals only)
hackspain auth login            # sign in via the browser (approve on the dashboard's /cli-auth page),
                                # or --email/--code for the 8-digit email code; then asks for a missing
                                # name, phone, GitHub or X
hackspain auth status | logout
hackspain open [feed|teams|tracks|perks|profile|onboarding|/path] [--print]
                                # the dashboard in your browser, already signed in (link works once, 2 min)

hackspain profile               # name, diet, travel, phone, notices, GitHub, X; photo and
                                # participant card show as done/missing (they need the dashboard)
hackspain profile edit [--name …] [--diet …] [--diet-details …] [--from …]
hackspain profile notify on|off
hackspain profile phone [+34…]  # contact number, same as the dashboard
hackspain profile github [--unlink]         # prints the link to authorise in a browser
hackspain profile x [@handle] [--clear]     # X handle, same rules as the dashboard

hackspain team create <name> [-m github:x -m a@b.c]
hackspain team join <code>      # 8-character code from the owner
hackspain team show | list | leave | code [--regenerate] | repo [url|--clear]
hackspain team transfer [member] # owner hands the team to a teammate
hackspain team dissolve          # owner deletes a team nobody else is in
hackspain stack set nextjs convex claude-code

hackspain track list
hackspain track register [slug] | unregister
hackspain submit [--draft]      # interactive form; flags for scripts
hackspain project show | list
hackspain perk list

hackspain milestone add firstCommit|firstBuild|firstDemo|custom [--label …] [--at ISO]
hackspain milestone list [--all]

hackspain feed [-n 20] [--no-images] [--before <cursor>]
                                # posts from everyone + pushes and PRs from every team repo;
                                # pictures inline in Kitty/Ghostty/WezTerm/iTerm2/VS Code, links elsewhere;
                                # on a TTY it offers the next older page, scripts get a --before cursor
hackspain post "text" [--image photo.jpg]   # ≤500 chars; jpeg/png/webp/gif ≤5 MB

hackspain watch [--interval 30] [--no-toast] [--no-upload] [--no-images] [--once]
hackspain telemetry stats       # what the watcher recorded on this machine

hackspain --json <command>      # one JSON object on stdout, prompts disabled
```

## One login for the CLI and the web

Both directions are covered. `hackspain auth login` (browser flow) approves the CLI from a
signed-in dashboard tab. `hackspain open` goes the other way: the CLI's session mints a
single-use token (`cliAuth.startWebHandoff` over `/api/cli/rpc`), opens
`/cli-auth/handoff?hs-token=…&next=/feed`, and that page signs the browser in with the
`cli-handoff` credentials provider, which sets the ordinary dashboard cookies. Tokens live two
minutes and die on first use; `--print` shows the link instead of launching a browser, and
`--json` returns `{ url, path, expiresAt }`. Menu entries and post-login hints point at it, so
nobody has to type a second email code on the web.

## Watcher

Every screen that opens with the brand (`hackspain`, the menu, `--help`, the watcher) shows
the HackSpain wordmark: the real PNG in terminals that draw images, block letters on wide text
terminals, a small mark elsewhere.

`hackspain watch` is meant to stay open in its own terminal all weekend. It takes over the
screen with that wordmark on top, a short "Keep this open" note on why it matters, a panel for you and your team, a table of the AI
harnesses it found (with the real logo beside each name where the terminal draws images, a
brand glyph elsewhere: ✻ Claude Code, ⬡ Codex, ✦ Gemini CLI, ❋ Qwen Code, ▍ Cursor, ◆ OpenCode, ⬢ Kilo Code, ▣ Cline, ◉ Copilot, π Pi, π Oh My Pi, ◠ Antigravity, ◈ Devin, ✕ Grok;
status, requests, tokens, cached, last request; "Tokens" is input + output, while prompt-cache
reads and writes sit in their own column because a long session re-reads hundreds of thousands
of cached tokens per turn), organiser announcements as they
arrive, a table of the most recent requests it reported, the feed across the bottom (posts from
everyone plus GitHub activity from every team repo, with pictures inline where the terminal can
draw them and links elsewhere; `↑`/`↓` scroll it, `g` returns to live), and a status bar with the
next scan and upload state. `q` quits, `p` pauses scanning. Piped output, `--json`, `--once` and
`--plain` use the line-by-line mode instead.

Every 30 s it reads the local session logs of the
AI coding harnesses it finds (Claude Code, Codex, Gemini CLI, Qwen Code, OpenCode, Kilo Code, Cline, Pi, Oh My Pi, Antigravity, Devin, Grok), normalises them into one
schema ([docs/telemetry-schema.md](docs/telemetry-schema.md)), writes them to a local spool
(`~/.local/state/hackspain/telemetry/`), and uploads the same NDJSON to the dashboard's
`/api/cli/telemetry` with your session. The server authenticates and validates batches, then
stores accepted events through the RawTree TypeScript SDK without exposing its key to the CLI.
The exact remote batch is saved locally before upload and retried after network failures or a
restart. RawTree receives a stable deduplication token, so retrying an acknowledged-but-lost
request does not count it twice. Server rejections are reported and recorded locally instead of
being silently discarded.
`--no-upload` keeps everything local; `--sink-url` or `telemetry.url`
in `~/.config/hackspain/config.json` point the upload elsewhere.

On the same tick it polls organiser broadcasts and the feed, and shows broadcasts as a desktop
notification (`notify-send`, macOS Notification Center, Windows toast). It is built to sit on a
laptop all weekend: one wakeup per second, the screen repaints only the rows that changed, normally
one network round trip per scan, and after ten minutes without new usage the scan slows to once a
minute until activity resumes. No prompt text or full
paths ever leave the machine; only token counts, model, session ids, and a hash of the project
directory. The watcher records the hackathon window organisers scheduled, all of it and nothing
else, for everybody (organiser accounts included): usage from before the start or after the end
is never recorded or sent, and usage from inside it is picked up even if the watcher was opened
late or not at all until the end. Every event keeps the time the harness recorded, not the time
the watcher read it. The watcher runs outside the window too: opened early it waits and starts
recording on its own, opened after the end it delivers what is left, and while no hackathon is
scheduled it records nothing. In all three cases an orange "Not recording" line under the header
and in the status bar says so. The window is checked again every five minutes, so a schedule set
or moved while the watcher is open is picked up.

The watcher remembers. `~/.local/state/hackspain/watch-memory.json` keeps the first start, the
last scan and the latest organiser announcements, and the local spool keeps every usage event, so
reopening it shows the harness table and recent requests for everything since the first run (the
Harnesses box says "since …"), the last announcements are back on screen, and the first scan reads
harness logs written while the watcher was closed instead of skipping them. Announcements caught up on start stay on screen but do not
toast; only ones from the last ten minutes do.

One watcher per machine (`watch.lock`); Ctrl+C flushes and exits.

## Feed

`hackspain feed` and `hackspain post` share one feed with the dashboard's `/feed` page: short
messages, an optional image, and GitHub activity. Images are uploaded through `/api/cli/upload`
and served from `https://hackspain.app/api/files/<id>` (needs a dashboard login; `hackspain
open feed` gets you one). In terminals that speak the Kitty graphics protocol (kitty, Ghostty,
WezTerm, Konsole 22.04+) or the iTerm2 inline-image protocol (iTerm2, Warp, VS Code) the picture
is drawn inline: the CLI asks the server for a PNG thumbnail (`?w=576`) and hands the bytes to
the terminal, so it ships no image decoders. Everywhere else, in tmux, when piped, with `--json`,
`--no-images` or `HACKSPAIN_NO_IMAGES=1`, you get the link. Pictures are capped at 36 columns by
12 rows in `hackspain feed` and 30 by 6 in the watcher band; tall photos shrink to fit the row cap.

Pages are 20 posts by default (`-n`). On a TTY the feed asks "Show older posts?" after a full
page; piped or `--json` it prints the cursor to pass as `--before` (the oldest post's `createdAt`,
or any ISO date). In the watcher, `↓`/`j` and `↑`/`k` move one post, `PgDn`/`PgUp` five, `g` or
`Home` jumps back to live; older pages load as you approach the end, and new posts do not yank
the view while you are scrolled down. The server polls the public Events API of every
team repo (`hackspain team repo <url>`) every three minutes from a Convex cron and posts pushes,
opened and merged pull requests, releases and tags. Nothing is read from the hacker's machine:
push often and it shows up.

Tracks live on the project: `track register` saves a draft with the chosen challenges, and
`submit` freezes everything. Commands that need a team, an accepted signup, or completed
onboarding fail fast with the next step to take.

## Develop

```sh
pnpm dev:app                                        # the CLI talks to localhost:3000 in dev
pnpm dev:cli -- auth login --email you@example.com --code 00000000
pnpm typecheck && pnpm lint && pnpm test            # from apps/cli; tests use Bun
pnpm build:bin:host && ./dist/hackspain --version
HACKSPAIN_SMOKE_EMAIL=… scripts/smoke.sh           # end-to-end through the local dashboard
```

- A dev Convex deployment with `ALLOW_EMAIL_OTP_STUB=true` accepts `00000000` as the code.
- Server resolution: `--url` → `HACKSPAIN_APP_URL` → `~/.config/hackspain/config.json`
  (`appUrl`) → `http://localhost:3000` from source, `https://hackspain.app` in release
  binaries (`HACKSPAIN_APP_URL_DEFAULT` at build time overrides).
- Credentials live in `~/.config/hackspain/credentials.json` (mode 600). Access tokens last
  1 h and are refreshed through `/api/cli/auth/refresh` under a lock file, because Convex Auth
  rotates refresh tokens and reusing an old one logs every process out.
- Backend types come from `apps/app/convex/_generated/api.d.ts` (type-only import). At runtime
  `api.teams.join` is just the function name sent to `/api/cli/rpc`; the server keeps an
  allowlist in `apps/app/src/app/api/cli/_lib/functions.ts`. Add a function there when a new
  command needs it. Run `pnpm dev:convex` after backend changes so the types update.

## Release

Tag `master` with `cli-vX.Y.Z` (matching `apps/cli/package.json`) and push the tag. The
`cli-release` workflow cross-compiles the five targets on Linux, writes `SHA256SUMS`, and attaches
everything to a GitHub release; `install.sh` and `hackspain update` read that release. Release
binaries target `https://hackspain.app`; the optional repository variable
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
| 4 | Not eligible (no signup, not accepted, onboarding incomplete, or the hackathon is not running: `EVENT_CLOSED`) |
| 5 | Could not reach the backend |
| 130 | Interrupted |
