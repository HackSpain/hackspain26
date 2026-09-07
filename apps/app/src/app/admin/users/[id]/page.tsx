"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  EmptyState,
  LoadingText,
  MetaLink,
  MetaRow,
  Page,
  SocialMeta,
} from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Frame,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  attendanceLabel,
  claimStatusLabel,
  displayedAttendance,
  perkName,
  submissionStatusLabel,
} from "@/lib/utils";
import { urlDisplay, urlLabel } from "@/lib/urls";

export default function AdminParticipantPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const kind = search.get("kind") === "user" ? "user" : "signup";
  const detail = useQuery(api.admin.getParticipant, {
    signupId: kind === "signup" ? (params.id as Id<"signups">) : undefined,
    userId: kind === "user" ? (params.id as Id<"users">) : undefined,
  });
  const setRole = useMutation(api.admin.setRole);
  const setAttendance = useMutation(api.admin.setAttendance);
  const setAccepted = useMutation(api.admin.setAccepted);
  const setNotes = useMutation(api.admin.setNotes);
  const [notes, setNotesValue] = useState<string | null>(null);

  if (detail === undefined) {
    return <LoadingText />;
  }
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

  const noteValue = notes ?? detail.user?.adminNotes ?? "";
  const signup = detail.signup;
  const user = detail.user;
  const attendance = displayedAttendance(
    detail.user?.attendanceStatus,
    detail.user?.onboardingComplete === true
  );

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
            {detail.user?.name ?? detail.signup?.fullName ?? "Participante"}
          </h1>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <SocialMeta
              email={detail.signup?.email ?? detail.user?.email}
              urls={detail.signup?.urls}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={detail.signup?.accepted ? "gold" : "default"}>
                {detail.signup?.accepted ? "aceptado" : "no aceptado"}
              </Badge>
              {attendance ? <Badge>{attendanceLabel(attendance)}</Badge> : null}
            </div>
            <MetaRow label="Teléfono">{detail.user?.phone ?? "—"}</MetaRow>
            <MetaRow label="Dieta">
              {detail.user?.dietaryRestrictions ?? "—"}
            </MetaRow>
            {detail.user?.dietaryDetails ? (
              <MetaRow label="Detalles de dieta">
                {detail.user.dietaryDetails}
              </MetaRow>
            ) : null}
            <MetaRow label="Viaja desde">
              {detail.user?.travelOrigin ?? "—"}
            </MetaRow>
            {detail.signup?.achievements ? (
              <MetaRow label="Logros">{detail.signup.achievements}</MetaRow>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Acciones de admin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {signup ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  className="w-full sm:w-auto"
                  onClick={() =>
                    void setAccepted({
                      signupId: signup._id,
                      accepted: true,
                    })
                  }
                >
                  Marcar aceptado
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() =>
                    void setAccepted({
                      signupId: signup._id,
                      accepted: false,
                    })
                  }
                >
                  Marcar no aceptado
                </Button>
              </div>
            ) : (
              <p className="text-sm text-hs-brown">
                No hay solicitud, no se puede cambiar la aceptación.
              </p>
            )}
            {user ? (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      void setRole({ userId: user._id, role: "admin" })
                    }
                  >
                    Hacer admin
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      void setRole({ userId: user._id, role: "user" })
                    }
                  >
                    Quitar admin
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() =>
                      void setAttendance({
                        userId: user._id,
                        attendanceStatus: "attending",
                      })
                    }
                  >
                    Marcar asistiré
                  </Button>
                  <Button
                    variant="teal"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      void setAttendance({
                        userId: user._id,
                        attendanceStatus: "cancelled",
                      })
                    }
                  >
                    Marcar cancelado
                  </Button>
                </div>
                <Textarea
                  value={noteValue}
                  onChange={(event) => setNotesValue(event.target.value)}
                />
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() =>
                    void setNotes({
                      userId: user._id,
                      notes: noteValue,
                    })
                  }
                >
                  Guardar notas
                </Button>
              </>
            ) : (
              <p className="text-sm text-hs-brown">
                Esta persona aún no ha entrado.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Equipo y perks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Equipo: {detail.team?.name ?? "—"}</p>
          {detail.claims.length === 0 ? (
            <p>Sin perks reclamados.</p>
          ) : (
            detail.claims.map((claim) => (
              <Frame
                key={claim._id}
                className="flex flex-wrap items-center gap-2"
              >
                <span>{perkName(claim.company, claim.title)}</span>
                <Badge>{claimStatusLabel(claim.status)}</Badge>
                {claim.code ? (
                  <code className="break-all">{claim.code}</code>
                ) : null}
              </Frame>
            ))
          )}
        </CardContent>
      </Card>
      {detail.submission ? (
        <Card>
          <CardHeader>
            <CardTitle>Proyecto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-bungee text-base">
              {detail.submission.name || "Sin título"}
            </p>
            <Badge>{submissionStatusLabel(detail.submission.status)}</Badge>
            {detail.submission.description ? (
              <p>{detail.submission.description}</p>
            ) : null}
            <p>
              Retos:{" "}
              {detail.submission.challengeLabels.length > 0
                ? detail.submission.challengeLabels.join(", ")
                : "—"}
            </p>
            <p>
              Partners:{" "}
              {detail.submission.perkLabels.length > 0
                ? detail.submission.perkLabels.join(", ")
                : "—"}
            </p>
            {detail.submission.urls.map((entry) => (
              <p key={entry.kind}>
                {urlLabel(entry.kind)}:{" "}
                <MetaLink href={entry.url}>
                  {urlDisplay(entry.kind, entry.url)}
                </MetaLink>
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </Page>
  );
}
