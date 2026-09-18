# TV sponsor wordmarks

SVG exports from the [HackSpain sponsor artwork](https://www.figma.com/design/c5XdqRGECv3xugeYqbMZtM/Hackspain?node-id=133-743), downloaded on 2026-09-18.

These are the same 16 sponsors, in the same order, as `resolveTvSponsors()` in `src/lib/tv.ts`. The TV sponsor screen uses these standalone vectors instead of its original mixed SVG/PNG assets. Other screens retain their existing artwork.

Only monochrome paint was adjusted: Helmcode's near-black fill is black and Tinybird's two translucent paths are opaque black. Vector geometry is unchanged. White fills inside SVG clipping definitions are intentional; they are not visible logo paint.

The screen's shared black rules are 8 px at 1920 × 1080. HackSpain's wordmark is 128 px tall at that resolution. The cream, blue/teal, red and yellow match the Figma reference.

fal.ai and Exa render at 75% of the standard logo scale, preserving their aspect ratios. At Full HD their visible heights are approximately 78 px (previously 104 px), close to Cursor, Cognition, Embat and THEKER. The other logos retain their original scale.
