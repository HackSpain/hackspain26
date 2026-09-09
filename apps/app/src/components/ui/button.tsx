import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center border-[3px] font-bungee whitespace-nowrap outline-none select-none touch-manipulation disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 motion-safe:transition-[transform,filter] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:not-disabled:scale-[0.97] hs-hover-bright",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "min-h-11 gap-2 px-5 text-sm",
        icon: "size-11",
        sm: "min-h-11 gap-1.5 px-3 text-xs",
      },
      variant: {
        default: "border-hs-ink bg-hs-gold text-hs-ink",
        outline: "border-2 border-hs-ink/25 bg-transparent text-hs-ink focus-visible:ring-2 focus-visible:ring-hs-navy",
        teal: "border-hs-ink bg-hs-teal/40 text-hs-ink",
      },
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ className, size, variant }))}
      {...props}
    />
  );
}

export { Button };
