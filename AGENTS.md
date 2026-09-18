# HackSpain monorepo

Marketing site for HackSpain 2026 (Madrid) at https://hackspain.com, plus the participant/admin dashboard and the `hackspain` CLI.

Setup, env vars, and Convex login live in the [README](README.md). pnpm workspaces. Node ≥ 22.13. The CLI still compiles and tests with Bun.

```text
apps/web    # Astro 6 landing (Vercel, React islands, Tailwind v4, Neon/Drizzle)
apps/app    # Next.js dashboard + Convex (auth, CRM, teams, perks, feed, TV)
apps/cli    # `hackspain` terminal client for participants (Bun binary, same Convex backend)
```

```sh
pnpm install
pnpm dev                 # landing — localhost:4321
pnpm dev:app             # dashboard — localhost:3000
pnpm dev:convex          # Convex dev (not production deploy)
pnpm dev:all             # landing + dashboard + Convex
pnpm migrate:convex      # Neon → Convex. Idempotent on email. Do not run unless importing.
pnpm seed:convex         # Dev only: fake hackathon in the dev deployment (see Seed data)
```

Do not run `pnpm --filter app exec convex deploy` unless you are shipping Convex to production.

Copy `apps/web/.env.example` → `apps/web/.env` for signup APIs. Copy `apps/app/.env.example` → `apps/app/.env.local` for the dashboard. Static landing pages run without a database.

## Feature status

Public signup still writes Neon; Convex `signups` come from `pnpm migrate:convex` (or CRM). Insights stay mock. Watcher telemetry uploads to RawTree (`POST /api/cli/telemetry`).

| Area | Status |
| --- | --- |
| Landing mosaic, signup, attendance, badges | **Live** (Neon). Signups closed 9 Aug. Shortlist and prefill are gone. |
| Auth, onboarding, profile, GitHub link, feed, perks, tracks, CRM | **Live** (Convex). Submit stays closed until an admin opens the window. |
| Teams, tracks, submissions | **Live**. `/teams` and `/tracks` are read-only; create/join/transfer, entering tracks and submitting are CLI. |
| CLI (commands + watch) | **Live** against `/api/cli/*`. This branch adds a TTY menu and dashboard login. |
| Venue TV, judging, repo stack tags | **This branch.** `/tv`, `/admin/tv`, `/judging`. |
| Insights (`/insights`) | **Mock UI only.** |

## Landing (`apps/web`)

Astro 6 with server output on Vercel, React islands, Tailwind CSS v4, Motion. Synced from the marketing repo at `origin/master` (`49337e0`). Trailing slashes are off (`trailingSlash: "never"`). Public copy is Spanish-first; there is no `/en` / `/es` locale prefix.

### Layout

```text
apps/web/src/
├── components/          # mosaic, pages, sections, share badge, forms
├── data/                # SEO, section routes, llms.txt, mentors/judges
├── db/                  # Drizzle client + schema (Neon)
├── layouts/layout.astro # SEO + JSON-LD
├── lib/                 # Zod validation, email, badge
├── middleware.ts        # AEO: Accept text/markdown on landing URLs → llms.txt
└── pages/               # routes + /api/*
```

Interactive pages are Astro shells that mount one React island with `client:load`.

### Routes

| Path | Role | Prerender |
| --- | --- | --- |
| `/`, `/mission`, `/tracks`, `/gran-premio`, `/mentores`, `/apuntate` | Landing mosaic sections | no |
| `/signup` | Hackathon signup | yes |
| `/ambassador` | Ambassador application | yes |
| `/privacy` | Privacy | yes |
| `/asistencia` | Mentor/sponsor attendance | no |
| `/confirmacion`, `/comparte`, `/cancelacion` | Place confirmation, badge share, cancellation | no |
| `/api/signup`, `/api/mentor-sponsor-signup` | JSON POST | no |
| `/llms.txt` | Machine-readable site summary | yes |

