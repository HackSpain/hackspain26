"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import {
  Field,
  FormError,
  LoadingText,
  Page,
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
  Frame,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Id } from "@convex/_generated/dataModel";
import {
  identifierPlaceholder,
  identifierTypeLabel,
  teamMemberStatusLabel,
} from "@/lib/utils";
import type { IdentifierType } from "@/lib/utils";

const IDENTIFIER_OPTIONS = [
  { label: "GitHub", value: "github" },
  { label: "X / Twitter", value: "twitter" },
  { label: "Email", value: "email" },
] as const;

type MemberDraft = {
  key: string;
  identifierType: IdentifierType;
  identifier: string;
};

let memberDraftKey = 0;

function newMemberDraft(): MemberDraft {
  memberDraftKey += 1;
  return {
    identifier: "",
    identifierType: "github",
    key: String(memberDraftKey),
  };
}

function MemberIdentifierInputs({
  identifierType,
  identifier,
  onTypeChange,
  onIdentifierChange,
  inputId,
}: {
  identifierType: IdentifierType;
  identifier: string;
  onTypeChange: (type: IdentifierType) => void;
  onIdentifierChange: (value: string) => void;
  inputId?: string;
}) {
  return (
    <>
      <Select
        value={identifierType}
        onValueChange={(value) => onTypeChange(value as IdentifierType)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {IDENTIFIER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={inputId}
        value={identifier}
        type={identifierType === "email" ? "email" : "text"}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onIdentifierChange(event.target.value)}
        placeholder={identifierPlaceholder(identifierType)}
      />
    </>
  );
}

function CreateTeamForm({ onCreated }: { onCreated: () => void }) {
  const create = useMutation(api.teams.create);
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [memberRows, setMemberRows] = useState<MemberDraft[]>(() => [
    newMemberDraft(),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function updateMemberRow(key: string, patch: Partial<MemberDraft>) {
    setMemberRows((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  }

  async function submitCreate() {
    setError(null);
    const members = memberRows
      .map((row) => ({
        identifier: row.identifier.trim(),
        identifierType: row.identifierType,
      }))
      .filter((row) => row.identifier.length > 0);
    setPending(true);
    try {
      await create({ members, name });
      onCreated();
    } catch (caughtError: unknown) {
      setError(errorMessage(caughtError, "No se ha podido crear"));
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogContent
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        nameRef.current?.focus();
      }}
    >
      <DialogHeader>
        <DialogTitle>Crear equipo</DialogTitle>
        <DialogDescription>
          Añade gente por usuario de GitHub, handle de X o email.
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submitCreate();
        }}
      >
        <FormError message={error} />
        <Field label="Nombre del equipo" htmlFor="team-name">
          <Input
            ref={nameRef}
            id="team-name"
            value={name}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field
          label="Miembros"
          htmlFor={memberRows[0] ? `member-${memberRows[0].key}` : undefined}
          hint="Opcional. Deja la fila vacía si aún no quieres añadir a nadie."
        >
          <div className="space-y-3">
            {memberRows.map((row, index) => (
              <div
                key={row.key}
                className={
                  memberRows.length > 1
                    ? "grid gap-3 sm:grid-cols-[150px_1fr_auto]"
                    : "grid gap-3 sm:grid-cols-[150px_1fr]"
                }
              >
                <MemberIdentifierInputs
                  identifierType={row.identifierType}
                  identifier={row.identifier}
                  inputId={`member-${row.key}`}
                  onTypeChange={(type) =>
                    updateMemberRow(row.key, { identifierType: type })
                  }
                  onIdentifierChange={(value) =>
                    updateMemberRow(row.key, { identifier: value })
                  }
                />
                {memberRows.length > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    aria-label={`Quitar miembro ${index + 1}`}
                    onClick={() =>
                      setMemberRows((rows) =>
                        rows.filter((item) => item.key !== row.key)
                      )
                    }
                  >
                    Quitar
                  </Button>
                ) : null}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() =>
                setMemberRows((rows) => [...rows, newMemberDraft()])
              }
            >
              Añadir miembro
            </Button>
          </div>
        </Field>
        <DialogFooter>
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Creando…" : "Crear equipo"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function TeamsPageContent() {
  const team = useQuery(api.teams.mine);
  const rename = useMutation(api.teams.rename);
  const addMember = useMutation(api.teams.addMember);
  const removeMember = useMutation(api.teams.removeMember);
  const leave = useMutation(api.teams.leave);
  const router = useRouter();
  const search = useSearchParams();
  const [createOpen, setCreateOpen] = useState(() => search.get("new") === "1");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [identifierType, setIdentifierType] =
    useState<IdentifierType>("github");
  const [error, setError] = useState<string | null>(null);

  if (team === undefined) {
    return <LoadingText />;
  }

  function setCreateDialog(open: boolean) {
    setCreateOpen(open);
    if (!open && search.has("new")) {
      router.replace("/teams", { scroll: false });
    }
  }

  return (
    <Page title="Equipo">
      <FormError message={error} />

      {team ? (
        <Card>
          <CardHeader>
            <CardTitle>{team.name}</CardTitle>
            <CardDescription>
              {team.isOwner ? "Eres el dueño de este equipo." : "Eres miembro."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {team.isOwner ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={name || team.name}
                  onChange={(event) => setName(event.target.value)}
                />
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() =>
                    void rename({ teamId: team._id, name: name || team.name })
                  }
                >
                  Renombrar
                </Button>
              </div>
            ) : null}

            <div className="space-y-2">
              {team.members.map((member) => (
                <Frame
                  key={member._id}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium break-words">
                      {member.name ?? member.identifier}
                    </p>
                    <p className="text-xs break-all text-hs-brown">
                      {identifierTypeLabel(member.identifierType)}:{" "}
                      {member.identifier}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{teamMemberStatusLabel(member.status)}</Badge>
                    {team.isOwner && member.userId !== team.ownerId ? (
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() =>
                          void removeMember({
                            memberId: member._id as Id<"teamMembers">,
                          })
                        }
                      >
                        Quitar
                      </Button>
                    ) : null}
                  </div>
                </Frame>
              ))}
            </div>

            {team.isOwner ? (
              <div className="grid gap-3 sm:grid-cols-[160px_1fr] lg:grid-cols-[160px_1fr_auto]">
                <MemberIdentifierInputs
                  identifierType={identifierType}
                  identifier={identifier}
                  onTypeChange={setIdentifierType}
                  onIdentifierChange={setIdentifier}
                />
                <Button
                  className="w-full lg:w-auto"
                  onClick={() => {
                    setError(null);
                    void addMember({
                      teamId: team._id,
                      identifierType,
                      identifier,
                    })
                      .then(() => setIdentifier(""))
                      .catch((caughtError: unknown) =>
                        setError(
                          errorMessage(caughtError, "No se ha podido añadir")
                        )
                      );
                  }}
                >
                  Añadir
                </Button>
              </div>
            ) : null}

            {!team.isOwner ? (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setError(null);
                  void leave({}).catch((caughtError: unknown) =>
                    setError(
                      errorMessage(
                        caughtError,
                        "No has podido salir del equipo"
                      )
                    )
                  );
                }}
              >
                Salir del equipo
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Todavía no tienes equipo</CardTitle>
            <CardDescription>
              Crea uno y añade a tu gente por GitHub, X o email. También puedes
              participar en solitario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={createOpen} onOpenChange={setCreateDialog}>
              <Button
                className="w-full sm:w-auto"
                onClick={() => setCreateDialog(true)}
              >
                Crear equipo
              </Button>
              <CreateTeamForm onCreated={() => setCreateDialog(false)} />
            </Dialog>
          </CardContent>
        </Card>
      )}
    </Page>
  );
}

export default function TeamsPage() {
  return (
    <Suspense fallback={<LoadingText />}>
      <TeamsPageContent />
    </Suspense>
  );
}
