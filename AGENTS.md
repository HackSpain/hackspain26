# HackSpain monorepo

Marketing site for HackSpain 2026 (Madrid) at https://hackspain.com, plus the participant/admin dashboard.

Setup, env vars, and Convex login live in the [README](README.md). Bun workspaces. Node ≥ 22.12.

```text
apps/web    # Astro 6 landing (Vercel, React islands, Tailwind v4, Neon/Drizzle)
apps/app    # Next.js dashboard + Convex (auth, CRM, teams, perks)
apps/cli    # `hackspain` terminal client for participants (Bun binary, same Convex backend)
```

```sh
bun install
bun dev                 # landing — localhost:4321
bun dev:app             # dashboard — localhost:3000
bun dev:convex          # Convex dev (not production deploy)
bun dev:all             # landing + dashboard + Convex
bun migrate:convex      # Neon → Convex. Idempotent on email. Do not run unless importing.
```

Do not run `npx convex deploy` unless you are shipping Convex to production.

Copy `apps/web/.env.example` → `apps/web/.env` for signup APIs. Copy `apps/app/.env.example` → `apps/app/.env.local` for the dashboard. Static landing pages run without a database.

## Landing (`apps/web`)

Astro 6 with server output on Vercel, React islands, Tailwind CSS v4, Motion. Synced from the marketing repo at `origin/master` (`49337e0`). Trailing slashes are off (`trailingSlash: "never"`). Public copy is Spanish-first; there is no `/en` / `/es` locale prefix.

### Layout