Landing section slugs live in `src/data/section-routes.ts`. Adding a section means updating that list, mosaic cells, `landing-meta.ts` SEO arrays, and a root alias page.

### SEO

- Page titles, descriptions, keywords, JSON-LD: `src/data/landing-meta.ts` and `src/layouts/layout.astro`.
- `src/data/llms.txt` is the AEO source. Middleware serves it when `Accept` includes `text/markdown`. Keep it in sync with visible copy.

### Design

Brand tokens are defined twice on the landing and must stay in sync:

- CSS / Tailwind: `src/styles/global.css` `@theme` (`--color-hs-*`, `--font-bungee`)
- TS: `src/components/theme/palette.ts`

The dashboard remaps the same hex values onto shadcn tokens in `apps/app/src/app/globals.css`.

Fonts: DM Sans (body), Bungee (display / buttons). Landing buttons use `src/components/ui/button-styles.ts`. Forms use `src/components/form/*`.

Landing motion is a full-viewport mosaic (`landing-page`, `cells.ts` / `cells-compact.ts`). Do not turn it into a normal scrolling page. Respect `prefers-reduced-motion`.

### Forms and APIs

Validation is Zod in `src/lib/signup-validation.ts` and `src/lib/mentor-sponsor-validation.ts`. The API parses the body with those helpers. Do not invent a second schema in the React form.

`POST` handlers (`prerender = false`) check BotID, require `application/json`, reject duplicate emails (409), write through `getDb()`, and send transactional mail through Resend when configured.

Tables in `src/db/schema.ts` include `hackathon_signups`, `hackathon_pre_signups`, and `mentor_sponsor_signups`. Change schema with Drizzle (`pnpm db:generate` then migrate). Do not hand-edit applied SQL as the source of truth.

New dashboard data lives in Convex, not Neon. Keep using Neon for the public signup API until that is migrated separately.

## Dashboard (`apps/app`)

Next.js App Router + Convex + Convex Auth (email OTP) + shadcn.

Wrappers: `authedQuery` / `authedMutation` / `accepted*` / `onboarded*` / `profileMutation` / `adminQuery` / `adminMutation` / `judge*`.

Sign in with the `/signup` email. The send step (`auth:signIn` → `internal.login.eligibility`) refuses an email with no signup, no account and no `ADMIN_EMAILS` entry: `/api/login/otp` answers `{ ok: false, code: "UNREGISTERED" }` and the login page says so instead of "código enviado". A wrong, expired or rate-limited code comes back as a coded `ConvexError` (`BAD_OTP` / `OTP_EXPIRED` / `TOO_MANY_ATTEMPTS`, diagnosed by `internal.login.verifyFailure`); a Resend failure is `SEND_FAILED`. Someone who signed in before their signup was imported still lands on `/unregistered`. Accepted hackers give a contact phone and confirm terms and consent on `/onboarding` (`users.onboardingComplete`). Everyone else with a signup sees `/pending`. Admins mark accepted in CRM and bypass the signup gates. Independently of all that, **every account** (admins and judges included) must have a name, a photo and a complete directory card before the dashboard opens: `convex/lib/profile.ts` `missingProfileFields` reads them straight off `users` (no flag; the GitHub avatar in `users.image` counts as the photo), `users.me` returns `profileMissing` / `profileComplete`, and `AuthGate` sends anyone incomplete to `/onboarding`. The wizard there (`src/app/onboarding/page.tsx`, steps in `src/components/onboarding/`) plans its steps once from `users.me` (`planSteps` in `steps.ts`): phone/terms only for an accepted signup, then name + photo, GitHub + X handle (`users.twitterHandle`, `users.setTwitterHandle`; both skippable), then the directory card over two steps (`directory`: role, city, affiliation; `skills`: skills, interests, bio) that share one mounted `DirectoryStep` so the draft survives, saved once at the end. Steps already done (phone/terms, name + photo) stay in the plan so "Atrás" can revisit them; the wizard opens at the first pending one (`plan.start`). Every step's footer is `StepNav` ("Atrás" left, primary right). Admin role: `ADMIN_EMAILS` Convex env, or CRM “Make admin”.

