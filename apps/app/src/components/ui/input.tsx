import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "h-11 w-full min-w-0 border-2 border-hs-ink/25 bg-hs-paper px-3 py-2 text-hs-ink tabular-nums outline-none placeholder:text-hs-ink/40 motion-safe:transition-surface motion-safe:duration-press motion-safe:ease-out focus-visible:border-hs-navy focus-visible:ring-2 focus-visible:ring-hs-navy/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-hs-red aria-invalid:focus-visible:border-hs-red aria-invalid:focus-visible:ring-hs-red/25",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "text-base",
        sm: "text-sm",
        icon: "py-2 pr-10 pl-3 text-base",
        search: "py-2 pr-3 pl-9 text-sm",
      },
      variant: {
        default: "",
        mono: "font-mono text-sm",
        hero: "font-bungee text-4xl tracking-otp uppercase sm:text-5xl",
        quiet:
          "bg-hs-sand/60 focus-visible:border-hs-ink/25 focus-visible:ring-0",
      },
    },
  }
);

function Input({
  className,
  type,
  size = "default",
  variant = "default",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> &
  VariantProps<typeof inputVariants>) {
  return (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      data-variant={variant}
      className={cn(inputVariants({ className, size, variant }))}
      {...props}
    />
  );
}

export { Input };
