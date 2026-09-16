"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { EventPhase } from "@convex/lib/eventWindow";
import { Field, FormError, LoadingText, Page, errorMessage } from "@/components/page";
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
import { formatEventDate, fromDatetimeLocal, toDatetimeLocal } from "@/lib/utils";

const PHASE_LABEL: Record<EventPhase, string> = {
  after: "Terminado",
  before: "Antes del evento",
  during: "En marcha",
  unscheduled: "Sin programar",
};

/**
 * The hackathon window. Outside it participants only keep the profile and
 * the directory, on the web and in the CLI (convex/lib/eventWindow.ts).
 * Admins are never restricted.
 */
type Window = { startsAt?: number; endsAt?: number };

export default function AdminEventPage() {
  const current = useQuery(api.settings.adminEventWindow);
  // Lives here because the form below remounts on every save.
  const [saved, setSaved] = useState(false);
  if (!current) {
    return <LoadingText />;
  }
  // Keyed on the stored bounds so a save elsewhere resets the draft.
  return (
    <WindowForm
      key={`${current.startsAt ?? ""}-${current.endsAt ?? ""}`}
      current={current}
      saved={saved}
      onSaved={setSaved}
    />
  );
}

function WindowForm({
  current,
  saved,
  onSaved,
}: {
  current: Window & { phase: EventPhase };
  saved: boolean;
  onSaved: (saved: boolean) => void;
}) {
  const save = useMutation(api.settings.adminSetEventWindow);
  const [startsAt, setStartsAt] = useState(toDatetimeLocal(current.startsAt));
  const [endsAt, setEndsAt] = useState(toDatetimeLocal(current.endsAt));
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const dirty =
    startsAt !== toDatetimeLocal(current.startsAt) ||
    endsAt !== toDatetimeLocal(current.endsAt);
  const scheduled = current.startsAt !== undefined && current.endsAt !== undefined;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function run(args: Window) {
    if (pending) {
      return;
    }
    setPending(true);
    setFormError(null);
    onSaved(false);
    try {
      await save(args);
      onSaved(true);
    } catch (error: unknown) {
      setFormError(errorMessage(error, "No se pudo guardar la ventana."));
    } finally {
      setPending(false);
    }
  }

  function submit() {
    const start = fromDatetimeLocal(startsAt);
    const end = fromDatetimeLocal(endsAt);
    if ((start === undefined) !== (end === undefined)) {
      setFormError("Indica el inicio y el fin, o deja los dos vacíos.");
      return;
    }
    if (start !== undefined && end !== undefined && start >= end) {
      setFormError("El fin debe ser posterior al inicio.");
      return;
    }
    void run({ endsAt: end, startsAt: start });
  }

  return (
    <Page
      title="Evento"
      description="Mientras la hackathon no esté en marcha, los participantes solo pueden editar su perfil y ver el directorio. Nada más funciona, tampoco desde la CLI. Los admins no tienen restricciones."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Ventana de la hackathon
            <Badge
              variant={current.phase === "during" ? "gold" : "default"}
              className="whitespace-nowrap"
            >
              {PHASE_LABEL[current.phase]}
            </Badge>
          </CardTitle>
          <CardDescription>
            {scheduled && current.startsAt !== undefined && current.endsAt !== undefined
              ? `Del ${formatEventDate(current.startsAt)} al ${formatEventDate(current.endsAt)} (hora de Madrid).`
              : "Sin ventana: todo está abierto hasta que guardes un inicio y un fin."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Empieza"
              htmlFor="event-starts"
              hint={`Hora local de tu navegador (${timeZone}).`}
            >
              <Input
                id="event-starts"
                type="datetime-local"
                value={startsAt}
                disabled={pending}
                onChange={(event) => {
                  onSaved(false);
                  setStartsAt(event.target.value);
                }}
              />
            </Field>
            <Field
              label="Termina"
              htmlFor="event-ends"
              hint="A partir de esta hora se cierra todo salvo el perfil y el directorio."
            >
              <Input
                id="event-ends"
                type="datetime-local"
                value={endsAt}
                disabled={pending}
                onChange={(event) => {
                  onSaved(false);
                  setEndsAt(event.target.value);
                }}
              />
            </Field>
          </div>
          <FormError message={formError} />
          {saved && !dirty ? (
            <p className="text-sm text-hs-brown">Ventana guardada.</p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={!dirty || pending}
              onClick={submit}
            >
              {pending ? "Guardando…" : "Guardar ventana"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={!scheduled || pending}
              onClick={() => void run({})}
            >
              Quitar la ventana
            </Button>
          </div>
        </CardContent>
      </Card>
    </Page>
  );
}
