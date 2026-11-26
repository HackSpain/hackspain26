import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const textareaVariants = cva(
  "flex min-h-24 w-full max-w-full resize-y border-2 border-hs-ink/25 bg-hs-paper px-3 py-2 text-base leading-relaxed text-hs-ink outline-none placeholder:text-hs-ink/40 motion-safe:transition-surface motion-safe:duration-press motion-safe:ease-out focus-visible:border-hs-navy focus-visible:ring-2 focus-visible:ring-hs-navy/25 disabled:cursor-not-allowed disabled:opacity-50",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "",
        mono: "font-mono text-sm",
        plain:
          "min-h-0 border-0 px-0 py-1.5 focus-visible:border-transparent focus-visible:ring-0",
      },
    },
  }
);

function Textarea({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"textarea"> & VariantProps<typeof textareaVariants>) {
  return (
    <textarea
      data-slot="textarea"
      data-variant={variant}
      className={cn(textareaVariants({ className, variant }))}
      {...props}
    />
  );
}

export { Textarea };
