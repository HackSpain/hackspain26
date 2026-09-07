import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 border-[3px] border-hs-ink bg-hs-paper px-3 py-2 text-base text-hs-ink outline-none placeholder:text-hs-ink/40 motion-safe:transition-[border-color] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] focus-visible:border-hs-navy disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };
