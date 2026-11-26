"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { cn, formatEventDate } from "@/lib/utils";

export function EditionLabel({ className }: { className?: string }) {
  const edition = useQuery(api.editions.currentLabel);
  return (
    <p className={cn("font-bungee text-xs text-hs-brown", className)}>
      {edition?.label ?? "HackSpain"}
    </p>
  );
}

export function EditionDates({ className }: { className?: string }) {
  const edition = useQuery(api.editions.currentLabel);
  const starts = edition?.eventStartsAt
    ? formatEventDate(edition.eventStartsAt)
    : null;
  const ends = edition?.eventEndsAt
    ? formatEventDate(edition.eventEndsAt)
    : null;
  const copy =
    starts && ends ? `${starts} · ${ends}` : (edition?.label ?? "HackSpain");
  return (
    <p
      className={cn(
        "font-bungee text-xs tracking-wide text-hs-brown",
        className
      )}
    >
      {copy}
    </p>
  );
}
