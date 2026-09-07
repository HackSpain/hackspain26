const hsButtonBase =
  "inline-flex items-center justify-center border-[3px] font-bungee text-sm text-hs-ink transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:border-hs-navy disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100";

const hsButtonVariants = {
  gold: "border-hs-ink bg-hs-gold",
  goldInverse: "border-hs-paper bg-hs-gold focus-visible:border-hs-gold",
  teal: "border-hs-ink bg-hs-teal/35",
} as const;

const hsButtonSizes = {
  /** Home hero signup CTA — responsive type scale */
  compact:
    "px-4 py-2 text-[clamp(0.75rem,2.4vw,1rem)] tracking-wide focus-visible:border-hs-navy",
  hero: "px-5 py-2.5",
  lg: "px-6 py-3 sm:px-8",
  md: "px-6 py-2.5",
  /** Mosaic tiles and other very tight layouts */
  micro:
    "!border-2 px-2 py-0.5 !text-[clamp(0.55rem,1.45vw,0.72rem)] tracking-wide focus-visible:!border-hs-navy",
  /** Success / dual-action rows */
  success: "min-w-32 flex-1 px-5 py-2.5 sm:flex-initial",
} as const;

export type HsButtonVariant = keyof typeof hsButtonVariants;
export type HsButtonSize = keyof typeof hsButtonSizes;

export function hsButtonClass(
  variant: HsButtonVariant = "gold",
  size: HsButtonSize = "md",
  className?: string
): string {
  return [
    hsButtonBase,
    hsButtonVariants[variant],
    hsButtonSizes[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}
