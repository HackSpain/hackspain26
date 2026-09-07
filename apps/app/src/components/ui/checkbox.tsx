"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative mt-0.5 flex size-5 shrink-0 items-center justify-center border-[3px] border-hs-ink bg-hs-paper outline-none motion-safe:transition-[background-color,border-color] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] after:absolute after:-inset-3 focus-visible:border-hs-navy disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-hs-ink data-checked:bg-hs-gold",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-hs-ink [&>svg]:size-3.5"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
