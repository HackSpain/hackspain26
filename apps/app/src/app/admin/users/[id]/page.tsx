"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  ParticipantDetail,
  participantName,
  participantRef,
  useParticipant,
} from "@/components/admin/participant-detail";
import { EmptyState, LoadingText, Page } from "@/components/page";

export default function AdminParticipantPage() {
  return (
    <Suspense fallback={<LoadingText />}>
      <ParticipantPage />
    </Suspense>
  );
}

function ParticipantPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const detail = useParticipant(participantRef(search.get("kind"), params.id));

  if (detail === undefined) return <LoadingText />;
  if (detail === null) {
    return (
      <Page title="Participante">
        <EmptyState title="Participante no encontrado">
          Falta esta solicitud o este usuario.{" "}
          <Link href="/admin" className="underline underline-offset-2">
            Volver al CRM
          </Link>
        </EmptyState>
      </Page>
    );
  }

  return (
    <Page
      title={
        <div className="min-w-0 space-y-2">
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center font-bungee text-xs uppercase text-hs-navy motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97]"
          >
            Volver al CRM
          </Link>
          <h1 className="font-bungee text-2xl leading-tight break-words sm:text-3xl">
            {participantName(detail)}
          </h1>
        </div>
      }
    >
      <ParticipantDetail detail={detail} />
    </Page>
  );
}
