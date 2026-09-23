# HackSpain design guidelines

These guidelines describe the visual system of hackspain.com. They cover colour, typography, spacing, borders, depth, components, motion, accessibility and the brand. Use them for anything that carries the HackSpain name: web pages, dashboards, decks, printed material. Last updated 2026-09-23.

## Direction

HackSpain looks like a paper mosaic. Flat paper tiles sit next to each other, separated by thick ink lines. Bungee gives the headlines their voice. DM Sans carries the text in heavy weights. Shadows are hard ink offsets, never blurs. The motifs come from La Mancha (a windmill, a horse, Don Quixote) and are drawn as ink brush illustrations with a cubist colour treatment.

Four rules follow from that:

- Ink lines make the structure. Do not use shadows, gradients or rounded corners to separate content.
- Use solid colour blocks, not tints. A panel is gold, teal, red or orange edge to edge.
- Type carries the personality. Bungee for short display text, DM Sans in bold weights for everything else.
- Everything is flat and warm. There is no gray, no white page background and no dark mode.

## Colour

| Token | Hex | Role |
| --- | --- | --- |
| Paper | `#F4ECD8` | Page and card background. The only base surface. |
| Ink | `#2A170F` | Text, borders, hard shadows and the dark surface. |
| Gold | `#EAB619` | Primary action, highlight panel, focus ring on dark surfaces. |
| Sand | `#E8DCC4` | Secondary surface. At 40 to 60 percent, the hover fill. |
| Orange | `#D96B2A` | Accent panel, icon accent, link hover. |
| Red | `#CC291F` | Accent panel, warnings, "no" marks. At 20 percent, the error tint. |
| Teal | `#35858A` | Accent panel, "yes" panel. At 35 percent, a soft button fill. |
| Navy | `#1E3958` | Focus colour. Also a dark background for the white logo. |
| Brown | `#4A2C1F` | Hint text under form labels. |
| Slate | `#8FB8D1` | Rare mosaic accent. |

In CSS the tokens are custom properties named `--color-hs-paper`, `--color-hs-ink`, `--color-hs-gold` and so on. Use the tokens, not the hex values.

Rules:

- Text is ink on paper, sand and gold. Text is white on red, teal, navy and ink.
- Secondary text is ink at 65 percent. Tertiary text is ink at 40 to 55 percent. On dark surfaces, use paper at 60 to 70 percent.
- The logo colours `#CA0005` (red) and `#F29100` (orange) belong to the logo files only. Do not use them in interfaces. Use the red and orange tokens above.
- Do not add colours. Do not use gray. Do not use a white background for a page or a control; use paper.
- Gradients are not part of the system. The only soft transitions are fade masks on scrolling content and faint paper textures (a 1 px grid at 2.5 percent ink, or ploughed furrows at 12 percent ink).

## Typography

Two typefaces, loaded from Google Fonts:

- **Bungee** (one weight). Display type: headlines, figures, short calls to action, labels on buttons and index numbers.
- **DM Sans** (variable, weights 100 to 900, optical sizes 9 to 40). Everything else.

| Role | Face | Size | Weight | Line height | Tracking | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Display | Bungee | fluid, `clamp(2rem, 9vw, 3.4rem)` | 400 | 0.98 to 1.08 | 0 to -0.03em | Balance the line breaks. |
| Section title | Bungee | 20 px, 24 px from 640 px | 400 | 1.25 | 0 | Up to 30 px on a page hero. |
| Eyebrow label | DM Sans | 10.4 px (0.65rem) | 900 | 1.2 | 0.16em | Uppercase, ink at 55 percent. |
| Body | DM Sans | 16 px | 700 | 1.625 | 0 | Lead paragraphs 18 px. Pretty line breaks. |
| Interface text | DM Sans | 14 px | 600 | 1.375 | 0 | The most common size. |
| Hint | DM Sans | 14 px, 15.2 px from 640 px | 400 to 600 | 1.375 | 0 | Brown. |
| Field label | Bungee | 14 px | 400 | 1.375 | 0.025em | Or DM Sans 800 at 14 to 16 px. |
| Button | Bungee | 14 px | 400 | 1 | 0.025em | Ink on gold. |
| Numbers | DM Sans | any | 700 to 900 | any | 0 | Tabular figures for counters. |

Rules:

- DM Sans weights are 600 to 900. Never use 500 or lighter.
- Use Bungee sparingly: headlines, figures and short calls. Use DM Sans for paragraphs, navigation and data. Bungee is uppercase by design, so never set it in long sentences.
- Paragraphs get `text-wrap: pretty`. Headlines get `text-wrap: balance`.
- Inside mosaic tiles the type scales with the tile (container query units), so a tile stays legible at any size.
- Display sizes are fluid. Prefer `clamp()` over breakpoint jumps.

## Spacing

The base unit is 4 px. The scale in use is 6, 8, 12, 16, 20, 24, 32, 40 and 48 px.

