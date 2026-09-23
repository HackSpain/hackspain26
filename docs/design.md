# HackSpain design system

This document records the design system of the landing (`apps/web`). It was extracted from the code on 2026-09-23 with a frequency scan of every `.astro`, `.tsx` and `.ts` file under `apps/web/src`, the shared primitives, and the public brand page (`apps/web/src/pages/brand.astro`). Counts in this document are class occurrences from that scan. Read this document before you build or change UI. The dashboard (`apps/app`) shares the tokens. See the last section for the differences.

## Direction

The landing is a paper mosaic. Flat paper tiles sit next to each other, separated by 3 px ink lines. Bungee gives the headlines their voice. DM Sans carries the text. Shadows are hard ink offsets, never blurs. The motifs come from La Mancha (windmill, horse, Quixote) and are drawn as ink brush illustrations.

Four rules follow from that:

- Ink lines make the structure. Do not use shadows, gradients or rounded cards to separate content.
- Use solid colour blocks, not tints. A panel is gold, teal, red or orange edge to edge.
- Type carries the personality. Bungee for short display text, DM Sans in bold weights for everything else.
- Everything is flat and warm. There is no gray, no white background, no dark mode.

## Tokens

### Colour

Tokens are defined three times and must stay equal: `apps/web/src/styles/global.css` (`@theme`), `apps/web/src/components/theme/palette.ts` (`HS_PALETTE`, for canvas and OG images) and `apps/app/src/app/globals.css`.

| Token | Hex | Role | Evidence |
| --- | --- | --- | --- |
| `hs-paper` | `#f4ecd8` | Page and card background. The only base surface. | `bg-hs-paper` 114 |
| `hs-ink` | `#2a170f` | Text, borders, hard shadows, dark surface. | `text-hs-ink` 122, `border-hs-ink` 105 |
| `hs-gold` | `#eab619` | Primary action, highlight panel, focus ring on dark. | `bg-hs-gold` 34 |
| `hs-sand` | `#e8dcc4` | Secondary surface, hover fill at 40 to 60 percent. | `bg-hs-sand/40` 5, `hover:bg-hs-sand/40` 5 |
| `hs-orange` | `#d96b2a` | Accent panel, icon accent, link hover. | `bg-hs-orange` 15 |
| `hs-red` | `#cc291f` | Accent panel, "Evita" and "No" marks, error tint at 20 percent. | `bg-hs-red` 12, `text-hs-red` 19 |
| `hs-teal` | `#35858a` | Accent panel, "Haz" panel, soft button fill at 35 percent. | `bg-hs-teal` 13 |
| `hs-navy` | `#1e3958` | Focus colour. Also a dark logo background. | `outline-hs-navy` 12, `border-hs-navy` 18 |
| `hs-brown` | `#4a2c1f` | Hint text under form labels. | `text-hs-brown` 18 |
| `hs-slate` | `#8fb8d1` | Rare. Mosaic accent only. | 0 utility uses |
| `hs-cream` | `#f4ecd8` | Alias of paper. Prefer `hs-paper`. | `bg-hs-cream` 4 |

Rules:

- Text is ink on paper, sand and gold. Text is white on red, teal, navy and ink.
- Secondary text is `text-hs-ink/65`. Tertiary text is `text-hs-ink/40` or `/55`. On dark surfaces use `text-hs-paper/70` or `/60`.
- The logo colours `#CA0005` and `#F29100` belong to the logo files only. Do not use them in UI. Use `hs-red` and `hs-orange`.
- Do not add colours. `bg-white` appears once in the landing, on the cancellation page input, and that input should be paper like every other control. Do not use gray.
- Raw hex belongs only in `palette.ts`, the email templates and the brand page swatches.

### Typography

Fonts load from Google Fonts in `apps/web/src/layouts/layout.astro`: Bungee (one weight) and DM Sans (variable, 100 to 900, optical sizes 9 to 40). `font-bungee` appears 76 times and `font-sans` 70 times.

