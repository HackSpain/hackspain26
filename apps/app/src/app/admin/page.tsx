"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import {
  EmptyState,
  LoadingText,
  Page,
  RecordCard,
  RecordList,
} from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { attendanceLabel, displayedAttendance } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AdminCrmPage() {
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [attendance, setAttendance] = useState<
    "all" | "attending" | "cancelled" | "undecided"
  >("all");
  const [accepted, setAccepted] = useState<"all" | "yes" | "no">("all");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(search), 200);
    return () => window.clearTimeout(timer);
  }, [search]);

  const rows = useQuery(api.admin.listParticipants, {
    accepted: accepted === "all" ? undefined : accepted === "yes",
    attendance: attendance === "all" ? undefined : attendance,
    search: searchQuery || undefined,
  });

  return (
    <Page title="Participantes">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar nombre, email, equipo"
          className="sm:col-span-2 lg:col-span-1"
        />
        <Select
          value={accepted}
          onValueChange={(value) => setAccepted(value as "all" | "yes" | "no")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda la aceptación</SelectItem>
            <SelectItem value="yes">Aceptados</SelectItem>
            <SelectItem value="no">No aceptados</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={attendance}
          onValueChange={(value) =>
            setAttendance(
              value as "all" | "attending" | "cancelled" | "undecided"
            )
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda la asistencia</SelectItem>
            <SelectItem value="attending">Asistiré</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
            <SelectItem value="undecided">Sin decidir</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {rows ? (
        rows.length === 0 ? (
          <EmptyState title="Ningún participante coincide">
            Prueba otra búsqueda o quita los filtros.
          </EmptyState>
        ) : (
          <RecordList
            desktop={
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Aceptado</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Dieta</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Asistencia</TableHead>
                    <TableHead>Equipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const href = row.signupId
                      ? `/admin/users/${row.signupId}?kind=signup`
                      : `/admin/users/${row.userId}?kind=user`;
                    const displayedStatus = displayedAttendance(
                      row.attendanceStatus,
                      row.onboardingComplete === true
                    );
                    return (
                      <TableRow
                        key={`${row.signupId ?? ""}-${row.userId ?? ""}`}
                      >
                        <TableCell>
                          <Link
                            href={href}
                            className="underline underline-offset-2"
                          >
                            {row.name}
                          </Link>
                        </TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>
                          <Badge variant={row.accepted ? "gold" : "default"}>
                            {row.accepted ? "aceptado" : "no aceptado"}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.phone ?? "—"}</TableCell>
                        <TableCell>{row.dietaryRestrictions ?? "—"}</TableCell>
                        <TableCell>{row.travelOrigin ?? "—"}</TableCell>
                        <TableCell>
                          <Badge>
                            {displayedStatus
                              ? attendanceLabel(displayedStatus)
                              : "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.teamName ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            }
          >
            {rows.map((row) => {
              const href = row.signupId
                ? `/admin/users/${row.signupId}?kind=signup`
                : `/admin/users/${row.userId}?kind=user`;
              const displayedStatus = displayedAttendance(
                row.attendanceStatus,
                row.onboardingComplete === true
              );
              return (
                <Link
                  key={`${row.signupId ?? ""}-${row.userId ?? ""}`}
                  href={href}
                  className="block motion-safe:transition-transform motion-safe:duration-[var(--duration-press)] motion-safe:ease-[var(--ease-out)] motion-safe:active:scale-[0.97]"
                >
                  <RecordCard title={row.name} subtitle={row.email}>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={row.accepted ? "gold" : "default"}>
                        {row.accepted ? "aceptado" : "no aceptado"}
                      </Badge>
                      <Badge>
                        {displayedStatus
                          ? attendanceLabel(displayedStatus)
                          : "—"}
                      </Badge>
                    </div>
                    <p className="text-sm text-hs-brown">
                      {row.teamName ?? "Sin equipo"}
                      {row.travelOrigin ? ` · ${row.travelOrigin}` : ""}
                    </p>
                  </RecordCard>
                </Link>
              );
            })}
          </RecordList>
        )
      ) : (
        <LoadingText />
      )}
    </Page>
  );
}