The dashboard is in event mode: there is no navigation bar. The home page is the feed next to a launcher of section tiles (`src/components/section-tiles.tsx`, one icon per section the user's type allows, plus profile and TV); each section opens on its own URL and `AppShell` puts a "Volver al inicio" button above every non-home page. The header (`src/components/app-header.tsx`) only carries the logo, the TV link and the account menu. Pre-event logistics (attendance confirmation, diet, travel origin) are no longer edited by participants; the `users` fields and `users.updateEventDetails` / `users.setAttendance` stay for the CLI and the CRM, and `onboarding.confirmDetails` no longer requires `travelOrigin`. Participants edit their name and upload a profile picture on `/profile` (`users.setAvatar`, `users.avatarId` in Convex storage; `users.me` returns `avatarUrl`, which is `/api/files/<id>` or the GitHub avatar). A photo is required, so `users.removeAvatar` only works while the GitHub avatar remains as a fallback and the "Quitar foto" button shows only when `users.me.canRemoveAvatar`.

**User types** (`userTypes` table, `convex/userTypes.ts`, `convex/lib/userTypes.ts`) are the single access model below admin. Admins define them on `/admin/types` and assign them per participant in the CRM. A type is a label plus the set of `sections` it can open (`teams`, `tracks`, `perks`, `participantes`, `judging`, `cli`); the feed and the profile are always visible. `users.me` returns `sections` (the home tiles) and `canJudge`; a user without a type gets the type marked as default, else the participant sections. `judging` is enforced server-side: `requireJudge` / `judgeQuery` accept admins and any type that grants `judging`, and `judging.meta` lists those users as assignable judges. `AuthGate` bounces hidden sections to `/`. `role` is only `admin` or `user` now; the `judge` value is legacy and `userTypes.ensureDefaults` (run by the CRM and types pages on load, idempotent) seeds "Hacker" (default) and "Jurado" and moves legacy judges onto "Jurado". Run it once after deploying if no admin opens the CRM: `pnpm --filter app exec convex run userTypes:ensureDefaults`.

**Hackathon window.** Admins set a start and an end on `/admin/evento` (`settings.eventStartsAt` / `eventEndsAt` on the `hackathon` row, `settings.adminEventWindow` / `adminSetEventWindow`). `convex/lib/eventWindow.ts` computes the phase (`unscheduled` when either bound is missing, which counts as open) and `requireEventOpen` throws `ConvexError { code: "EVENT_CLOSED" }` for non-admins outside it. The check sits in the `onboarded*` and `judge*` wrappers (`requireInEvent` / `requireJudgeInEvent` in `convex/lib/auth.ts`), so every team, track, submission, feed, milestone, judging, stack and watcher function is closed on the web and in the CLI alike; `/api/cli/telemetry` returns 403. Perks use the `anytimeOnboarded*` wrappers, so their catalog and claims remain available outside the window. What stays open is exactly the `authed*` and `accepted*` ladders (profile, avatar, GitHub link, directory, onboarding, CLI login), perks, plus the three profile writes on `profileMutation` (`users.setAttendance`, `setNotificationConsent`, `updateEventDetails`). Use `onboarded*` for anything new unless it must survive a closed window. `users.me` returns `event: { startsAt, endsAt, phase, open }` (`open` is always true for admins); `AuthGate` bounces every path except `/`, `/profile`, `/participantes`, `/perks` and the auth pages home (`isPathAllowedWhenClosed` in `src/lib/sections.ts`), the home tiles shrink to Participantes / Perks / Perfil / TV, the feed is replaced by a notice and `EventClosedBanner` sits under the header. Admins are never restricted.

**Participant directory** (`/participantes`) draws the participants map from `users.directory` (`convex/lib/directory.ts`: role, city, university and/or company, degree, skills, interests, bio). The map (`src/components/participant-directory/`) shows people only, clustered by one lens at a time (team, track, city, university, company; `network-model.ts`); the track lens draws the sponsor wordmark from `tracks.logoUrl`, and `directory.list` attaches each team's `submissions.challengeIds` as `tracks`. Links between people only appear on hover or selection (`linksFor`, capped). The stage bleeds edge to edge (`fullBleed` in `src/lib/layout.ts`) while its controls and profile panel stay inside `contentWidth`. Node motion is the force simulation writing transforms each frame; GSAP handles the camera tween, the inertial wheel zoom and the intro / lens-change timeline (`network-canvas.tsx`), and CSS handles hover, dimming and the panel. `directory.me` reports what the viewer still lacks and suggests the travel origin as city and the team stack as skills; the card is filled during onboarding (it is one of the `missingProfileFields`), so the page draws the graph straight away and "Editar mi ficha" goes to `/profile#ficha`, where `DirectoryForm` lives now. Only complete cards appear in the graph. Everything the graph groups by comes from the curated vocabularies in `convex/lib/directoryOptions.ts` (roles, Spanish cities, universities, degrees, grouped skills, interests, each with aliases: English names, acronyms, old spellings): the form offers them as comboboxes (`ChoiceField`: type to filter, unmatched text is kept as "other" for city, university and degree) and a multi-select combobox (`TagPicker`: chosen values as chips in the box, grouped checklist below, no free text for skills and interests), and `parseDirectoryCard` folds every saved value through `canonical` so "UPM" and "Technical University of Madrid" become one node. Extend the lists there when a real answer keeps landing in "Otra"; after changing them run `pnpm --filter app exec convex run directory:normalizeCards` to re-fold stored cards. The old demo dataset is gone.

Teams can carry a logo: the owner uploads it on `/teams` (`teams.generateLogoUploadUrl` / `setLogo` / `removeLogo`, `teams.logoId` in Convex storage, 2 MB max) and every team-bearing query returns `logoUrl` / `teamLogoUrl` (`teams.mine`, `teams.list`, `feed.list`, `submissions.*`, `judging.*`), resolved by `feed.imageUrl` like avatars. `/tracks` shows the teams entered in each track as small avatars that expand into the roster.

Tracks carry the sponsor's branding: `tracks.logoUrl` (a path under `apps/app/public/tracks/`, copied from `apps/web/src/assets/sponsors/`, or an absolute URL) and `tracks.website`. `seedDefaults` fills them in only when missing, so admin edits on `/admin/tracks` survive a resync. `src/components/track-tag.tsx` renders them: `TrackLogo` on the track cards, `TrackTag` (logo plus label) wherever a challenge is listed (tracks form, teams directory, judging, admin).

Shell widths come from `src/lib/layout.ts` (`contentWidth`): header, admin strip and page content share one container. Only `/admin/tv` is wider.


Phones are plain data: `users.phone` is normalised to E.164 by `convex/lib/phone.ts` (`normalizePhone`, re-exported from `normalize.ts`) and never verified (the SMS/Twilio flow was removed; `migrations.dropPhoneVerification` clears its leftover fields). The number must carry a country prefix from `PHONE_COUNTRIES`, whose national-number lengths are checked (a bare 9-digit Spanish number is the only prefix-less input accepted, as +34; unlisted prefixes fall back to loose E.164). The dashboard edits it with `src/components/phone-input.tsx`: a prefix dropdown (Spain by default) plus the national number, validated as you type with the same helpers; the CLI keeps one free-text field but validates it with the same module (`apps/cli/src/lib/phone.ts` imports `convex/lib/phone.ts` at runtime, the one dependency-free module it bundles from the app) and sends E.164.

Email OTP: Convex env `ALLOW_EMAIL_OTP_STUB=true` (dev only) lets `00000000` stand in for the real code. Real codes stay random (Convex Auth looks codes up by hash with `.unique()`, so a fixed code would collide across accounts); `ResendOTP` records the real code in `devOtpCodes` and the `auth:signIn` wrapper swaps `00000000` for it. Ignored whenever `AUTH_RESEND_KEY` is set.

GitHub linking is a custom OAuth flow, not a Convex Auth provider (Convex Auth only links OAuth to the signed-in user by verified email). `github.startLink` stores a one-time state and returns the GitHub authorize URL; GitHub calls the Convex HTTP action at `CONVEX_SITE_URL/github/callback` directly (`https://api.hackspain.com/github/callback` in production, where the custom domain is the deployment's default HTTP Actions domain). The action exchanges the code, then `internal.github.linkAccount` writes `githubId` / `githubUsername` / `githubLinkedAt` on `users`, copies the handle onto the signup, and resolves pending team invites. Needs Convex env `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `SITE_URL`. The dashboard shows a "vincula tu GitHub" banner until `githubLinkedAt` is set; the callback redirects to `SITE_URL/<returnTo>?github=linked|cancelled|expired|taken|error`, where `returnTo` is the same-origin path `startLink` was given (`useGithubLink` passes the current page, the onboarding wizard passes `/onboarding`; the CLI passes nothing and lands on `/`).

Profiles store social links as `urls: { kind, url }[]`. `githubUsername` / `twitterHandle` stay denormalized for team lookup. One submission can enter multiple challenges via `challengeIds` and records partner perks in `perkIds`. Submit stays closed until an admin opens the window. Drafts can be saved before that. The dashboard no longer edits submissions: `/tracks` shows the project and points to the CLI (`src/components/project-cli-dialog.tsx`, same pattern as `team-cli-dialog.tsx`); `submissions.saveDraft` / `submit` are CLI-only callers now.

`pnpm migrate:convex` is idempotent on email. It uses `apps/web/.env` for Neon. `approval_status = confirmed` emails are marked accepted. Re-runs do not un-accept someone an admin already marked. Waitlist / pending / rejected stay unaccepted.

### Seed data (dev only)

`convex/seed.ts` fills the dev deployment with a hackathon in progress: 48 onboarded hackers plus pending / not-onboarded signups, 4 judges, 3 mentors and 2 sponsors (all typed), 14 teams with repos and stacks, one project per team across the tracks with three judging groups and scores, 8 perks with code pools and claims, ~120 feed posts and GitHub events over the last 30 hours, milestones, broadcasts and TV messages. It is an `internalMutation`, so only `convex run` can call it; it refuses to run on a deployment with `SEED_ALLOWED=false`, and it never touches rows it did not create. Every seeded email ends in `@seed.hackspain.dev`; with `ALLOW_EMAIL_OTP_STUB=true` log in as any of them with `00000000` (organiser: `org@seed.hackspain.dev`). Everyone has the name, photo and directory card the onboarding wizard requires, except a handful of deliberate gaps (two onboarded hackers without a card, one without a photo, one not-onboarded hacker and one judge without a card) that `seed:run` prints as `incompleteProfiles`; log in as one of those to walk the wizard.

```sh
pnpm seed:convex           # load (fails if already loaded); schedules seed:logos
pnpm seed:convex:reset     # wipe the seed and load it again
pnpm seed:convex:clear     # wipe only, including the stored team logos and the Convex Auth rows of seeded logins
pnpm --filter app exec convex run seed:logos '{"force":true}'   # regenerate team logos
```

Team logos are real files: `seed:logos` is an action that downloads one generated PNG per seeded team (DiceBear, keyed by team name) into Convex storage and attaches it. People's avatars stay external URLs.

### Dashboard routes

| Path | Role |
| --- | --- |
| `/login` | Email OTP |
| `/unregistered` | Signed in, email not in `signups` |
| `/pending` | Signup exists, not accepted |
| `/onboarding` | Wizard for whatever is still missing: phone, terms and consent (accepted signups), then name + photo, GitHub + X, directory card (everyone) |
| `/` | Home: section tiles plus the feed (composer + timeline with author, team and project context) |
| `/participantes` | Connections graph on real data (`directory.list`); the viewer's own card was filled during onboarding and is edited on `/profile#ficha` |
| `/cli` | CLI install and command guide |
| `/cli-auth` | Approve a CLI device login |
| `/cli-auth/handoff` | Signs the browser in from a CLI session (`hackspain open`); public, no chrome |
| `/tv` | Public venue screen (no login) |
| `/judging` | Assigned judging queues |
| `/profile` | Name, profile picture, phone, GitHub link, consent |
| `/teams` | Your team (owner uploads the logo) plus a directory of every team: members, project and chosen tracks. Create/join via CLI |
| `/perks` | Catalog + claim |
| `/tracks` | Read-only: the challenges with sponsor branding, the teams in each (expandable rosters) and your project's status. Enter tracks and submit via CLI (`hackspain track`, `hackspain submit`) |
| `/feed` | Redirects to `/` |
| `/insights` | Event analytics UI. Mock data only; do not query Convex here. |
| `/admin` | CRM |
| `/admin/users/[id]` | Participant detail, accept, role, user type, notes |
| `/admin/types` | User types: label, visible tabs, default type |
| `/admin/perks` | Perk CRUD + code pools |
| `/admin/applications` | Email perk applications queue |
| `/admin/tracks` | Track copy, sponsor logo and website, submission window, projects per challenge |
| `/admin/evento` | Hackathon start and end; outside the window participants keep profile, directory and perks |
| `/admin/notifications` | Broadcast email to audiences |
| `/admin/tv` | Venue screen canvas editor |

## CLI (`apps/cli`)

Commander + `@clack/prompts` on Bun, compiled to standalone binaries with `bun build --compile`. See [apps/cli/README.md](apps/cli/README.md).

- The CLI never talks to Convex. It calls the dashboard's `/api/cli/*` route handlers (`apps/app/src/app/api/cli`), which run allowlisted Convex functions server-side with the participant's own Convex Auth session (`fetchQuery` / `fetchMutation` / `fetchAction` from `convex/nextjs` with the bearer token). Same users as the web login. Add a function to `_lib/functions.ts` when a command needs it; `/api/cli(.*)` is public in `src/middleware.ts` because it authenticates with the bearer token, not the cookie.
- Backend types come from `apps/app/convex/_generated/api.d.ts` via a type-only import in `src/lib/api.ts`; at runtime `api.x.y` is only the name `"x:y"`. Run `pnpm dev:convex` after changing Convex functions so the CLI typecheck sees them.
- Functions the CLI calls throw `ConvexError({ code, message })` from `convex/lib/errors.ts`; the route relays them as `{ kind: "convex", data }` and the CLI raises `RemoteError`. Older web-facing functions throw plain `Error`; `src/lib/errors.ts` maps those Spanish gate messages to English hints and exit codes. `EVENT_CLOSED` (hackathon window) exits 4; `describeGate` in `src/lib/me.ts` reads `users.me.event` and fails before any gated prompt with the start or end date in Madrid time. The closed menu keeps profile, perks, the dashboard shortcut and account actions; `hackspain profile` and `hackspain perk list` remain available.
- Auth is unified in both directions. Web → CLI: `hackspain auth login` opens `/cli-auth?hs-code=` and polls `/api/cli/auth/device/*` (`cliAuth.start/approve/redeem`, `cli-device` provider). CLI → web: `hackspain open [page]` calls `cliAuth.startWebHandoff` over rpc, opens `/cli-auth/handoff?hs-token=…&next=/page`, and that page signs in with the `cli-handoff` credentials provider (`cliAuth.redeemWebHandoff`) so the Convex Auth proxy sets the normal cookies. Tokens are single-use and live 2 min (`cliWebHandoffs`). Never name the query param `code`: the Convex Auth middleware consumes it. `/cli-auth(.*)` is public in `src/middleware.ts`, and `AuthGate` renders `/cli-auth/handoff` without a session.
- Credentials: `~/.config/hackspain/credentials.json`, refreshed through `/api/cli/auth/refresh` under a lock file (Convex Auth rotates refresh tokens; a stale reuse logs every process out). State (cursors, spool) goes to `~/.local/state/hackspain/`. From a source checkout the CLI targets `http://localhost:3000` (`pnpm dev:app`); release binaries target `https://hackspain.app`.
- `--json` prints exactly one JSON object on stdout and disables prompts; everything else goes to stderr.
- `hackspain watch` collects AI-harness usage into the canonical `hackspain.telemetry.v1` event (`apps/cli/src/watcher/schema.ts`, documented in `apps/cli/docs/telemetry-schema.md`). Collectors live in `src/watcher/collectors/` (Claude Code, Codex, Gemini CLI, Qwen Code, OpenCode, Kilo Code as an OpenCode fork sharing `opencode.ts`, Cline) and must fail soft. Events go to a local NDJSON spool; the exact HTTP batch is persisted before upload and retried across restarts. `POST /api/cli/telemetry` (`apps/app/src/app/api/cli/telemetry/route.ts`) authenticates, validates, and inserts through `@rawtree/sdk` with a stable RawTree deduplication token. RawTree needs `RAWTREE_API_KEY` with `write_only` permission and `RAWTREE_DATABASE` in the dashboard environment; the default table is `hackspain_telemetry`. The insights page still reads mock data. Organiser broadcasts are polled through `/api/cli/rpc` (`notifications:forMe`) from the last `sentAt` seen by any run. `watcher/memory.ts` persists `watch-memory.json` (first start, last scan, last announcements): on start the board replays the spool (`replaySpool`) so totals and recent requests cover everything since the first run, announcements are restored, and `catchUpSince` makes the default `since` the last scan so logs written while closed are collected; `--backfill` overrides it. With a scheduled hackathon none of that applies: `watcher/window.ts` makes the collection window the hackathon itself, whole and on `occurredAt` (the harness's time, never the read time), the cursor store starts over when `since` moves earlier than its `coveredSince`, the watcher also runs in phase `after` to deliver leftovers, and the telemetry route rejects events outside the window (`outside_event_window`). Setting `RAWTREE_OTLP_LOGS_TABLE` adds a best-effort copy as OTLP logs (`telemetry/otlp.ts`) for RawTree's explorer; the canonical table stays the source of truth. Toasts only fire for announcements under ten minutes old. Fixtures under `apps/cli/test/fixtures` are redacted; a test rejects home paths.
- Telemetry update checklist: when adding or changing collected data, update `apps/cli/src/watcher/schema.ts`, the matching type and validator in `apps/app/src/app/api/cli/telemetry/rawtree.ts`, `apps/cli/docs/telemetry-schema.md`, the relevant collector/ingestion tests, and every RawTree query or dashboard that consumes it. A new optional field can use RawTree's Dynamic schema without a migration. Renaming a field, changing its type, or changing its meaning is breaking: bump `SCHEMA`, document the compatibility window, and keep ingestion compatible with the previous version during rollout. Keep `native` small, add every permitted key to both validators, and never place prompts, responses, code, full paths, environment variables, credentials, or harness account ids in telemetry. RawTree insert deduplication only protects the retry window: consumers must deduplicate permanently by `(identity.userId, eventId)` before aggregating.
- Feed: `posts` table (`convex/feed.ts`: list/post/remove, images in Convex file storage via `feed.generateUploadUrl`; the CLI uploads through `/api/cli/upload`). Posts carry `imagePath` (`/api/files/<storageId>`), never a Convex storage URL: `src/app/api/files/[id]/route.ts` checks the cookie or bearer session, asks `feed.imageUrl` (only ids attached to a post or set as a profile picture resolve) and streams the bytes under our domain; unauthenticated requests are redirected to `/login`. `?w=<16..1024>` returns a PNG resized with `sharp` (first frame, never enlarged). `hackspain feed` draws that PNG inline through the Kitty graphics protocol or the iTerm2 OSC 1337 protocol when `src/lib/term-images.ts` detects a terminal that speaks one (env-based, never in tmux, `--json` or piped), and prints the link otherwise. Sizes are capped by `imageCells` (36×12 cells in `feed`, `WATCH_IMAGE_BOUNDS` 30×6 in the watcher). The watcher band draws pictures too: `frameWithSlots` reserves blank rows per post and `watcher/images.ts` reconciles them after each text repaint (Kitty: transmit once by id, then place/delete; iTerm2: re-send when a covered row was repainted). The header shows the embedded wordmark PNG (`apps/cli/src/assets/logo.ts`, regenerate from `apps/web/public/brand-assets/hackspain-wordmark-color@2x.png` with sharp at 640 px) as the `logo` slot when the terminal draws images, ASCII otherwise; `banner()` in `lib/banner.ts` does the same for every other opening (`hackspain`, the menu redraw, `--help`) with a fixed kitty image id so redraws replace the picture; harness names carry a brand glyph from `HARNESS_BRAND` in `watcher/screen.ts`, replaced by the real 96 px logo (`apps/cli/src/assets/harness-logos.ts`, rasterised with sharp from `apps/web/public/harnesses/*.svg` with a brand-coloured fill) as a 2×1-cell `harness:<id>` slot when images are supported. Pagination uses `feed.list`'s `before` cursor: `hackspain feed` offers the next page on a TTY and prints `--before <createdAt>` otherwise; the watcher scrolls with ↑/↓ (`scrollFeed`, `mergeNewerFeed`, `appendOlderFeed` in `watcher/state.ts`) and prefetches older pages near the end. Sixel and block-mosaic fallbacks are deliberately not implemented: they need pixel decoding in the binary. GitHub activity is polled server-side by `convex/crons.ts` → `internal.githubFeed.pollRepos` every 3 minutes from each team's `repoUrl`, deduped on `externalId`, with ETags so quiet repos cost nothing. **`GITHUB_TOKEN` must be set on the Convex deployment**: unauthenticated calls share 60/hour per egress IP and Convex's shared IPs are always exhausted. GitHub's Events API returns trimmed payloads (no commit list, no PR title), so pushes are described from ref + sha and pull requests get one extra detail request. Changing a team's repo resets its ETag; dissolving a team deletes its GitHub posts. `pnpm --filter app exec convex run githubFeed:purgeRepo '{"repo":"org/name"}'` clears a repo's posts.
- `hackspain profile` still edits diet and travel through `users.updateEventDetails` (the web profile dropped those in event mode) plus a name (`users.setName`, `users.updateEventDetails`, `users.setNotificationConsent`, `users.setPhone`, `github.startLink/unlink`); `auth login` runs `completeProfile` afterwards, which asks for a missing name, a missing phone (accepted users only) or GitHub link, each skippable, and points at `hackspain open` when `users.me.profileMissing` still lists a photo or the directory card (those are dashboard-only). GitHub linking is the same OAuth flow: the CLI prints the authorise URL and the callback lands on the dashboard.
- Lint with Oxlint and `ultracite` (Biome); run it with `pnpm lint`. CLI tests use Bun's test runner through `pnpm test`.

## Conventions

- Match existing files. Prefer editing the island and its Astro page over new frameworks or extra CSS files.
- No `any`. Strict TypeScript.
- Server secrets stay in `import.meta.env` (landing) or Convex/Next server env. Never prefix Discord or the database URL with `PUBLIC_`.
- Illustrations are SVGs under `apps/web/src/assets/`. Quiver scripts regenerate them.
- Verify UI in the browser. Landing and dashboard do not share a layout.