| Role | Classes | Notes |
| --- | --- | --- |
| Display | `font-bungee text-[clamp(2rem,9vw,3.4rem)] leading-none text-balance` | Fluid sizes with `clamp()`. Line height 0.98 to 1.08. |
| Section title | `font-bungee text-xl leading-tight sm:text-2xl` | Up to `text-3xl`. |
| Eyebrow label | `font-black text-[0.65rem] uppercase tracking-[0.16em] text-hs-ink/55` | DM Sans, not Bungee. Tracking 0.12 to 0.17 em. |
| Body | `font-sans text-base font-bold leading-relaxed text-pretty` | `sm:text-lg` for lead paragraphs. |
| UI text | `font-sans text-sm font-semibold leading-snug` | The most common size: `text-sm` 75, `leading-snug` 34. |
| Hint | `font-sans text-sm leading-snug text-hs-brown` | `hsHintClass` in `form/field-classes.ts`. |
| Label | `font-bungee text-sm tracking-wide` or `font-sans text-sm font-extrabold` | `hsLabelBungeeClass`, `hsLabelSansClass`. |
| Button | `font-bungee text-sm tracking-wide` | Part of `hsButtonClass`. |
| Numbers | `tabular-nums` | Countdowns and counters. |

Rules:

- Weights are 600 to 900 only: `font-bold` 47, `font-semibold` 33, `font-black` 20, `font-extrabold` 9. `font-normal` and `font-medium` do not appear.
- Use Bungee for headlines, figures and short calls. Use DM Sans for paragraphs, navigation and data. The brand page says this in its own words.
- Paragraphs get `text-pretty` (16). Headlines get `text-balance` (6).
- Inside mosaic tiles, use the container-query classes from `global.css` (`hs-mosaic-lbl`, `hs-mosaic-bd`, `hs-mosaic-headline`, and so on) through `mosaic/mosaic-typography.ts`. Do not use `text-*` utilities there. The tile is a `container-type: size` element and the type scales with `cqw` and `cqh`.

### Spacing

The base is 4 px. The scale in use is 1.5, 2, 3, 4, 5, 6, 8, 10 and 12 (6 px to 48 px).

| Use | Classes | Evidence |
| --- | --- | --- |
| Horizontal padding | `px-4` then `px-6` | 57 and 30 |
| Vertical padding | `py-3`, `py-2`, `py-2.5` | 24, 11 |
| Gaps | `gap-3`, `gap-2`, `gap-1.5`, `gap-4` | 22, 20, 13, 12 |
| Stack rhythm | `mt-2` related lines, `mt-3` or `mt-5` after a paragraph, `mt-8` or `mt-10` between blocks | 19, 20, 19, 12, 9 |
| Section body | `px-4 py-8 sm:px-7 sm:py-10 lg:px-10 lg:py-12` | Brand page sections |
| Card padding | `p-6 sm:p-8` | Coloured panels |
| Control padding | `px-2 py-2` inputs, `px-3 py-2` choice cards, `px-6 py-2.5` buttons | `field-classes.ts`, `button-styles.ts` |
| Grid gutter | `gap-[3px]` on a `bg-hs-ink` grid | Shared ink lines between panels |

Content widths: `max-w-xl` for forms, `max-w-3xl` for reading text, `max-w-4xl` for dialogs, `max-w-7xl` for a full page. Centre with `mx-auto` (31).

### Borders and radius

The 3 px ink border is the structural element: `border-[3px]` 61, `border-hs-ink` 105.

- Use `border-[3px] border-hs-ink` for cards, bars, controls and grids. `border-2` is for the small checkbox, micro buttons and the overlay close button. `border-[6px]` appears once.
- Lists divide with `divide-y-[3px] divide-hs-ink`.
- The only hairline is the legal footer: `border-t border-hs-ink/30`.
- Radius is almost absent: 17 radius classes in the whole landing. `rounded-sm` is for form controls, checkboxes and choice cards only. `rounded-full` is for the overlay close button, the floating "SCROLL" pill, spinners and blurred glow blobs. Do not round cards, panels or buttons.

### Depth

Depth comes from borders: 75 structural borders against 22 shadows, and 19 of those shadows are hard ink offsets.

