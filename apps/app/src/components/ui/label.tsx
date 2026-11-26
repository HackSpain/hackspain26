"use client";

import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Label({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & {
  size?: "default" | "xs";
}) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      data-size={size}
      className={cn(
        "flex items-center gap-2 font-bungee text-sm tracking-wide text-hs-ink select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 data-[size=xs]:text-xs data-[size=xs]:tracking-label",
        className
      )}
      {...props}
    />
  );
}

export { Label };
