"use client";

import type { FunctionReturnType } from "convex/server";
import { ArrowUpRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { answerFor } from "@/lib/perks";
import { claimStatusLabel, cn, joinDotLabel, perkName, perkTypeLabel } from "@/lib/utils";

type CatalogEntry = FunctionReturnType<typeof api.perks.listCatalog>[number];

export type PerkCardPerk = CatalogEntry["perk"];
export type PerkCardClaim = CatalogEntry["claim"];

export function PerkCard({
  perk,
  claim,
  onClaim,
}: {
  perk: PerkCardPerk;
  claim: PerkCardClaim;
  onClaim: () => void;
}) {
  const company = perk.company.trim();
  const headline = company || perkName(perk.company, perk.title);
  const offer = joinDotLabel(company ? perk.title : null, perk.value);
  const description = perk.description.trim();
  const answered = claim
    ? perk.inputs
        .map((input) => ({ label: input.label, value: answerFor(claim.answers, input.key) }))
        .filter((entry) => entry.value.length > 0)
    : [];

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-1 flex-col gap-1.5 px-4 pt-4 pb-5">
        <h3 className="font-bungee text-xl leading-none text-balance">
          {perk.sponsorUrl ? (
            <a
              href={perk.sponsorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-baseline gap-1 underline decoration-hs-ink/30 decoration-[3px] underline-offset-4 outline-none hover:decoration-hs-ink focus-visible:decoration-hs-navy"
            >
              {headline}
              <ArrowUpRightIcon className="size-4 shrink-0 self-center" strokeWidth={2.5} aria-hidden />
              <span className="sr-only"> (abre la web del sponsor)</span>
            </a>
          ) : (
            headline
          )}
        </h3>
        {offer ? <p className="text-base leading-snug font-medium">{offer}</p> : null}
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-hs-brown/80">{description}</p>
        ) : null}
        {answered.length > 0 ? (
          <dl className="mt-3 grid gap-2 border-t border-hs-ink/20 pt-3">
            {answered.map((entry) => (
              <div key={entry.label} className="min-w-0">
                <dt className="font-bungee text-[11px] leading-none tracking-[0.06em] uppercase text-hs-brown">
                  {entry.label}
                </dt>
                <dd className="mt-0.5 text-sm leading-snug break-words">{entry.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      <div className="mt-auto flex min-h-[4.5rem] items-center justify-between gap-4 border-t-[3px] border-hs-ink bg-hs-sand px-4 py-3">
        <PerkFooter perk={perk} claim={claim} onClaim={onClaim} />
      </div>
    </Card>
  );
}

function PerkFooter({
  perk,
  claim,
  onClaim,
}: {
  perk: PerkCardPerk;
  claim: PerkCardClaim;
  onClaim: () => void;
}) {
  const kind = perkTypeLabel(perk.type);

  if (claim?.code) {
    return (
      <>
        <div className="min-w-0">
          <MetaLabel>{kind}</MetaLabel>
          <p className="mt-0.5 font-mono text-lg leading-tight tracking-wide break-all select-all">
            {claim.code}
          </p>
        </div>
        <CopyButton value={claim.code} />
      </>
    );
  }

  if (claim) {
    return (
      <div className="min-w-0">
        <MetaLabel>{kind}</MetaLabel>
        <StatusLine status={claimStatusLabel(claim.status)} detail={claimDetail(claim.status)} />
      </div>
    );
  }

  if (perk.type === "code" && perk.availableCodes === 0) {
    return (
      <div className="min-w-0">
        <MetaLabel>{kind}</MetaLabel>
        <StatusLine status="Agotado" detail="No quedan códigos." muted />
      </div>
    );
  }

  const isCode = perk.type === "code";
  return (
    <>
      <div className="min-w-0">
        <MetaLabel>{kind}</MetaLabel>
        <p className="mt-0.5 text-sm leading-snug text-hs-brown">
          {isCode ? "Te asignamos un código único." : "La organización revisa tu solicitud."}
        </p>
      </div>
      <Button size="sm" className="shrink-0" onClick={onClaim}>
        {isCode ? "Reclamar" : "Solicitar"}
      </Button>
    </>
  );
}

function claimDetail(status: string): string {
  switch (status) {
    case "pending":
      return "Tu solicitud está con la organización.";
    case "added":
      return "Ya tienes acceso. Revisa tu email.";
    case "rejected":
      return "La organización no ha aprobado la solicitud.";
    case "assigned":
      return "Tu código está de camino.";
    default:
      return "";
  }
}

function MetaLabel({ children }: { children: string }) {
  return (
    <p className="font-bungee text-[11px] leading-none tracking-[0.06em] uppercase text-hs-brown">
      {children}
    </p>
  );
}

function StatusLine({
  status,
  detail,
  muted = false,
}: {
  status: string;
  detail: string;
  muted?: boolean;
}) {
  return (
    <p className={cn("mt-0.5 text-sm leading-snug", muted ? "text-hs-brown/70" : "text-hs-ink")}>
      <span className="font-bungee text-xs uppercase">{status}</span>
      {detail ? <span className={cn(!muted && "text-hs-brown")}> · {detail}</span> : null}
    </p>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  return (
    <Button
      size="sm"
      variant="outline"
      className="w-24 shrink-0"
      aria-live="polite"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => setCopied(true));
      }}
    >
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}