| Shadow | Use | Evidence |
| --- | --- | --- |
| `shadow-[2px_2px_0_0_var(--color-hs-ink)]` | Choice cards, large checkbox, small selectable controls | 7 |
| `shadow-[6px_6px_0_0_var(--color-hs-ink)]` | Feature cards, badge frames | 5 |
| `shadow-[8px_8px_0_var(--color-hs-ink)]` | The single hero card on the confirmation and cancellation pages | 2 |
| `shadow-[1px_1px_0_var(--color-hs-ink)]` | Pressed state of a 2 px card | 1 |

Rules:

- A hard shadow always pairs with a 3 px ink border and a paper or cream fill.
- `shadow-lg` appears only on the two floating controls over the dark backdrop (overlay close button, "SCROLL" pill). Do not add blurred shadows elsewhere.
- No gradients on surfaces. The exceptions are fade masks (`mask-image`) on scrolling reels, the 1 px grid texture at 2.5 percent ink on the brand page, and the furrows on the share backdrop.

## Patterns

### Buttons

Source: `apps/web/src/components/ui/button-styles.ts`, used by `Button` and `ButtonLink` in `ui/button.tsx`.

Base: `inline-flex items-center justify-center border-[3px] font-bungee text-sm text-hs-ink transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:border-hs-navy disabled:cursor-not-allowed disabled:opacity-60`.

| Variant | Classes | When |
| --- | --- | --- |
| `gold` (default) | `border-hs-ink bg-hs-gold` | Primary action on paper |
| `goldInverse` | `border-hs-paper bg-hs-gold focus-visible:border-hs-gold` | Primary action on ink or navy |
| `teal` | `border-hs-ink bg-hs-teal/35` | Secondary action next to a gold one |

Sizes: `md` `px-6 py-2.5` (default), `lg` `px-6 py-3 sm:px-8`, `hero` `px-5 py-2.5`, `compact` fluid type for the home CTA, `micro` for mosaic tiles, `success` for dual-action rows.

- Always call `hsButtonClass`, `Button` or `ButtonLink`. Do not write button classes by hand.
- A quiet secondary action is a paper button: `border-[3px] border-hs-ink bg-hs-paper px-5 font-bungee text-xs tracking-wide` with `min-h-12`. See the brand page contact link.
- Hover darkens with `brightness-95`. Press scales to 0.96. Focus swaps the border to navy. Disabled drops to 60 percent opacity and stops the hover.
- Text links are `font-bold underline underline-offset-2`. On hover they turn `text-hs-orange` or `text-hs-red`.

### Panels and cards

A panel is a coloured rectangle in an ink grid.

- Grid of panels: `grid gap-[3px] bg-hs-ink` with `border-[3px] border-hs-ink` on the outside. Each child sets its own `bg-hs-*`. The gap paints the shared ink line.
- Card on paper: `border-[3px] border-hs-ink bg-hs-paper p-6 sm:p-8`. Add `shadow-[6px_6px_0_0_var(--color-hs-ink)]` when the card is the one thing on the page.
- Coloured panel text: white on red, teal and navy. Ink on gold, sand and paper.
- Dark surface: `bg-hs-ink text-hs-paper`, secondary text `text-hs-paper/65`. See the brand page footer.
- Home mosaic tiles use `P` from `ui/panel.tsx`, positioned with `vp()` on the 1440 by 900 artboard (`mosaic/artboard.ts`, `mosaic/cells.ts`).

### Forms

Source: `apps/web/src/components/form/`.

- Field: `FormField` renders label, optional hint and the control inside one `<label>`. Required fields show ` *` after the label. Labels are Bungee by default or sans extrabold with `labelVariant="sans"`.
- Control: `hsControlBaseClass` is `w-full rounded-sm border-[3px] border-hs-ink bg-hs-paper px-2 py-2 text-base text-hs-ink` plus `focus-visible:border-hs-navy`, a 150 ms `border-color` transition, `placeholder:text-hs-ink/42`, `selection:bg-hs-gold/50` and an autofill override that keeps the paper fill.
- Checkbox: `HackSpainCheckbox` in `pages/signup-page.tsx`. A hidden native input over a `rounded-sm border-hs-ink bg-hs-paper` box. Checked fills gold. Hover fills `sand/55`. Focus swaps the border to navy. The large size adds the 2 px hard shadow.
- Choice card: `rounded-sm border-[3px] border-hs-ink bg-hs-paper px-3 py-2 shadow-[2px_2px_0_0_var(--color-hs-ink)] hover:bg-hs-sand/40`.
- Form error: a bar, not red text. `border-b-[3px] border-hs-ink bg-hs-red/20 px-4 py-3 font-bold text-base text-hs-ink` with `role="alert"`.
- Attention on a field: the gold inset pulse `hs-signup-field-attention-overlay` (0.42 s, three times). Under reduced motion it becomes a static 4 px gold inset.
- Inputs are `text-base` (16 px) so iOS does not zoom.

