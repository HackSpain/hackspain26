"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import {
  EmptyState,
  LoadingText,
  Page,
  RecordCard,
  RecordList,
} from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { claimStatusLabel, perkName } from "@/lib/utils";

export default function AdminApplicationsPage() {
  const [status, setStatus] = useState<
    "all" | "pending" | "added" | "rejected"
  >("pending");
  const rows = useQuery(api.perks.adminApplications, {
    status: status === "all" ? undefined : status,
  });
  const setApplicationStatus = useMutation(api.perks.adminSetApplicationStatus);

  return (
    <Page title="Solicitudes de perks">
      <Select
        value={status}
        onValueChange={(value) =>
          setStatus(value as "all" | "pending" | "added" | "rejected")
        }
      >
        <SelectTrigger className="w-full sm:max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="pending">Pendientes</SelectItem>
          <SelectItem value="added">Añadidas</SelectItem>
          <SelectItem value="rejected">Rechazadas</SelectItem>
        </SelectContent>
      </Select>
      {rows ? (
        rows.length === 0 ? (
          <EmptyState title="No hay solicitudes">
            Nada en este estado todavía.
          </EmptyState>
        ) : (
          <RecordList
            desktop={
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Perk</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row._id}>
                      <TableCell>
                        {row.name ?? "—"}
                        <br />
                        <span className="text-xs text-hs-brown">
                          {row.email}
                        </span>
                      </TableCell>
                      <TableCell>{perkName(row.company, row.title)}</TableCell>
                      <TableCell>
                        <Badge>{claimStatusLabel(row.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() =>
                              void setApplicationStatus({
                                claimId: row._id,
                                status: "added",
                              })
                            }
                          >
                            Marcar añadida
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              void setApplicationStatus({
                                claimId: row._id,
                                status: "rejected",
                              })
                            }
                          >
                            Rechazar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            }
          >
            {rows.map((row) => (
              <RecordCard
                key={row._id}
                title={row.name ?? "—"}
                subtitle={row.email}
                actions={
                  <>
                    <Button
                      className="w-full"
                      onClick={() =>
                        void setApplicationStatus({
                          claimId: row._id,
                          status: "added",
                        })
                      }
                    >
                      Marcar añadida
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() =>
                        void setApplicationStatus({
                          claimId: row._id,
                          status: "rejected",
                        })
                      }
                    >
                      Rechazar
                    </Button>
                  </>
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{claimStatusLabel(row.status)}</Badge>
                  <span className="text-sm text-hs-brown">
                    {perkName(row.company, row.title)}
                  </span>
                </div>
              </RecordCard>
            ))}
          </RecordList>
        )
      ) : (
        <LoadingText />
      )}
    </Page>
  );
}