| Use | Value |
| --- | --- |
| Horizontal padding of a bar or a row | 16 px, 24 px on wide layouts |
| Vertical padding of a bar or a row | 12 px; 8 to 10 px for controls |
| Gaps inside a component | 8 or 12 px; 6 px in tight rows; 16 px between cards |
| Vertical rhythm | 8 px between related lines, 12 to 20 px after a paragraph, 32 to 40 px between blocks |
| Section body | 16 px by 32 px on phones, 28 by 40 px from 640 px, 40 by 48 px from 1024 px |
| Card or panel padding | 24 px, 32 px from 640 px |
| Control padding | 8 px in inputs, 8 by 12 px in choice cards, 10 by 24 px in buttons |
| Ink gutter between panels | 3 px |

Content widths: 576 px for forms, 768 px for reading text, 896 px for dialogs, 1280 px for a full page. Centre the container.

## Borders and radius

The 3 px ink border is the structural element of the system.

- Cards, bars, controls and grids get `3px solid` ink. Use 2 px only for very small elements: the 16 px checkbox, micro buttons and the dialog close button.
- Panels in a grid share their lines: paint the grid background ink, leave a 3 px gap, and give each panel its own fill. Put a 3 px ink border around the whole grid.
- Lists divide with 3 px ink rules. The only hairline in the system is the legal footer, a 1 px rule in ink at 30 percent.
- Corners are square. The exceptions are 4 px on form controls (inputs, checkboxes, choice cards) and full circles for the dialog close button, floating pills, spinners and avatars. Never round a card, a panel or a button.

## Depth

Depth comes from borders and hard shadows, never from blur.

| Shadow | Use |
| --- | --- |
| `2px 2px 0 0` ink | Choice cards, large checkboxes, small selectable controls |
| `6px 6px 0 0` ink | Feature cards and badge frames |
| `8px 8px 0 0` ink | The single hero card on a page |
| `1px 1px 0 0` ink | Pressed state of a 2 px card |

Rules:

- A hard shadow always pairs with a 3 px ink border and a paper fill.
- A blurred shadow is allowed only on a floating control over the dark dialog backdrop.
- Do not layer shadows, and do not use shadows to show hover. Hover darkens the fill instead.

## Components

### Buttons

- Shape: inline flex, 3 px ink border, square corners, Bungee 14 px with 0.025em tracking, ink text.
- Sizes: default 10 px by 24 px padding; large 12 px by 24 px, 32 px horizontal from 640 px; compact 8 px by 16 px with fluid type for hero tiles; micro 2 px by 8 px with a 2 px border inside mosaic tiles.
- Primary: gold fill. On ink or navy, keep the gold fill and switch the border to paper.
- Secondary: paper fill with the ink border, or teal at 35 percent next to a gold button.
- States: hover darkens the fill to 95 percent brightness. Press scales to 0.96. Focus swaps the border to navy. Disabled drops to 60 percent opacity and stops the hover.
- Minimum height 48 px for a call to action, 44 px for a link in a bar.
- Text links are bold, underlined with a 2 px offset, and turn orange or red on hover.

### Panels and cards

- A panel is a coloured rectangle in an ink grid. Text is white on red, teal and navy, and ink on gold, sand and paper.
- A card on paper has a 3 px ink border and 24 px padding (32 px from 640 px). Add the 6 px hard shadow when the card is the one thing on the page.
- The dark surface is ink with paper text. Secondary text on it is paper at 65 percent.
- A section header is a two-column strip on sand: a gold cell with the index number in Bungee red, a 3 px ink line, then the eyebrow and the title.

### Forms

- A field stacks label, optional hint and control with 4 px gaps. Required fields show ` *` after the label.
- Inputs: full width, 4 px corners, 3 px ink border, paper fill, 8 px padding, 16 px text so phones do not zoom. Placeholder is ink at 42 percent. Selection is gold at 50 percent. Autofill keeps the paper fill. Focus swaps the border to navy over 150 ms.
- Checkboxes: a paper square with an ink border, 16 px with a 2 px border or 24 px with a 3 px border and the 2 px hard shadow. Checked fills gold with an ink check mark. Hover fills sand at 55 percent. Focus swaps the border to navy.
- Choice cards: a selectable label with a 3 px ink border, 4 px corners, paper fill, 8 px by 12 px padding and the 2 px hard shadow. Hover fills sand at 40 percent.
- Form errors are a bar, not red text: red at 20 percent, ink text in bold 16 px, 12 px by 16 px padding, a 3 px ink rule below. Announce it as an alert.
- To draw attention to one field, pulse a gold inset ring from 2 px to 5 px with a soft gold glow, 420 ms ease-in-out, three times. With reduced motion, show a static 4 px gold inset instead.

### Dialogs

- Backdrop: ink at 97 percent, full screen, scrollable. Content is centred in 768 or 896 px with 12 px side padding, 80 px top and 40 px bottom on phones, 16 px and 64 px from 640 px.
- Close button: a 48 px circle fixed top right, ink fill, paper icon, 2 px border in paper at 30 percent. This is the one place a blurred shadow is allowed.
- Focus moves to the close button on open, Tab stays inside, Escape closes, and focus returns to the opener. Lock the page scroll while it is open.

### Navigation and bars

