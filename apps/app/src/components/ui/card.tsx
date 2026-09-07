import * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-4 border-[3px] border-hs-ink bg-hs-paper py-4 text-sm text-hs-ink",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("grid gap-1 px-4", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-bungee text-base leading-snug", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-hs-brown", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-4", className)}
      {...props}
    />
  );
}

function Frame({
  className,
  tone = "ink",
  ...props
}: React.ComponentProps<"div"> & { tone?: "ink" | "navy" }) {
  return (
    <div
      data-slot="frame"
      className={cn(
        "border-[3px] p-3 text-sm",
        tone === "ink" && "border-hs-ink bg-hs-paper",
        tone === "navy" && "border-hs-navy bg-hs-slate/25",
        className
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, Frame };