### Overlays

Source: `apps/web/src/components/overlay/overlay-dialog.tsx`.

- Backdrop: `fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-hs-ink/97`, rendered in a portal outside the transformed mosaic.
- Content: `mx-auto px-3 pt-20 pb-10 sm:px-4 sm:py-16` in `max-w-3xl` or `max-w-4xl`.
- Close: a 48 px round button fixed top right, `border-2 border-hs-paper/30 bg-hs-ink text-hs-paper shadow-lg`.
- Behaviour: focus moves to the close button on open, Tab is trapped, Escape closes, focus returns to the opener. The body scroll lock lives in `overlay-lock.ts`.

### Navigation and bars

- Top bar: `border-b-[3px] border-hs-ink bg-hs-paper`, `min-h-[3.25rem]` or `min-h-16`. Sticky bars add `bg-hs-paper/95 backdrop-blur-md`.
- Back link: `font-sans text-sm font-extrabold` with a Phosphor `ArrowLeftBold` in `text-hs-orange`, hover `bg-hs-sand/60`.
- Index numbers are Bungee in red (`01`, `02`). Section headers on the brand page are a two-column grid: a gold number cell with a right ink line, then eyebrow and Bungee title on sand.
- Floating control over the mosaic: `rounded-full border border-hs-paper/20 bg-hs-ink px-5 py-2.5 font-bungee text-xs tracking-[0.18em] text-hs-paper shadow-lg`.
- Legal footer: hairline top border, `text-[10px] sm:text-[11px] text-hs-ink/80`, always the last in-flow item of the body.

### Icons and illustrations

- Astro pages use `phosphor-astro` in the Bold weight. Sizes are `h-4 w-4`, `h-5 w-5` and `h-6 w-6`.
- Social icons are inline SVG strings with `fill="currentColor"` in `theme/constants.ts`.
- Hand-drawn UI icons use `stroke-width="2.5"`, `stroke-linecap="square"` and `stroke-linejoin="miter"`. See the brand page download and copy icons.
- Illustrations are ink SVG drawings normalised by `svg/prepare-illustration-svg.ts`: stroke width 3, every dark hex replaced with `var(--color-hs-ink)`, `preserveAspectRatio="xMidYMid meet"`. The raster brand illustrations are 640 by 640 WebP with transparency. Their style is described in `apps/web/src/assets/illustration-prompts.md`: mid-century Quixote ink brushwork with a Picasso-inspired cubist colour treatment.

## Motion

Source: `theme/constants.ts`, `global.css`, `overlay-dialog.tsx`.

| Kind | Values |
| --- | --- |
| Colour, filter, border | 150 ms `ease-out`. `duration-150` 8, `ease-out` 8. |
| Hover | `brightness-95` on filled elements (12). `bg-hs-sand/40` to `/60` on flat rows. One `-translate-y-0.5` on the floating pill. |
| Press | `motion-safe:active:scale-[0.96]`, or the hard shadow collapses to 1 px with a 1 px translate. |
| Dialog enter | Backdrop fades in 0.2 s. Children stagger 0.08 s, each 0.34 s with `[0.22, 1, 0.36, 1]` and a 20 px rise. |
| Dialog exit | 0.16 s fade, children 0.12 s `easeOut` with a 6 px rise. |
| Section change | Spring, damping 30, stiffness 300 (`SPRING`). Slides vertically with `slideVariants`. |
| Ambient | Logo reel 14 s linear. Horse trot `steps(15)` at 0.625 s. Horse crossing 15 s with a hold off screen. |
| Attention | Gold inset pulse 0.42 s `ease-in-out`, three times. |

