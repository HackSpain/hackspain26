# HackSpain dashboard

Next.js + Convex participant/admin app. Setup lives in the root [README](../../README.md).

```sh
pnpm dev          # localhost:3000
pnpm convex:dev   # development only
```

Production Convex deploys from the Vercel build (`pnpm vercel-build`), not from a laptop. See the root [README](../../README.md#deploy).

Import Neon signups with `pnpm migrate:convex` from the repo root.

## Dashboard firewall

The `hackspain-app` Vercel project uses Firewall → Rules → Bot Protection in
**Challenge** mode. The dashboard does not use the BotID SDK. Configure the
firewall before deploying the app without BotID; this protection is not applied
by a code deployment and does not run on localhost.

The active **Allow application backend routes** custom rule uses Request Path
matching `^/(api|betterstack)/` with action **Bypass**, ahead of Bot Protection.
It covers browser auth (`/api/login/otp`, `/api/auth`), CLI, files, TV APIs, and
Better Stack proxies. Keep these routes free of browser bot challenges and
project firewall rate limits. A separate GET `/api/tv` bypass still exists but
is already covered by the broader rule.

The bypass skips subsequent project rules and managed rulesets, not Vercel's
system DDoS mitigations, platform limits, or application authentication and
validation. Keep application controls such as OTP attempt limits. The landing's
BotID integration is independent. Check rule ordering and path coverage when
adding endpoints or firewall rules. Save and **Publish** firewall changes;
staged changes and Git deployments do not activate them.

Inspect challenge decisions in Vercel Firewall; edge rejections do not execute
the app's error-reporting code. Avoid synthetic errors or OTP sends to real users
when checking production.

See [the incident learnings](../../docs/learnings.md#2026-09-18--backend-routes-must-not-receive-browser-bot-challenges)
for the observed failure, correction, and verification steps.