```text
apps/web/src/
├── components/          # mosaic, pages, sections, share badge, forms
├── data/                # SEO, section routes, llms.txt, mentors/judges
├── db/                  # Drizzle client + schema (Neon)
├── layouts/layout.astro # SEO + JSON-LD
├── lib/                 # Zod validation, email, badge, shortlist
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
| `/shortlist` | Internal applicant review. Password-gated (`SHORTLIST_PASSWORD`). | no |
| `/api/signup`, `/api/signup-prefill`, `/api/mentor-sponsor-signup` | JSON POST | no |
| `/llms.txt` | Machine-readable site summary | yes |

Landing section slugs live in `src/data/section-routes.ts`. Adding a section means updating that list, mosaic cells, `landing-meta.ts` SEO arrays, and a root alias page.

`/shortlist` is internal to the landing app. It is server-rendered (`prerender = false`) and gated by the `SHORTLIST_PASSWORD` server env via an httpOnly cookie. Applicants load from Neon on the server (`shortlist-server.ts`) and are passed as props — never import applicant JSON in the client. `/api/shortlist` uses the same cookie. Keep `noindex, nofollow`, `Disallow: /shortlist` in `apps/web/public/robots.txt`, and do not add it to the sitemap, public nav, or the dashboard. Do not log or dump applicant PII.

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

Tables in `src/db/schema.ts` include `hackathon_signups`, `hackathon_pre_signups`, `mentor_sponsor_signups`, `shortlist_reviews`. Change schema with Drizzle (`bun db:generate` then migrate). Do not hand-edit applied SQL as the source of truth.

New dashboard data lives in Convex, not Neon. Keep using Neon for the public signup API until that is migrated separately.

## Dashboard (`apps/app`)

Next.js App Router + Convex + Convex Auth (email OTP) + shadcn.

Wrappers: `authedQuery` / `authedMutation` / `accepted*` / `onboarded*` / `adminQuery` / `adminMutation`.

Sign in with the `/signup` email. No signup row means `/unregistered`. Accepted hackers confirm details on `/onboarding`. Everyone else with a signup sees `/pending`. Admins mark accepted in CRM and bypass participant gates. Admin role: `ADMIN_EMAILS` Convex env, or CRM “Make admin”.

Phone OTP without Twilio requires Convex env `ALLOW_PHONE_STUB=true` (dev only); otherwise `requestPhoneCode` throws "SMS is not configured". Users still must enter the code.

Email OTP: Convex env `ALLOW_EMAIL_OTP_STUB=true` (dev only) lets `00000000` stand in for the real code. Real codes stay random (Convex Auth looks codes up by hash with `.unique()`, so a fixed code would collide across accounts); `ResendOTP` records the real code in `devOtpCodes` and the `auth:signIn` wrapper swaps `00000000` for it. Ignored whenever `AUTH_RESEND_KEY` is set.

GitHub linking is a custom OAuth flow, not a Convex Auth provider (Convex Auth only links OAuth to the signed-in user by verified email). `github.startLink` stores a one-time state and returns the GitHub authorize URL; the HTTP route `/github/callback` (`convex/http.ts`) exchanges the code, then `internal.github.linkAccount` writes `githubId` / `githubUsername` / `githubLinkedAt` on `users`, copies the handle onto the signup, and resolves pending team invites. Needs Convex env `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SITE_URL`. The dashboard shows a "vincula tu GitHub" banner until `githubLinkedAt` is set; the callback redirects to `SITE_URL/?github=linked|cancelled|expired|taken|error`.

Profiles store social links as `urls: { kind, url }[]`. `githubUsername` / `twitterHandle` stay denormalized for team lookup. One submission can enter multiple challenges via `challengeIds` and records partner perks in `perkIds`. Submit stays closed until an admin opens the window. Drafts can be saved before that.

`bun migrate:convex` is idempotent on email. It uses `apps/web/.env` for Neon. `approval_status = confirmed` and shortlist `finalSelected` emails are marked accepted. Re-runs do not un-accept someone an admin already marked. Waitlist / pending / rejected stay unaccepted. The rest of the shortlist JSON is not imported.

### Dashboard routes

| Path | Role |
| --- | --- |
| `/login` | Email OTP |
| `/unregistered` | Signed in, email not in `signups` |
| `/pending` | Signup exists, not accepted |
| `/onboarding` | Accepted hacker confirms phone, diet, travel, attend/cancel |
| `/` | Home |
| `/profile` | Edit phone, diet, travel, consent, attendance |
| `/teams` | Create team, add by GitHub / X / email |
| `/perks` | Catalog + claim |
| `/tracks` | Challenges from Convex; one project form, multi-challenge; draft save; submit gated until open |
| `/admin` | CRM |
| `/admin/perks` | Perk CRUD + code pools |
| `/admin/applications` | Email perk applications queue |
| `/admin/tracks` | Track copy, submission window, projects per challenge |

## CLI (`apps/cli`)

Commander + `@clack/prompts` on Bun, compiled to standalone binaries with `bun build --compile`. See [apps/cli/README.md](apps/cli/README.md).

- The CLI never talks to Convex. It calls the dashboard's `/api/cli/*` route handlers (`apps/app/src/app/api/cli`), which run allowlisted Convex functions server-side with the participant's own Convex Auth session (`fetchQuery` / `fetchMutation` / `fetchAction` from `convex/nextjs` with the bearer token). Same users as the web login. Add a function to `_lib/functions.ts` when a command needs it; `/api/cli(.*)` is public in `src/middleware.ts` because it authenticates with the bearer token, not the cookie.
- Backend types come from `apps/app/convex/_generated/api.d.ts` via a type-only import in `src/lib/api.ts`; at runtime `api.x.y` is only the name `"x:y"`. Run `bun dev:convex` after changing Convex functions so the CLI typecheck sees them.
- Functions the CLI calls throw `ConvexError({ code, message })` from `convex/lib/errors.ts`; the route relays them as `{ kind: "convex", data }` and the CLI raises `RemoteError`. Older web-facing functions throw plain `Error`; `src/lib/errors.ts` maps those Spanish gate messages to English hints and exit codes.
- Credentials: `~/.config/hackspain/credentials.json`, refreshed through `/api/cli/auth/refresh` under a lock file (Convex Auth rotates refresh tokens; a stale reuse logs every process out). State (cursors, spool) goes to `~/.local/state/hackspain/`. From a source checkout the CLI targets `http://localhost:3000` (`bun dev:app`); release binaries target `https://app.hackspain.com`.
- `--json` prints exactly one JSON object on stdout and disables prompts; everything else goes to stderr.
- `hackspain watch` collects AI-harness usage into the canonical `hackspain.telemetry.v1` event (`apps/cli/src/watcher/schema.ts`, documented in `apps/cli/docs/telemetry-schema.md`). Collectors live in `src/watcher/collectors/` and must fail soft. Events go to a local NDJSON spool and are uploaded to `POST /api/cli/telemetry` (`apps/app/src/app/api/cli/telemetry/route.ts`), which authenticates and validates them and is where the store gets wired server-side; the store is undecided and the insights page still reads mock data. Organiser broadcasts are polled through `/api/cli/rpc` (`notifications:forMe`). Fixtures under `apps/cli/test/fixtures` are redacted; a test rejects home paths.
- Feed: `posts` table (`convex/feed.ts`: list/post/remove, images in Convex file storage via `feed.generateUploadUrl`; the CLI uploads through `/api/cli/upload`). GitHub activity is polled server-side by `convex/crons.ts` → `internal.githubFeed.pollRepos` every 3 minutes from each team's `repoUrl`, deduped on `externalId`, with ETags so quiet repos cost nothing. **`GITHUB_TOKEN` must be set on the Convex deployment**: unauthenticated calls share 60/hour per egress IP and Convex's shared IPs are always exhausted. GitHub's Events API returns trimmed payloads (no commit list, no PR title), so pushes are described from ref + sha and pull requests get one extra detail request. Changing a team's repo resets its ETag; dissolving a team deletes its GitHub posts. `bunx convex run githubFeed:purgeRepo '{"repo":"org/name"}'` clears a repo's posts.
- Lint with `ultracite` (Biome) like `apps/web`; tests are `bun test` under `apps/cli/test`.

## Conventions

- Match existing files. Prefer editing the island and its Astro page over new frameworks or extra CSS files.
- No `any`. Strict TypeScript.
- Server secrets stay in `import.meta.env` (landing) or Convex/Next server env. Never prefix Discord or the database URL with `PUBLIC_`.
- Illustrations are SVGs under `apps/web/src/assets/`. Quiver scripts regenerate them.
- Verify UI in the browser. Landing and dashboard do not share a layout.
