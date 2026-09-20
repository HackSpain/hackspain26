"use client";

import { Face } from "@/components/tv/market";
import { figure, percent } from "@/lib/closing-summary";
import type { Burner } from "@/lib/closing-summary";
import { cn } from "@/lib/utils";

const leadFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const BURNER_CALL = "No sabemos quién es. Si lo tienes al lado, que suba al escenario.";

/** The comparisons that turn one absurd number into a punchline; each drops out when it has no data. */
export function burnerFacts(burner: Burner): { value: string; label: string }[] {
  return [
    { label: "de todos los tokens del finde", value: percent(burner.share) },
    ...(burner.lead > 1 ? [{ label: "lo que quemó la segunda persona", value: `${leadFormat.format(burner.lead)}x` }] : []),
    ...(burner.teamsOutburned > 1 ? [{ label: "equipos enteros, sumados, quemaron menos", value: figure(burner.teamsOutburned) }] : []),
    ...(burner.pushes > 0 ? [{ label: `tokens por push (hizo ${figure(burner.pushes)})`, value: figure(burner.tokens / burner.pushes) }] : []),
  ];
}

/** The photo with its stickers. Everything is in em, so the wrapper's font size scales the lot. */
export function Mugshot({ burner, className }: { burner: Burner; className?: string }) {
  const sticker = "hsx-title absolute border-[length:calc(var(--line)*0.5)] border-hs-ink leading-none";
  return (
    <div className={cn("relative aspect-square shrink-0", className)}>
      <Face name={burner.name} src={burner.photoUrl} mark="?" className="size-full text-[3em]" />
      <span className={cn(sticker, "-top-[0.5em] -right-[0.7em] rotate-12 bg-hs-red px-[0.45em] py-[0.3em] text-hs-paper")}>WTF</span>
      <span className={cn(sticker, "bottom-[0.6em] -left-[0.6em] -rotate-12 bg-hs-gold px-[0.4em] py-[0.2em] text-[1.3em]")}>?</span>
      <span className={cn(sticker, "-right-[0.5em] bottom-[1.6em] rotate-6 bg-hs-teal px-[0.35em] py-[0.15em] text-[0.9em] text-hs-paper")}>??</span>
    </div>
  );
}

/** The special mention, sized for one rotating box of the panel. */
export function BurnerView({ burner }: { burner: Burner }) {
  const facts = burnerFacts(burner);
  return (
    <div className="flex h-full flex-col gap-[calc(var(--u)*0.9)]">
      <div className="flex items-center gap-[calc(var(--u)*1.6)] pt-[calc(var(--u)*0.5)] pr-[calc(var(--u)*0.8)] pl-[calc(var(--u)*0.6)]">
        <Mugshot burner={burner} className="w-[34%] text-[calc(var(--u)*1.1)]" />
        <div className="min-w-0">
          <p className="hsx-label text-hs-red">Máximo quemador de tokens</p>
          <p className="hsx-title mt-[calc(var(--u)*0.4)] line-clamp-2 text-[calc(var(--u)*1.9)] break-words">{burner.name}</p>
          {burner.team ? <p className="hsx-sm mt-[calc(var(--u)*0.3)] truncate font-semibold text-hs-brown">Equipo {burner.team}</p> : null}
        </div>
      </div>
      <p className="flex items-baseline gap-[calc(var(--u)*0.8)]">
        <span className="hsx-title hsx-num text-[calc(var(--u)*3.8)] whitespace-nowrap">{figure(burner.tokens)}</span>
        <span className="hsx-md font-bold">tokens. Una sola persona.</span>
      </p>
      <ul className="grid min-h-0 flex-1" style={{ gridTemplateRows: `repeat(${facts.length}, minmax(0, 1fr))` }}>
        {facts.map((fact) => (
          <li key={fact.label} className="flex min-w-0 items-center gap-[calc(var(--u)*1)] border-t-[length:calc(var(--line)*0.5)] border-hs-ink/20">
            <span className="hsx-title hsx-num hsx-lg w-[32%] shrink-0 whitespace-nowrap">{fact.value}</span>
            <span className="hsx-sm leading-tight font-semibold">{fact.label}</span>
          </li>
        ))}
      </ul>
      <p className="hsx-sm bg-hs-ink px-[calc(var(--u)*0.8)] py-[calc(var(--u)*0.55)] leading-tight font-bold text-hs-paper">{BURNER_CALL}</p>
    </div>
  );
}
