# HackSpain dashboard

Next.js + Convex participant/admin app. Setup lives in the root [README](../../README.md).

```sh
pnpm dev          # localhost:3000
pnpm convex:dev   # development only
```

Production Convex deploys from the Vercel build (`pnpm vercel-build`), not from a laptop. See the root [README](../../README.md#deploy).

Import Neon signups with `pnpm migrate:convex` from the repo root.
