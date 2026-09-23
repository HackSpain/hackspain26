# README images

Images used by the root [README](../../README.md). Nothing in the apps imports this folder.

| File | Source | How to refresh |
| --- | --- | --- |
| `wordmark-color.svg`, `wordmark-white.svg` | Copies of `apps/web/public/brand-assets/hackspain-wordmark-*.svg`. | Copy again when the brand kit changes. |
| `hero.png` | Copy of `apps/web/public/og-landing.png`. | `pnpm og:generate`, then copy. |
| `illustration-*.webp` | Copies of the `-brand` Quixote illustrations in `apps/web/src/assets/`. | Copy again when the illustrations change. |
| `landing.webp` | Headless Chrome screenshot of https://hackspain.com at 1440 × 900 and 2x scale, driven over the DevTools protocol so the script can accept the cookie banner and wait for the participant counter to reach 250. Resized to 1600 px wide. | Take a new screenshot after a visible landing change. |
| `tv-panel.webp`, `tv-sponsors.webp` | Headless Chrome screenshots of `https://hackspain.app/tv?view=panel&demo=1` and `?view=patrocinadores&demo=1` at 1920 × 1080, resized to 1600 px wide. Demo mode shows invented teams and numbers. | Same URLs. The panel rotates, so the frame you get varies. |
| `cli-help.webp` | Real output of `./dist/hackspain --help` (release build, `HACKSPAIN_NO_IMAGES=1 FORCE_COLOR=3` under a 100-column pseudo terminal), converted from ANSI to HTML and screenshotted in headless Chrome at 2x. | Rebuild the binary, capture again, re-render. |
| `palette.svg` | Hand-written SVG of the ten colour tokens in `apps/web/src/data/design.md`. | Edit the hex values in the file. |

Brand assets, illustrations and the logos visible in the screenshots are not covered by the MIT license. See [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).
