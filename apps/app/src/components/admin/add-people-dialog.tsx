"use client";

import { useMutation, useQuery } from "convex/react";
import { UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { parseEmailList } from "@convex/lib/normalize";
import { Field, FormError, FormNotice, errorMessage } from "@/components/page";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";

const NO_TYPE = "none";

function resultMessage(result: {
  added: number;
  updated: number;
  skipped: number;
  invalid: string[];
}): string {
  const parts: string[] = [];
  if (result.added > 0) {
    parts.push(
      result.added === 1
        ? "1 persona añadida"
        : `${result.added} personas añadidas`,
    );
  }
  if (result.updated > 0) {
    parts.push(
      result.updated === 1
        ? "1 persona actualizada"
        : `${result.updated} personas actualizadas`,
    );
  }
  if (parts.length === 0 && result.skipped > 0) {
    parts.push(
      result.skipped === 1
        ? "Ya estaba así"
        : "Ya estaban así",
    );
  }
  if (result.invalid.length > 0) {
    parts.push(`No válidos: ${result.invalid.join(", ")}`);
  }
  return parts.join(". ");
}

export function AddPeopleDialog() {
  const emailsId = useId();
  const nameId = useId();
  const typeId = useId();
  const roleId = useId();
  const addPeople = useMutation(api.admin.addPeople);
  const userTypes = useQuery(api.userTypes.list);
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState("");
  const [name, setName] = useState("");
  const [userTypeId, setUserTypeId] = useState<string>(NO_TYPE);
  const [role, setRole] = useState<"user" | "admin">("user");
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = parseEmailList([emails]);
  const canSubmit = parsed.emails.length > 0 && !saving;

  const reset = () => {
    setEmails("");
    setName("");
    setUserTypeId(NO_TYPE);
    setRole("user");
    setFormError(null);
    setNotice(null);
  };

  const submit = async () => {
    if (!canSubmit) {
      return;
    }
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      const result = await addPeople({
        emails: parsed.emails,
        role,
        userTypeId:
          userTypeId === NO_TYPE
            ? undefined
            : (userTypeId as Id<"userTypes">),
        name:
          parsed.emails.length === 1 && name.trim()
            ? name.trim()
            : undefined,
      });
      setNotice(resultMessage(result));
      setEmails("");
      setName("");
    } catch (error: unknown) {
      setFormError(errorMessage(error, "No se han podido añadir"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
        }
      }}
    >
      <Button
        type="button"
        size="sm"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        <UserPlus />
        Añadir
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir personas</DialogTitle>
          <DialogDescription>
            Pega emails y elige tipo y acceso. Aparecen en el CRM ahora; al
            entrar con ese email tendrán esa configuración.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <FormError message={formError} />
          <FormNotice message={notice} />
          <Field
            label="Emails"
            htmlFor={emailsId}
            hint={
              parsed.emails.length > 0
                ? `${parsed.emails.length} ${parsed.emails.length === 1 ? "email" : "emails"}`
                : "Uno por línea, o separados por coma"
            }
          >
            <Textarea
              id={emailsId}
              value={emails}
              onChange={(event) => setEmails(event.target.value)}
              placeholder="ada@hackspain.com"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Tipo" htmlFor={typeId}>
            <Select
              value={userTypeId}
              onValueChange={setUserTypeId}
              disabled={userTypes === undefined}
            >
              <SelectTrigger id={typeId} aria-label="Tipo de usuario">
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
          </Field>
          <Field label="Acceso" htmlFor={roleId}>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as "user" | "admin")}
            >
              <SelectTrigger id={roleId} aria-label="Acceso">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Participante</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Nombre"
            htmlFor={nameId}
            hint="Opcional. Solo se usa si añades un email."
          >
            <Input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ada Lovelace"
              autoComplete="off"
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={!canSubmit}>
              {saving ? "Añadiendo…" : "Añadir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
