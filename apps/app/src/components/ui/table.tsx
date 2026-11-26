"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function Table({
  className,
  containerClassName,
  containerRef,
  ...props
}: React.ComponentProps<"table"> & {
  containerClassName?: string;
  containerRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-auto border-3 border-hs-ink bg-hs-paper",
        containerClassName
      )}
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom border-spacing-0 text-sm",
          className
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "bg-hs-sand [&_th]:border-b-3 [&_th]:border-hs-ink [&_th]:bg-hs-sand [&_tr]:border-b-3 [&_tr]:border-hs-ink",
        className
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-hs-ink/20 motion-safe:transition-colors motion-safe:duration-100 data-[state=selected]:bg-hs-sand data-[tone=alert]:[&_td]:bg-hs-red/5 data-[tone=highlight]:bg-hs-gold/10 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hs-sand/60 [&_td]:border-b [&_td]:border-hs-ink/20",
        className
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 px-3 text-left align-middle font-bungee text-xs uppercase text-hs-ink whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-3 py-2.5 align-middle whitespace-nowrap", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };
