"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MetaLink, MetaRow, SocialMeta } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Frame } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  attendanceLabel,
  claimStatusLabel,
  cn,
  displayedAttendance,
  perkName,
  submissionStatusLabel,
} from "@/lib/utils";
import { urlDisplay, urlLabel } from "@/lib/urls";

export type ParticipantRef =
  | { kind: "signup"; id: Id<"signups"> }
  | { kind: "user"; id: Id<"users"> };

export type ParticipantDetailData = NonNullable<
  FunctionReturnType<typeof api.admin.getParticipant>
>;

export function participantRef(kind: string | null, id: string): ParticipantRef {
  return kind === "user"
    ? { kind: "user", id: id as Id<"users"> }
    : { kind: "signup", id: id as Id<"signups"> };
}

export function participantHref(ref: ParticipantRef) {
  return `/admin/users/${ref.id}?kind=${ref.kind}`;
}

export function participantName(detail: ParticipantDetailData) {
  return detail.user?.name ?? detail.signup?.fullName ?? "Participante";
}

export function useParticipant(ref: ParticipantRef | null) {
  return useQuery(
    api.admin.getParticipant,
    ref
      ? {
          signupId: ref.kind === "signup" ? ref.id : undefined,
          userId: ref.kind === "user" ? ref.id : undefined,
        }
      : "skip",
  );
}

export function ParticipantDetail({
  detail,
  layout = "page",
}: {
  detail: ParticipantDetailData;
  layout?: "page" | "sheet";
}) {
  const setRole = useMutation(api.admin.setRole);
  const setAttendance = useMutation(api.admin.setAttendance);
  const setAccepted = useMutation(api.admin.setAccepted);
  const setNotes = useMutation(api.admin.setNotes);
  const [notes, setNotesValue] = useState<string | null>(null);

  const noteValue = notes ?? detail.user?.adminNotes ?? "";
  const attendance = displayedAttendance(
    detail.user?.attendanceStatus,
    detail.user?.onboardingComplete === true,
  );
  const signup = detail.signup;
  const user = detail.user;

  return (
    <>
      <div className={cn("grid gap-4", layout === "page" && "md:grid-cols-2")}>
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Perfil
              <Badge
                variant={signup?.accepted ? "gold" : "default"}
                className="whitespace-nowrap"
              >
                {signup?.accepted ? "aceptado" : "no aceptado"}
              </Badge>
              {attendance ? (
                <Badge className="whitespace-nowrap">{attendanceLabel(attendance)}</Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <SocialMeta email={signup?.email ?? user?.email} urls={signup?.urls} />
            <MetaRow label="Teléfono">{user?.phone ?? "—"}</MetaRow>
            <MetaRow label="Dieta">{user?.dietaryRestrictions ?? "—"}</MetaRow>
            {user?.dietaryDetails ? (
              <MetaRow label="Detalles de dieta">{user.dietaryDetails}</MetaRow>
            ) : null}
            <MetaRow label="Viaja desde">{user?.travelOrigin ?? "—"}</MetaRow>
            {signup?.achievements ? (
              <MetaRow label="Logros">{signup.achievements}</MetaRow>
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
                  onClick={() => void setAccepted({ signupId: signup._id, accepted: true })}
                >
                  Marcar aceptado
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => void setAccepted({ signupId: signup._id, accepted: false })}
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
                    onClick={() => void setRole({ userId: user._id, role: "admin" })}
                  >
                    Hacer admin
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => void setRole({ userId: user._id, role: "user" })}
                  >
                    Quitar admin
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() =>
                      void setAttendance({ userId: user._id, attendanceStatus: "attending" })
                    }
                  >
                    Marcar asistiré
                  </Button>
                  <Button
                    variant="teal"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      void setAttendance({ userId: user._id, attendanceStatus: "cancelled" })
                    }
                  >
                    Marcar cancelado
                  </Button>
                </div>
                <Textarea
                  value={noteValue}
                  onChange={(event) => setNotesValue(event.target.value)}
                  aria-label="Notas de admin"
                />
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => void setNotes({ userId: user._id, notes: noteValue })}
                >
                  Guardar notas
                </Button>
              </>
            ) : (
              <p className="text-sm text-hs-brown">Esta persona aún no ha entrado.</p>
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
              <Frame key={claim._id} className="flex flex-wrap items-center gap-2">
                <span>{perkName(claim.company, claim.title)}</span>
                <Badge>{claimStatusLabel(claim.status)}</Badge>
                {claim.code ? <code className="break-all">{claim.code}</code> : null}
              </Frame>
            ))
          )}
        </CardContent>
      </Card>
      {detail.submission ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Proyecto
              <Badge className="whitespace-nowrap">
                {submissionStatusLabel(detail.submission.status)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-bungee text-base">{detail.submission.name || "Sin título"}</p>
            {detail.submission.description ? <p>{detail.submission.description}</p> : null}
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
                <MetaLink href={entry.url}>{urlDisplay(entry.kind, entry.url)}</MetaLink>
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
