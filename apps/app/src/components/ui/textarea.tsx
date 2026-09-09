import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full max-w-full resize-y border-2 border-hs-ink/25 bg-hs-paper px-3 py-2 text-base text-hs-ink outline-none placeholder:text-hs-ink/40 motion-safe:transition-[border-color] motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] focus-visible:border-hs-navy focus-visible:ring-2 focus-visible:ring-hs-navy/25 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