- Top bar: paper fill, 3 px ink rule below, 52 to 64 px tall. A sticky bar uses paper at 95 percent with a 12 px backdrop blur.
- Back link: DM Sans 800 at 14 px with a bold arrow icon in orange. Hover fills sand at 60 percent.
- Index numbers (`01`, `02`) are Bungee in red.
- A floating pill over the mosaic is a full-radius ink capsule with a 1 px border in paper at 20 percent, 10 px by 20 px padding and Bungee 12 px with 0.18em tracking in paper.
- Legal footer: a 1 px rule in ink at 30 percent, centred DM Sans at 10 to 11 px in ink at 80 percent. It is always the last element of the page.

### Icons and illustrations

- Icons are bold line icons at 16, 20 or 24 px, drawn in the current text colour. Hand-drawn icons use a 2.5 px stroke with square caps and mitre joins.
- Illustrations are ink brush drawings in the spirit of mid-century Don Quixote editions: confident irregular lines, expressive silhouettes, lively asymmetry. Strokes are 3 px in ink. The coloured versions use a Picasso-inspired cubist treatment in the brand palette.
- Decorative images carry no alternative text. Meaningful images describe what they show.

## Motion

| Kind | Values |
| --- | --- |
| Colour, filter and border changes | 150 ms, ease-out |
| Hover | Brightness to 95 percent on filled elements. Sand at 40 to 60 percent on flat rows. |
| Press | Scale to 0.96, or the hard shadow collapses to 1 px with a 1 px translate. |
| Dialog enter | Backdrop fades in over 200 ms. Children rise 20 px and fade in over 340 ms with `cubic-bezier(0.22, 1, 0.36, 1)`, staggered 80 ms. |
| Dialog exit | 160 ms fade. Children rise 6 px and fade over 120 ms. |
| Section change on the home page | A spring with damping 30 and stiffness 300, sliding vertically. |
| Ambient | Logo reel 14 s linear. Horse gait at 24 frames per second in 15 steps, crossing the plain in 15 s with a pause off screen. |
| Attention | Gold inset pulse, 420 ms ease-in-out, three times. |

Rules:

- Every ambient animation stops under `prefers-reduced-motion`. The horse parks mid plain, the reel stops, rises become plain fades.
- Animate opacity, transform, filter and colour only. Never animate layout.
- No scroll-triggered reveals and no parallax. Sections change by a deliberate gesture.

## Accessibility

- Focus is always visible. On flat elements: a 2 px navy outline with a 2 px offset. On 3 px bordered controls: swap the border to navy. On dark surfaces: a gold outline. Never remove the outline without one of these replacements.
- Hit areas are at least 44 px tall. Calls to action are 48 px. Index rows are 56 px.
- Icon-only controls carry an accessible name. Decorative graphics are hidden from assistive technology. Status changes such as "copied" are announced through a polite live region.
- Dialogs are modal, labelled by their title, trap focus and close on Escape.
- The language is Spanish and the colour scheme is light. There is no dark mode.
- Contrast: ink on paper, sand and gold passes. White on red, teal, navy and ink passes. White on gold and ink at 40 percent on paper fail; do not use them for text a person must read.

## Layout

- Mobile first. The working breakpoint is 640 px. Two-column layouts start at 1024 px. Design at 390 px first, then 640, then 1024.
- The home page is a fixed 1440 by 900 artboard scaled to the viewport, with a compact artboard for phones. Tiles sit in horizontal bands that never overlap.
- Every other page scrolls. The page fills at least the viewport height, the content grows, and the legal footer is the last element in the flow.
- The page background is always paper.

## Brand

The official brand kit (wordmark, symbol, colour, black and white versions in SVG and PNG) is at https://hackspain.com/brand.

- The wordmark is the primary signature. Use the symbol only in compact formats or when the brand is already identified.
- Use the colour version on paper, the black version on white and the white version on navy. Pick the version with the most contrast on the background.
- Keep a safe area of one quarter of the symbol height on every side.
- Minimum digital size: 180 px wide for the wordmark, 48 px for the symbol. Below that, switch to the symbol instead of shrinking the wordmark.
- Never stretch, compress, rotate or crop the logo. Never recolour parts of it. Never add shadows, glows, gradients or outlines.
- Do not place the logo on backgrounds that make it hard to read, and do not imply a partnership that does not exist.

## Applying the system to other HackSpain products

The participant dashboard uses the same tokens: paper background and cards, ink text and borders, gold primary, teal secondary, sand muted, slate accent, red destructive, navy focus ring. Corners are square by default. Its motion uses `cubic-bezier(0.23, 1, 0.32, 1)`, 140 ms for presses and 240 ms for enters. Avatars are the one place where circles are normal.

For a new surface, start from this checklist:

- Only the ten colours above. No hex outside them, no gray, no white background.
- Structure with 3 px ink borders and 3 px ink gutters. No rounded cards.
- Bungee for short display text. DM Sans 600 to 900 for the rest.
- Shadows are hard ink offsets from the table above, or none.
- Hover darkens, press scales to 0.96, focus is navy. Transitions run 150 ms ease-out.
- Hit areas of at least 44 px. Names on icon-only controls.
- Ambient motion stops under reduced motion.
