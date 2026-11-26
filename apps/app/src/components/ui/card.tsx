import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva("flex flex-col text-sm text-hs-ink", {
  defaultVariants: {
    size: "default",
    tone: "ink",
  },
  variants: {
    size: {
      default: "gap-4 py-4",
      compact: "gap-3 py-3",
      flush: "gap-0 py-0",
      loose: "gap-5 py-5",
    },
    tone: {
      ink: "border-3 border-hs-ink bg-hs-paper",
      muted: "border border-hs-ink/15 bg-hs-paper",
      teal: "border-3 border-hs-teal bg-hs-teal/5",
      gold: "border-3 border-hs-gold bg-hs-gold/15",
      red: "border-3 border-hs-red bg-hs-red/10",
      solid: "border-3 border-hs-ink bg-hs-gold",
    },
  },
});

function Card({
  className,
  size = "default",
  tone = "ink",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-tone={tone}
      className={cn(cardVariants({ className, size, tone }))}
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
      className={cn("text-sm font-medium text-hs-brown", className)}
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
}: React.ComponentProps<"div"> & { tone?: "ink" | "navy" | "teal" }) {
  return (
    <div
      data-slot="frame"
      className={cn(
        "border-3 p-3 text-sm",
        tone === "ink" && "border-hs-ink bg-hs-paper",
        tone === "navy" && "border-hs-navy bg-hs-slate/25",
        tone === "teal" && "border-hs-teal bg-hs-teal/10",
        className
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, Frame };