Rules:

- Every ambient animation stops under `prefers-reduced-motion`. `global.css` parks the horse and stops the reel. Motion components read `useReducedMotion()` and set offsets to 0.
- Do not animate layout. Animate `opacity`, `transform`, `filter` and colours only.
- Do not add scroll-triggered reveals. Sections change by a deliberate gesture.

## Accessibility

- Focus: `focus-visible:outline-2 focus-visible:outline-hs-navy focus-visible:outline-offset-2` on flat elements (14, 12, 11). On 3 px bordered controls, swap the border to navy instead and remove the outline. On dark surfaces use `outline-hs-gold` (3). `focus-visible:` appears 69 times against 4 plain `focus:`. Never set `outline-none` without a replacement.
- Hit areas: `min-h-11` (44 px) for links in bars, `h-12 w-12` for the close button, `min-h-12` for CTAs, `min-h-14` for index rows.
- Icon-only links carry `aria-label`. Decorative SVG carries `aria-hidden="true"`. Copy feedback uses a `sr-only` `aria-live="polite"` region.
- Dialogs set `role="dialog"`, `aria-modal="true"` and `aria-labelledby`.
- The document is `lang="es"` with `color-scheme: light`. There is no dark mode.
- Contrast: ink on paper passes. Avoid `text-hs-ink/40` for anything a person must read. White on gold fails; use ink on gold.

## Layout

- Mobile first. `sm:` (640 px) is the working breakpoint with 240 uses. `lg:` (1024 px) switches to two columns with 47 uses. `md:` (7) and `xl:` (5) are rare. Design at 390 px, then 640, then 1024.
- Home: a fixed 1440 by 900 artboard scaled to the viewport. `use-layout-profile.ts` switches to the compact artboard on small screens. Content cells live in `mosaic/cells.ts` and the background tiles in `mosaic/mosaic-background.tsx`. Bands never overlap in y.
- Other pages scroll. The body is a flex column, the page root is `flex-1 min-h-0` or `min-h-dvh`, and the legal footer is the last in-flow item. See the layout entry in `docs/learnings.md`.
- The whole page background is paper. Never white.

## Brand rules

From `apps/web/src/pages/brand.astro`. The downloadable kit is in `apps/web/public/brand-assets/`.

- The wordmark is the primary signature. Use the symbol only in compact formats or when the brand is already identified.
- Colour version on paper, black on white, white on navy. Pick the version with the most contrast.
- Safe area: one quarter of the symbol height on every side. Minimum digital size: 180 px wordmark, 48 px symbol. Below that, switch to the symbol.
- Never stretch, rotate, crop, recolour, or add shadows, glows, gradients or outlines to the logo.

## The dashboard (apps/app)

The dashboard shares the tokens through shadcn variables in `apps/app/src/app/globals.css`: background and card are paper, foreground, border and input are ink, primary is gold, secondary is teal, muted is sand, accent is slate, destructive is red, ring is navy. Radii are 0 for `sm`, `md` and `lg`, then 2 to 8 px for `xl` and above. It defines `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--duration-press: 140ms` and `--duration-enter: 240ms`.

The look is the same: `border-[3px]` 76, `font-bungee` 183, `bg-hs-paper` 162, `bg-white` 0. The dashboard has its own component layer (shadcn plus `tw-animate-css`). Use those components and the CSS variables. Do not paste landing class strings into the dashboard. `rounded-full` (27) is normal there for avatars.

## Checklist for new UI

- Only `hs-*` colours. No hex, no gray, no white background.
- Structure with `border-[3px] border-hs-ink` and `gap-[3px]` grids. No rounded cards.
- Bungee for short display text. DM Sans 600 to 900 for the rest. `text-pretty` on paragraphs.
- Shadows are hard ink offsets from the table above, or none.
- Buttons through `hsButtonClass`. Inputs through `hsControlBaseClass`.
- Hover darkens, press scales to 0.96, focus is navy. Transitions 150 ms ease-out.
- Hit areas at least 44 px. `aria-label` on icon-only controls.
- Ambient motion stops under reduced motion.
- New brand tokens go in all three token files at once. Visible copy changes go to `apps/web/src/data/llms.txt` too.
