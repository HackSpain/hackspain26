"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  FormError,
  LoadingText,
  RecordCard,
  errorMessage,
} from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { claimStatusLabel, cn, perkName } from "@/lib/utils";

function Answers({ answers }: { answers: { label: string; value: string }[] }) {
  if (answers.length === 0) {
    return null;
  }
  return (
    <dl className="mt-1 grid gap-0.5 text-xs">
      {answers.map((answer) => (
        <div key={answer.label} className="flex min-w-0 gap-1.5">
          <dt className="shrink-0 font-bungee uppercase text-hs-brown">
            {answer.label}
          </dt>
          <dd className="min-w-0 break-words">{answer.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReviewActions({
  claimId,
  compact,
  stacked,
}: {
  claimId: Id<"perkClaims">;
  compact?: boolean;
  stacked?: boolean;
}) {
  const setApplicationStatus = useMutation(api.perks.adminSetApplicationStatus);
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function setStatus(status: "added" | "rejected") {
    setFailure(null);
    setPending(true);
    try {
      await setApplicationStatus({
        claimId,
        status,
        code: status === "added" && code.trim() ? code.trim() : undefined,
      });
      if (status === "added") {
        setCode("");
      }
    } catch (error: unknown) {
      setFailure(errorMessage(error, "No se ha podido actualizar"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-2">
      <div
        className={cn(
          "flex gap-2",
          stacked ? "flex-col" : "flex-wrap items-center"
        )}
      >
        <Input
          aria-label="Código del perk"
          placeholder="Código"
          value={code}
          disabled={pending}
          className={cn(
            "min-w-0 font-mono",
            compact ? "h-9 flex-1 text-sm" : stacked ? "w-full" : "max-w-48"
          )}
          onChange={(event) => setCode(event.target.value)}
        />
        <Button
          size={compact ? "sm" : "default"}
          className={stacked ? "w-full min-w-0" : undefined}
          disabled={pending}
          onClick={() => void setStatus("added")}
        >
          Marcar añadida
        </Button>
        <Button
          size={compact ? "sm" : "default"}
          variant="outline"
          className={stacked ? "w-full min-w-0" : undefined}
          disabled={pending}
          onClick={() => void setStatus("rejected")}
        >
          Rechazar
        </Button>
      </div>
      <FormError message={failure} />
    </div>
  );
}

export function EmailApplicationsQueue() {
  const [status, setStatus] = useState<
    "all" | "pending" | "added" | "rejected"
  >("pending");
  const rows = useQuery(api.perks.adminApplications, {
    status: status === "all" ? undefined : status,
  });

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="min-w-0 gap-3">
        <div className="min-w-0 space-y-1">
          <CardTitle>Solicitudes por email</CardTitle>
          <CardDescription>
            El hacker pide acceso; al marcarlo como añadido puedes pegar el
            código que le toca.
          </CardDescription>
        </div>
        <Select
          value={status}
          onValueChange={(value) =>
            setStatus(value as "all" | "pending" | "added" | "rejected")
          }
        >
          <SelectTrigger className="w-full max-w-full sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="added">Añadidas</SelectItem>
            <SelectItem value="rejected">Rechazadas</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="min-w-0">
        {!rows ? (
          <LoadingText />
        ) : rows.length === 0 ? (
          <p className="text-sm text-hs-brown">Nada en este estado todavía.</p>
        ) : (
          <div className="grid min-w-0 gap-3">
            {rows.map((row) => (
              <RecordCard
                key={row._id}
                title={row.name ?? "—"}
                subtitle={row.email}
                badges={<Badge>{claimStatusLabel(row.status)}</Badge>}
              >
                <p className="min-w-0 text-sm break-words text-hs-brown">
                  {perkName(row.company, row.title)}
                </p>
                {row.code ? (
                  <p className="min-w-0 font-mono text-xs break-all">
                    {row.code}
                  </p>
                ) : null}
                <Answers answers={row.answers} />
                <ReviewActions claimId={row._id} stacked />
              </RecordCard>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
