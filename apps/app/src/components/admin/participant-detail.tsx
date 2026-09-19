"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { FormError, MetaLink, MetaRow, SocialMeta, errorMessage } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Frame } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  attendanceLabel,
  claimStatusLabel,
  cn,
  displayedAttendance,
  perkName,
  roleLabel,
  submissionStatusLabel,
} from "@/lib/utils";
import { urlDisplay, urlLabel } from "@/lib/urls";

const NO_TYPE = "none";

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
  const setUserType = useMutation(api.admin.setUserType);
  const checkInParticipant = useMutation(api.passes.checkInParticipant);
  const undoCheckIn = useMutation(api.passes.undoCheckIn);
  const assignTeam = useMutation(api.teams.adminAssignMember);
  const removeTeam = useMutation(api.teams.adminRemoveMember);
  const userTypes = useQuery(api.userTypes.list);
  const teams = useQuery(api.teams.adminOptions);
  const [notes, setNotesValue] = useState<string | null>(null);
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [teamChoice, setTeamChoice] = useState<Id<"teams"> | undefined>();
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  const noteValue = notes ?? detail.user?.adminNotes ?? "";
  const attendance = displayedAttendance(
    detail.user?.attendanceStatus,
    detail.user?.onboardingComplete === true,
  );
  const signup = detail.signup;
  const user = detail.user;
  const pass = detail.pass;
  const team = detail.team;
  const checkedIn = pass?.checkedInAt !== undefined;
  const selectedTeamId = teamChoice ?? team?._id;
  const staffRole = roleLabel(user?.role);

  async function markCheckedIn() {
    if (checkInBusy) {
      return;
    }
    setCheckInBusy(true);
    setCheckInError(null);
    try {
      await checkInParticipant({
        signupId: signup?._id,
        userId: user?._id,
      });
    } catch (error) {
      setCheckInError(errorMessage(error, "No se ha podido completar el check-in"));
    } finally {
      setCheckInBusy(false);
    }
  }

  async function placeOnTeam() {
    if (teamBusy || !selectedTeamId) {
      return;
    }
    setTeamBusy(true);
    setTeamError(null);
    try {
      await assignTeam({
        signupId: signup?._id,
        teamId: selectedTeamId,
        userId: user?._id,
      });
    } catch (error) {
      setTeamError(errorMessage(error, "No se ha podido asignar al equipo"));
    } finally {
      setTeamBusy(false);
    }
  }

  async function dropFromTeam() {
    if (teamBusy || !team) {
      return;
    }
    setTeamBusy(true);
    setTeamError(null);
    try {
      await removeTeam({
        signupId: signup?._id,
        userId: user?._id,
      });
      setTeamChoice(undefined);
    } catch (error) {
      setTeamError(errorMessage(error, "No se ha podido quitar del equipo"));
    } finally {
      setTeamBusy(false);
    }
  }

  async function clearCheckIn() {
    if (checkInBusy || !pass) {
      return;
    }
    setCheckInBusy(true);
    setCheckInError(null);
    try {
      await undoCheckIn({ passId: pass._id });
    } catch (error) {
      setCheckInError(errorMessage(error, "No se ha podido deshacer el check-in"));
    } finally {
      setCheckInBusy(false);
    }
  }

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
              {staffRole ? (
                <Badge className="whitespace-nowrap">{staffRole}</Badge>
              ) : null}
              {user?.userType ? (
                <Badge className="whitespace-nowrap">{user.userType.label}</Badge>
              ) : null}
              {checkedIn ? (
                <Badge variant="gold" className="whitespace-nowrap">
                  check-in
                </Badge>
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
            <MetaRow label="Check-in">
              <span className="tabular-nums">
                {pass?.checkedInAt !== undefined
                  ? new Date(pass.checkedInAt).toLocaleString("es-ES", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Europe/Madrid",
                    })
                  : "Pendiente"}
              </span>
            </MetaRow>
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
            {signup || user ? (
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {checkedIn ? (
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={checkInBusy}
                      onClick={() => void clearCheckIn()}
                    >
                      {checkInBusy ? "Deshaciendo…" : "Deshacer check-in"}
                    </Button>
                  ) : (
                    <Button
                      className="w-full sm:w-auto"
                      disabled={checkInBusy || signup?.accepted === false}
                      onClick={() => void markCheckedIn()}
                    >
                      {checkInBusy ? "Marcando…" : "Marcar check-in"}
                    </Button>
                  )}
                </div>
                {signup && !signup.accepted ? (
                  <p className="text-xs text-hs-brown">
                    Acepta al participante para poder hacer el check-in.
                  </p>
                ) : null}
                <FormError message={checkInError} />
              </div>
            ) : null}
            {user ? (
              <>
                <div className="space-y-2">
                  <label
                    htmlFor={`user-type-${user._id}`}
                    className="font-bungee text-xs uppercase"
                  >
                    Tipo de usuario
                  </label>
                  <Select
                    value={user.userType?._id ?? NO_TYPE}
                    disabled={userTypes === undefined}
                    onValueChange={(value) =>
                      void setUserType({
                        typeId: value === NO_TYPE ? null : (value as Id<"userTypes">),
                        userId: user._id,
                      })
                    }
                  >
                    <SelectTrigger id={`user-type-${user._id}`} aria-label="Tipo de usuario">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TYPE}>
                        Sin tipo{" "}
                        <span className="text-xs text-hs-brown">
                          · usa el tipo por defecto
                        </span>
                      </SelectItem>
                      {(userTypes ?? []).map((type) => (
                        <SelectItem key={type._id} value={type._id}>
                          {type.label}
                          {type.isDefault ? (
                            <span className="text-xs text-hs-brown"> · por defecto</span>
                          ) : null}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {userTypes !== undefined && userTypes.length === 0 ? (
                    <p className="text-xs text-hs-brown">
                      Aún no hay tipos. Créalos en Admin → Tipos.
                    </p>
                  ) : null}
                </div>
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
        <CardContent className="space-y-3 text-sm">
          <p>
            Equipo: {team?.name ?? "—"}
            {team?.isOwner ? " · dueño" : null}
            {team && team.status !== "member" ? " · invitado" : null}
          </p>
          {signup || user ? (
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
                <Select
                  value={selectedTeamId}
                  disabled={teams === undefined || teamBusy}
                  onValueChange={(value) => setTeamChoice(value as Id<"teams">)}
                >
                  <SelectTrigger className="sm:max-w-xs" aria-label="Equipo">
                    <SelectValue placeholder="Elige un equipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(teams ?? []).map((option) => (
                      <SelectItem key={option._id} value={option._id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full sm:w-auto"
                  disabled={
                    teamBusy ||
                    !selectedTeamId ||
                    (selectedTeamId === team?._id && team.status === "member")
                  }
                  onClick={() => void placeOnTeam()}
                >
                  {teamBusy ? "Guardando…" : "Asignar al equipo"}
                </Button>
                {team ? (
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={teamBusy}
                    onClick={() => void dropFromTeam()}
                  >
                    Quitar del equipo
                  </Button>
                ) : null}
              </div>
              {teams !== undefined && teams.length === 0 ? (
                <p className="text-xs text-hs-brown">Aún no hay equipos.</p>
              ) : null}
              <FormError message={teamError} />
            </div>
          ) : null}
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
