import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center border-3 font-bungee whitespace-nowrap outline-none select-none touch-manipulation disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 motion-safe:transition-press motion-safe:duration-press motion-safe:ease-out motion-safe:active:not-disabled:scale-[0.97] hs-hover-bright focus-visible:ring-2 focus-visible:ring-hs-navy focus-visible:ring-offset-2 focus-visible:ring-offset-hs-sand",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "min-h-11 gap-2 px-5 text-sm",
        icon: "size-11 p-0",
        sm: "min-h-11 gap-1.5 px-3 text-xs",
      },
      variant: {
        default: "border-hs-ink bg-hs-gold text-hs-ink",
        outline:
          "border-2 border-hs-ink/25 bg-transparent text-hs-ink focus-visible:ring-2 focus-visible:ring-hs-navy data-open:bg-hs-sand",
        teal: "border-hs-ink bg-hs-teal/40 text-hs-ink",
        paper: "border-hs-ink bg-hs-paper text-hs-ink",
        destructive: "border-hs-ink bg-hs-red text-hs-paper",
        danger: "border-hs-ink bg-transparent text-hs-red",
        ghost: "border-0 bg-transparent p-0 text-hs-ink",
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
