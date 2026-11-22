"use client";

import { useMutation, useQuery } from "convex/react";
import { Suspense, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { AdminEventControls } from "@/components/admin-event-controls";
import { AdminTabs, useAdminTab } from "@/components/admin/admin-tabs";
import { AvisosPanel } from "@/components/admin/avisos-panel";
import { useAdminEdition } from "@/components/admin/use-admin-edition";
import type { EventPhase } from "@convex/lib/eventWindow";
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
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatEventDate,
  fromDatetimeLocal,
  toDatetimeLocal,
} from "@/lib/utils";

const PHASE_LABEL: Record<EventPhase, string> = {
  after: "Terminado",
  before: "Antes del evento",
  during: "En marcha",
  unscheduled: "Sin programar",
};

type Calendar = FunctionReturnType<typeof api.settings.adminCalendar>;

export default function AdminEventPage() {
  return (
    <Suspense fallback={<LoadingText />}>
      <AdminEvent />
    </Suspense>
  );
}

function AdminEvent() {
  const tab = useAdminTab("calendario");
  if (tab === "accesos") {
    return (
      <Page title="Evento">
        <EventTabs />
        <AdminEventControls />
      </Page>
    );
  }
  if (tab === "avisos") {
    return (
      <Page title="Evento">
        <EventTabs />
        <AvisosPanel />
      </Page>
    );
  }
  return <AdminEventCalendar />;
}

function EventTabs() {
  return (
    <AdminTabs
      defaultTab="calendario"
      tabs={[
        { value: "calendario", label: "Calendario" },
        { value: "accesos", label: "Accesos" },
        { value: "avisos", label: "Avisos" },
      ]}
    />
  );
}

function AdminEventCalendar() {
  const { editionId, ready } = useAdminEdition();
  const current = useQuery(
    api.settings.adminCalendar,
    ready && editionId ? { editionId } : "skip"
  );
  const [saved, setSaved] = useState(false);
  if (!current) {
    return (
      <Page title="Evento">
        <EventTabs />
        <LoadingText />
      </Page>
    );
  }
  return (
    <CalendarForm
      key={`${current.slug}-${current.eventStartsAt ?? ""}-${current.eventEndsAt ?? ""}-${current.applicationsOpensAt ?? ""}-${current.submitOpensAt ?? ""}`}
      current={current}
      editionId={editionId}
      saved={saved}
      onSaved={setSaved}
    />
  );
}

