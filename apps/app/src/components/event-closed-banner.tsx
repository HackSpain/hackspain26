"use client";

import { CalendarClock } from "lucide-react";
import type { EventPhase } from "@convex/lib/eventWindow";
import { formatEventDate } from "@/lib/utils";

export type EventInfo = {
  endsAt?: number;
  open: boolean;
  phase: EventPhase;
  startsAt?: number;
};

/**
 * `users.me` always returns `event` on current Convex. Older payloads omit
 * it; treat that like an unscheduled window (open).
 */
export function isEventOpen(event: EventInfo | null | undefined): boolean {
  return event?.open ?? true;
}

/** One line explaining why the dashboard is reduced. Mirrors convex/lib/eventWindow.ts. */
export function eventClosedCopy(event: EventInfo): { title: string; body: string } {
  if (event.phase === "before" && event.startsAt !== undefined) {
    return {
      body: "Hasta entonces solo puedes editar tu perfil y ver el directorio de participantes.",
      title: `La hackathon empieza el ${formatEventDate(event.startsAt)}`,
    };
  }
  if (event.phase === "after" && event.endsAt !== undefined) {
    return {
      body: "Gracias por participar. Tu perfil y el directorio siguen abiertos.",
      title: `La hackathon terminó el ${formatEventDate(event.endsAt)}`,
    };
  }
  return {
    body: "Solo puedes editar tu perfil y ver el directorio de participantes.",
    title: "La hackathon no está en marcha",
  };
}

/** Full-width strip under the header, shown on every page while closed. */
export function EventClosedBanner({ event }: { event: EventInfo }) {
  const copy = eventClosedCopy(event);
  return (
    <div className="border-b-[3px] border-hs-ink bg-hs-sand text-hs-ink">
      <div className="mx-auto flex w-full max-w-6xl items-start gap-3 px-4 py-3">
        <CalendarClock className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="font-bungee text-sm leading-tight">{copy.title}</p>
          <p className="text-sm">{copy.body}</p>
        </div>
      </div>
    </div>
  );
}

/** Replaces the feed on the home page while closed. */
export function EventClosedNotice({ event }: { event: EventInfo }) {
  const copy = eventClosedCopy(event);
  return (
    <div className="border border-hs-ink/30 bg-hs-sand p-4">
      <p className="font-bungee text-sm leading-tight">{copy.title}</p>
      <p className="mt-1 text-sm text-hs-brown">{copy.body}</p>
    </div>
  );
}
