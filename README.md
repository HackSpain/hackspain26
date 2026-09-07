# HackSpain

Monorepo for [HackSpain](https://hackspain.com) (Hack Spain 2026, Madrid).

| App | Stack | Default URL |
| --- | --- | --- |
| `apps/web` | Astro 6, React islands, Tailwind v4, Neon/Drizzle | [localhost:4321](http://localhost:4321) |
| `apps/app` | Next.js, Convex, Convex Auth, shadcn | [localhost:3000](http://localhost:3000) |
| `apps/cli` | Bun, Commander, clack; `hackspain` binary for participants | `bun dev:cli -- --help` |

Package manager is Bun. Node.js ≥ 22.12.

## Setup

```sh
bun install
cp apps/web/.env.example apps/web/.env
cp apps/app/.env.example apps/app/.env.local
```

Landing static pages run without a database. Signup and ambassador APIs need `DATABASE_URL` (Neon PostgreSQL). Optional `DISCORD_WEBHOOK_URL` notifies Discord on new submissions. `SHORTLIST_PASSWORD` gates the internal `/shortlist` review page; without it the page renders no data.

The dashboard needs a Convex development deployment (`bun dev:convex` / `npx convex dev`). Do not use `npx convex deploy` unless you are shipping production. Dashboard env lives in `apps/app/.env.example`.

## Commands

| Command | Description |
| :------ | :---------- |
| `bun dev` / `bun dev:web` | Landing only |
| `bun dev:app` | Dashboard Next.js server |
| `bun dev:convex` | Convex functions + codegen (development only) |
| `bun dev:all` | Landing + dashboard + Convex in one terminal |
| `bun build` / `bun build:app` | Production builds |
| `bun preview` | Preview the landing build |
| `bun check` | Astro + TypeScript checks |
| `bun migrate:convex` | Import Neon signups/ambassadors into Convex |
| `bun dev:cli -- <args>` / `bun test:cli` / `bun build:cli` | Run, test, or compile the `hackspain` CLI (participants install it with `curl -fsSL https://hackspain.com/install.sh \| sh`) |
| `bun db:generate` / `bun db:migrate` / `bun db:push` | Landing Drizzle |

## Convex auth and admin

1. From the repo root, run `bun dev:convex`. From `apps/app`, run `bun run dev:convex`. Create or select a **dev** project. Leave it running.
2. Set Convex env (in another terminal, still from `apps/app`):

```sh
npx convex env set SITE_URL http://localhost:3000
npx convex env set ADMIN_EMAILS you@example.com
npx convex env set MIGRATION_SECRET "$(openssl rand -hex 24)"
# optional email delivery; without this, OTPs print in Convex logs
npx convex env set AUTH_RESEND_KEY re_...
npx convex env set AUTH_EMAIL "HackSpain <onboarding@resend.dev>"
# dev only: allow the phone-verification stub (no Twilio). Never set in production.
npx convex env set ALLOW_PHONE_STUB true
# dev only: 00000000 also works as the email sign-in code (ignored if AUTH_RESEND_KEY is set).
npx convex env set ALLOW_EMAIL_OTP_STUB true
# GitHub account linking (optional). Create a GitHub OAuth App whose callback URL is
# <your deployment>.convex.site/github/callback, then:
npx convex env set GITHUB_CLIENT_ID Iv1...
npx convex env set GITHUB_CLIENT_SECRET ...
```

3. Copy the printed `CONVEX_URL` into `apps/app/.env.local` as `NEXT_PUBLIC_CONVEX_URL`.
4. Generate Convex Auth JWT keys once:

```sh
cd apps/app
npx @convex-dev/auth
```

5. Sign in at `/login` with an email that exists in Convex `signups`. An organizer must mark that signup **accepted** in `/admin` before the person can confirm details.

### Confirming details

Accepted hackers confirm phone (E.164 + code), dietary restrictions, travel origin, and attend/cancel. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` on the Convex deployment to deliver codes via SMS (partial config fails loudly). Without Twilio, the phone code is only logged and returned as a stub when the Convex env `ALLOW_PHONE_STUB=true`; otherwise the request fails with "SMS is not configured". The number is not auto-confirmed. Import marks Neon `approval_status = confirmed` (and shortlist `finalSelected`) as accepted. Everyone else stays unaccepted until CRM.

## Migrating Neon to Convex

`bun migrate:convex` from the repo root. Idempotent on email. Safe to re-run. Do not run it unless you mean to import.

It loads `DATABASE_URL` from `apps/web/.env`, and `NEXT_PUBLIC_CONVEX_URL` plus `MIGRATION_SECRET` from `apps/app/.env.local`. Shell exports win if already set. `MIGRATION_SECRET` must match the Convex deployment env.

The script upserts `hackathon_signups` and `ambassador_applications` into Convex. Emails with `finalSelected` in the landing shortlist JSON are marked accepted. Re-runs do not clear an admin’s accepted flag. It does not copy the rest of the shortlist into Convex.

## Design

Landing and dashboard share these tokens:

- paper `#f4ecd8`, sand `#e8dcc4`, gold `#eab619`, orange `#d96b2a`, red `#cc291f`, brown `#4a2c1f`, slate `#8fb8d1`, teal `#35858a`, navy `#1e3958`, ink `#2a170f`
- DM Sans (body), Bungee (display / buttons)

`/shortlist` stays on the landing app only (noindex, PII). It is server-rendered and gated by `SHORTLIST_PASSWORD`. It is not part of the dashboard.

## Deploy

Two Vercel projects, both linked to this repo. Set **Root Directory** before the first production deploy of the monorepo or the landing build will look for Astro at the repo root and fail.

| Project | Root Directory | Domain | Build |
| --- | --- | --- | --- |
| Landing (existing) | `apps/web` | hackspain.com | `bun run build` (in `apps/web/vercel.json`) |
| Dashboard (new) | `apps/app` | e.g. app.hackspain.com | `bun run vercel-build` — deploys Convex, then Next.js |

Vercel reads `bun.lock` from the repo root (`installCommand` is `cd ../.. && bun install`). A change that only touches the other app is skipped (`scripts/vercel-ignore.sh`).

### Convex on merge

`apps/app` build runs `convex deploy --cmd 'bun run build'`. That needs `CONVEX_DEPLOY_KEY` in Vercel, not a local `npx convex deploy`.

1. Convex dashboard → project → create a **production** deployment if you do not have one.
2. Production deployment → Settings → Deploy Keys → **Generate Production Deploy Key** (`deployment:deploy`).
3. Vercel dashboard project → Environment Variables:
   - `CONVEX_DEPLOY_KEY` = production key. Environment: **Production** only.
   - Optional: a **Preview** deploy key (project Settings → Generate Preview Deploy Key) as `CONVEX_DEPLOY_KEY` for Preview only. That gives each PR its own Convex backend.
4. On the Convex **production** deployment (`npx convex env set` from `apps/app` after `npx convex deploy` once, or the dashboard Env vars UI):

```sh
npx convex env set SITE_URL https://app.hackspain.com
npx convex env set ADMIN_EMAILS you@example.com
npx convex env set AUTH_RESEND_KEY re_...
npx convex env set AUTH_EMAIL "HackSpain <onboarding@resend.dev>"
npx convex env set MIGRATION_SECRET "$(openssl rand -hex 24)"
```

Do **not** set `ALLOW_PHONE_STUB` or `ALLOW_EMAIL_OTP_STUB` on production. Do **not** put `.env` / `.env.local` in git.

`convex deploy --cmd` injects `NEXT_PUBLIC_CONVEX_URL` for the Next.js build. You do not need to paste the prod Convex URL into Vercel unless you skip the deploy-key flow.

Landing Vercel env stays as today (`DATABASE_URL`, `RESEND_*`, `SHORTLIST_PASSWORD`, `SENTRY_*`, …). Those are not Convex.
