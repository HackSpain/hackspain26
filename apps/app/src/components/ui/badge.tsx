import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1 whitespace-nowrap border border-hs-ink/15 px-2 py-0.5 font-bungee text-xs uppercase tabular-nums",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "bg-hs-sand text-hs-ink",
        gold: "bg-hs-gold text-hs-ink",
        paper: "bg-hs-paper text-hs-ink",
        destructive: "border-hs-red bg-hs-red/10 text-hs-red",
        inverse: "border-hs-red bg-hs-red text-hs-paper",
      },
    },
  }
);

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge };
