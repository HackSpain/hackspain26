"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { errorMessage } from "@/components/page";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BulkStatus = "accepted" | "waitlist" | "rejected";

export function PeopleBulkBar({
  selectedIds,
  onCleared,
}: {
  selectedIds: string[];
  onCleared: () => void;
}) {
  const types = useQuery(api.userTypes.list);
  const setStatus = useMutation(api.admin.bulkSetStatus);
  const setRole = useMutation(api.admin.bulkSetRole);
  const [roleId, setRoleId] = useState<string>("");
  const [pending, setPending] = useState<"status" | "role" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const count = selectedIds.length;

  if (count === 0) {
    return null;
  }

  async function runStatus(status: BulkStatus) {
    setPending("status");
    setFailure(null);
    try {
      await setStatus({ signupIds: selectedIds, status });
      onCleared();
    } catch (error: unknown) {
      setFailure(errorMessage(error, "No se pudo actualizar el estado."));
    } finally {
      setPending(null);
    }
  }

  async function runRole() {
    if (!roleId) {
      return;
    }
    setPending("role");
    setFailure(null);
    try {
      await setRole({
        roleId: roleId as Id<"userTypes">,
        signupIds: selectedIds,
      });
      onCleared();
    } catch (error: unknown) {
      setFailure(errorMessage(error, "No se pudo cambiar el rol."));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 border-[3px] border-hs-ink bg-hs-sand px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center">
      <p className="text-sm font-medium tabular-nums">
        {count === 1 ? "1 seleccionada" : `${count} seleccionadas`}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending !== null}
          onClick={() => void runStatus("accepted")}
        >
          Aceptar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="bg-hs-paper"
          disabled={pending !== null}
          onClick={() => void runStatus("waitlist")}
        >
          Lista de espera
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="bg-hs-paper"
          disabled={pending !== null}
          onClick={() => void runStatus("rejected")}
        >
          Rechazar
        </Button>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Select value={roleId} onValueChange={setRoleId}>
          <SelectTrigger
            aria-label="Rol para las seleccionadas"
            className="w-full bg-hs-paper sm:max-w-48"
          >
            <SelectValue placeholder="Cambiar rol" />
          </SelectTrigger>
          <SelectContent>
            {(types ?? []).map((type) => (
              <SelectItem key={type._id} value={type._id}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="bg-hs-paper"
          disabled={pending !== null || roleId === ""}
          onClick={() => void runRole()}
        >
          Asignar rol
        </Button>
      </div>
      {failure ? <p className="w-full text-sm text-hs-red">{failure}</p> : null}
    </div>
  );
}
