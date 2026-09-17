# HackSpain dashboard

Next.js + Convex participant/admin app. Setup lives in the root [README](../../README.md).

```sh
pnpm dev          # localhost:3000
pnpm convex:dev   # development only
```

Production Convex deploys from the Vercel build (`pnpm vercel-build`), not from a laptop. See the root [README](../../README.md#deploy).

Import Neon signups with `pnpm migrate:convex` from the repo root.

## Login bot protection

The `hackspain-app` Vercel project uses Firewall → Rules → Bot Protection in
**Challenge** mode. The dashboard does not use the BotID SDK. Configure the
firewall before deploying the app without BotID; this protection is not applied
by a code deployment and does not run on localhost.

Two custom bypass rules keep legitimate non-browser clients working:

- Request Path matches `^/api/(cli|files)/` for the CLI and its file downloads.
- Request Path equals `/api/tv` **and** Method equals `GET` for uptime checks.

These bypass subsequent project rules and managed rulesets, not Vercel's system
DDoS mitigations or the application's authentication. Keep future rate-limit or
deny rules that must cover these routes above the bypass rules. Do not bypass
`/api/login/otp` or `/api/auth`. The landing's BotID integration is independent.

Inspect challenge decisions in Vercel Firewall; edge rejections do not execute
the app's error-reporting code. Avoid synthetic errors or OTP sends to real users
when checking production.
