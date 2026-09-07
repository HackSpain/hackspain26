# HackSpain

Public marketing site for [HackSpain](https://hackspain.com) — Hack Spain 2026, Madrid. Copy and SEO are Spanish-first.

## Tech stack

| Layer | Technologies |
| :---- | :------------- |
| **Framework** | [Astro 6](https://astro.build/) with server output (`output: "server"`) |
| **UI** | [React 19](https://react.dev/) islands, [Tailwind CSS v4](https://tailwindcss.com/), [Motion](https://motion.dev/) |
| **Hosting** | [Vercel](https://vercel.com/) via `@astrojs/vercel` |
| **Data** | [PostgreSQL](https://www.postgresql.org/) ([Neon](https://neon.tech/)) with [Drizzle ORM](https://orm.drizzle.team/) |
| **Forms & validation** | [React Hook Form](https://react-hook-form.com/), [Zod](https://zod.dev/) |
| **Email** | Resend API, plain text and HTML |
| **Observability** | [Sentry](https://sentry.io/), [@vercel/analytics](https://vercel.com/docs/analytics), [@vercel/speed-insights](https://vercel.com/docs/speed-insights) |
| **Bot protection** | [BotID](https://botid.vercel.app/) on signup endpoints |
| **Tooling** | TypeScript, [Oxlint](https://oxc.rs/docs/guide/usage/linter.html), [Ultracite](https://www.ultracite.ai/) / Biome (`pnpm lint`, `pnpm fix`), [Knip](https://knip.dev/) |

## Requirements

- [Node.js](https://nodejs.org/) **≥ 22.12**
- [pnpm](https://pnpm.io/) **10.x** (see `packageManager` in `package.json`)

## Getting started

```sh
pnpm install
cp .env.example .env
```

Apply the schema when working with the database (see [Database](#database)).

```sh
pnpm dev
```

Development server: [http://localhost:4321](http://localhost:4321).

## Scripts

| Command | Description |
| :------ | :---------- |
| `pnpm dev` | Development server |
| `pnpm build` | Production build (`./dist/`) |
| `pnpm preview` | Preview production build locally |
| `pnpm astro check` | Astro and TypeScript checks |
| `pnpm lint` | Check lint and formatting (Oxlint + Ultracite / Biome) |
| `pnpm fix` | Auto-fix lint and format issues |
| `pnpm knip` | Find unused exports, dependencies, and files |

## Database

Schema and client live in `src/db/`. Drizzle Kit is configured in `drizzle.config.ts`.

| Command | Description |
| :------ | :---------- |
| `pnpm db:generate` | Generate migrations from schema changes |
| `pnpm db:migrate` | Run migrations |
| `pnpm db:push` | Push schema (useful in development) |

## Signup flow

The public application form lives at `/signup`. New applications are stored as
pending until they are reviewed. Historical pre-signup records can prefill the
application form through private invitation tokens, while public referral codes
in `/signup?ref=…` attribute how applicants found the event.

Transactional email is sent through Resend. Verify the sending domain configured
in `RESEND_FROM`, then set `RESEND_API_KEY` and `RESEND_FROM` in Vercel. The
sender uses the isolated `updates.hackspain.com` subdomain and intentionally
does not advertise a separate reply address.

Each signup has a private management token. `/cancelacion?token=…` uses it to
cancel an active application, while the tokenless page can email the private
link again.

## Project layout

```text
src/
├── components/     # React islands (pages, mosaic, UI, sections)
├── data/           # SEO copy, site metadata, llms.txt source
├── db/             # Drizzle client and schema
├── layouts/        # Astro layouts
├── lib/            # Shared server and client utilities
└── pages/          # File-based routes
```