function CalendarForm({
  current,
  editionId,
  saved,
  onSaved,
}: {
  current: Calendar;
  editionId: Id<"editions"> | undefined;
  saved: boolean;
  onSaved: (saved: boolean) => void;
}) {
  const save = useMutation(api.settings.adminSaveCalendar);
  const [applicationsOpensAt, setApplicationsOpensAt] = useState(
    toDatetimeLocal(current.applicationsOpensAt)
  );
  const [applicationsWaitlistFrom, setApplicationsWaitlistFrom] = useState(
    toDatetimeLocal(current.applicationsWaitlistFrom)
  );
  const [applicationsClosesAt, setApplicationsClosesAt] = useState(
    toDatetimeLocal(current.applicationsClosesAt)
  );
  const [applicationsMode, setApplicationsMode] = useState(
    current.applicationsMode
  );
  const [eventStartsAt, setEventStartsAt] = useState(
    toDatetimeLocal(current.eventStartsAt)
  );
  const [eventEndsAt, setEventEndsAt] = useState(
    toDatetimeLocal(current.eventEndsAt)
  );
  const [checkInOpensAt, setCheckInOpensAt] = useState(
    toDatetimeLocal(current.checkInOpensAt)
  );
  const [submitOpensAt, setSubmitOpensAt] = useState(
    toDatetimeLocal(current.submitOpensAt)
  );
  const [submitClosesAt, setSubmitClosesAt] = useState(
    toDatetimeLocal(current.submitClosesAt)
  );
  const [submissionsMode, setSubmissionsMode] = useState(
    current.submissionsMode
  );
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const scheduled =
    current.eventStartsAt !== undefined && current.eventEndsAt !== undefined;

  async function persist(next: Parameters<typeof save>[0]) {
    if (pending) {
      return;
    }
    setPending(true);
    setFormError(null);
    onSaved(false);
    try {
      await save(next);
      onSaved(true);
    } catch (error: unknown) {
      setFormError(errorMessage(error, "No se pudo guardar el calendario."));
    } finally {
      setPending(false);
    }
  }

  function submit() {
    void persist({
      applicationsClosesAt: fromDatetimeLocal(applicationsClosesAt),
      applicationsMode,
      applicationsOpensAt: fromDatetimeLocal(applicationsOpensAt),
      applicationsWaitlistFrom: fromDatetimeLocal(applicationsWaitlistFrom),
      checkInOpensAt: fromDatetimeLocal(checkInOpensAt),
      editionId,
      eventEndsAt: fromDatetimeLocal(eventEndsAt),
      eventStartsAt: fromDatetimeLocal(eventStartsAt),
      submissionsMode,
      submitClosesAt: fromDatetimeLocal(submitClosesAt),
      submitOpensAt: fromDatetimeLocal(submitOpensAt),
    });
  }

  return (
    <Page
      title="Evento"
      description="Horas en Europe/Madrid al guardar. Vacío = sin programar. Las inscripciones vacías quedan cerradas; el fin de semana vacío queda abierto."
    >
      <EventTabs />
      <Card>
        <CardHeader>
          <CardTitle>Inscripciones</CardTitle>
          <CardDescription>
            Antes de abrir o después de cerrar, la landing responde 410. Tras la
            hora de lista de espera las solicitudes entran como waitlist.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Abre" htmlFor="apps-open">
              <Input
                id="apps-open"
                type="datetime-local"
                value={applicationsOpensAt}
                disabled={pending}
                onChange={(event) => setApplicationsOpensAt(event.target.value)}
              />
            </Field>
            <Field label="Lista de espera desde" htmlFor="apps-waitlist">
              <Input
                id="apps-waitlist"
                type="datetime-local"
                value={applicationsWaitlistFrom}
                disabled={pending}
                onChange={(event) =>
                  setApplicationsWaitlistFrom(event.target.value)
                }
              />
            </Field>
            <Field label="Cierra" htmlFor="apps-close">
              <Input
                id="apps-close"
                type="datetime-local"
                value={applicationsClosesAt}
                disabled={pending}
                onChange={(event) =>
                  setApplicationsClosesAt(event.target.value)
                }
              />
            </Field>
            <Field label="Forzar" htmlFor="apps-mode">
              <Select
                value={applicationsMode}
                onValueChange={(value) =>
                  setApplicationsMode(value as Calendar["applicationsMode"])
                }
              >
                <SelectTrigger id="apps-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Según fechas</SelectItem>
                  <SelectItem value="open">Abiertas</SelectItem>
                  <SelectItem value="waitlist">Lista de espera</SelectItem>
                  <SelectItem value="closed">Cerradas</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Fin de semana
            <Badge
              variant={current.eventPhase === "during" ? "gold" : "default"}
              className="whitespace-nowrap"
            >
              {PHASE_LABEL[current.eventPhase]}
            </Badge>
          </CardTitle>
          <CardDescription>
            {scheduled &&
            current.eventStartsAt !== undefined &&
            current.eventEndsAt !== undefined
              ? `Del ${formatEventDate(current.eventStartsAt)} al ${formatEventDate(current.eventEndsAt)} (hora de Madrid).`
              : "Sin ventana: el dashboard y la CLI siguen abiertos."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Empieza"
            htmlFor="event-starts"
            hint={`Hora local de tu navegador (${timeZone}).`}
          >
            <Input
              id="event-starts"
              type="datetime-local"
              value={eventStartsAt}
              disabled={pending}
              onChange={(event) => setEventStartsAt(event.target.value)}
            />
          </Field>
          <Field label="Termina" htmlFor="event-ends">
            <Input
              id="event-ends"
              type="datetime-local"
              value={eventEndsAt}
              disabled={pending}
              onChange={(event) => setEventEndsAt(event.target.value)}
            />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Check-in y envíos</CardTitle>
          <CardDescription>
            Check-in vacío = se puede escanear. Envíos en automático usan las
            fechas; vacío cierra.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Check-in abre" htmlFor="checkin-opens">
            <Input
              id="checkin-opens"
              type="datetime-local"
              value={checkInOpensAt}
              disabled={pending}
              onChange={(event) => setCheckInOpensAt(event.target.value)}
            />
          </Field>
          <Field label="Envíos" htmlFor="submit-mode">
            <Select
              value={submissionsMode}
              onValueChange={(value) =>
                setSubmissionsMode(value as Calendar["submissionsMode"])
              }
            >
              <SelectTrigger id="submit-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Según fechas</SelectItem>
                <SelectItem value="on">Abiertos</SelectItem>
                <SelectItem value="off">Cerrados</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Envíos abren" htmlFor="submit-opens">
            <Input
              id="submit-opens"
              type="datetime-local"
              value={submitOpensAt}
              disabled={pending}
              onChange={(event) => setSubmitOpensAt(event.target.value)}
            />
          </Field>
          <Field label="Envíos cierran" htmlFor="submit-closes">
            <Input
              id="submit-closes"
              type="datetime-local"
              value={submitClosesAt}
              disabled={pending}
              onChange={(event) => setSubmitClosesAt(event.target.value)}
            />
          </Field>
        </CardContent>
      </Card>
      <FormError message={formError} />
      {saved ? (
        <p className="text-sm text-hs-brown">Calendario guardado.</p>
      ) : null}
      <Button
        type="button"
        className="w-full sm:w-auto"
        disabled={pending}
        onClick={submit}
      >
        {pending ? "Guardando…" : "Guardar calendario"}
      </Button>
    </Page>
  );
}
