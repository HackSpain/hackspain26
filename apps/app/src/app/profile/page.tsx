"use client";

import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  CircleUserRound,
  Github,
  MapPin,
  Phone,
  Save,
  Utensils,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import { useGithubLink } from "@/components/github-link-banner";
import {
  errorMessage,
  Field,
  FormError,
  LoadingText,
  Page,
} from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, phoneVerifyMessage } from "@/lib/utils";

type Profile = NonNullable<FunctionReturnType<typeof api.users.me>>;

function useProfileAction() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<string>) {
    if (pending) {
      return;
    }
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      setMessage(await action());
    } catch (caughtError: unknown) {
      setError(
        errorMessage(
          caughtError,
          "No hemos podido guardar el cambio. Inténtalo de nuevo."
        )
      );
    } finally {
      setPending(false);
    }
  }

  function clearFeedback() {
    setMessage(null);
    setError(null);
  }

  return { clearFeedback, error, message, pending, run };
}

function Feedback({
  action,
  hideMessage = false,
}: {
  action: ReturnType<typeof useProfileAction>;
  hideMessage?: boolean;
}) {
  return (
    <>
      <FormError message={action.error} />
      <div role="status" aria-live="polite" aria-atomic="true">
        {action.message && !hideMessage ? (
          <p className="flex items-start gap-2 text-sm text-hs-navy">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {action.message}
          </p>
        ) : null}
      </div>
    </>
  );
}

function ProfileSection({
  id,
  title,
  description,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <Card className="gap-5 py-5 sm:py-6">
        <CardHeader className="flex items-start gap-3 px-5 sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center border-2 border-hs-ink/15 bg-hs-sand/60">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id={id} className="text-base leading-snug">
              {title}
            </h2>
            <p className="text-sm leading-relaxed text-hs-brown">
              {description}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-5 sm:px-6">{children}</CardContent>
      </Card>
    </section>
  );
}

function AttendanceCard({ status }: { status: Profile["attendanceStatus"] }) {
  const setAttendance = useMutation(api.users.setAttendance);
  const action = useProfileAction();
  const attending = status === "attending";
  const cancelled = status === "cancelled";

  return (
    <ProfileSection
      id="attendance-heading"
      title="Tu asistencia"
      description="Mantén al equipo al día sobre tus planes."
      icon={CheckCircle2}
    >
      <div
        className={cn(
          "border-l-[3px] p-3",
          attending
            ? "border-hs-teal bg-hs-teal/10"
            : "border-hs-orange bg-hs-orange/10"
        )}
      >
        <p className="font-semibold">
          {attending
            ? "¡Contamos contigo!"
            : cancelled
              ? "Has cancelado tu asistencia"
              : "Confirma si vas a venir"}
        </p>
        <p className="mt-1 text-sm text-hs-brown">
          {attending
            ? "Nos vemos en HackSpain."
            : "Puedes actualizar tu asistencia aquí."}
        </p>
      </div>
      <div
        className="grid grid-cols-2 gap-2"
        role="group"
        aria-label="Asistencia a HackSpain"
      >
        <Button
          type="button"
          size="sm"
          variant={attending ? "teal" : "outline"}
          aria-pressed={attending}
          disabled={action.pending}
          onClick={() =>
            void action.run(async () => {
              await setAttendance({ attendanceStatus: "attending" });
              return "Asistencia confirmada.";
            })
          }
        >
          <Check aria-hidden /> Asistiré
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(cancelled && "bg-hs-sand")}
          aria-pressed={cancelled}
          disabled={action.pending}
          onClick={() =>
            void action.run(async () => {
              await setAttendance({ attendanceStatus: "cancelled" });
              return "Asistencia cancelada.";
            })
          }
        >
          <X aria-hidden /> No podré ir
        </Button>
      </div>
      <Feedback action={action} />
    </ProfileSection>
  );
}

function GithubCard({
  linked,
  username,
}: {
  linked: boolean;
  username?: string;
}) {
  const { link, pending, error } = useGithubLink();
  const unlink = useMutation(api.github.unlink);
  const action = useProfileAction();

  return (
    <ProfileSection
      id="github-heading"
      title="GitHub"
      description="Conecta tu cuenta para que tu equipo pueda encontrarte."
      icon={Github}
    >
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-hs-ink/15 pb-4">
        <p className="min-w-0 break-all font-semibold">
          {linked && username ? `@${username}` : "Tu cuenta de GitHub"}
        </p>
        <span
          className={cn(
            "shrink-0 px-2 py-1 text-xs font-semibold",
            linked ? "bg-hs-teal/15 text-hs-navy" : "bg-hs-sand text-hs-brown"
          )}
        >
          {linked ? "Vinculada" : "Sin vincular"}
        </span>
      </div>
      <FormError message={error} />
      <Button
        type="button"
        className="w-full"
        variant={linked ? "outline" : "default"}
        disabled={pending || action.pending}
        onClick={() => void link()}
      >
        {pending
          ? "Abriendo GitHub…"
          : linked
            ? "Volver a vincular"
            : "Vincular GitHub"}
        <ArrowUpRight aria-hidden />
      </Button>
      {linked ? (
        <button
          type="button"
          className="min-h-11 text-sm text-hs-brown underline decoration-hs-brown/40 underline-offset-4 disabled:opacity-50"
          disabled={pending || action.pending}
          onClick={() =>
            void action.run(async () => {
              await unlink({});
              return "Cuenta de GitHub desvinculada.";
            })
          }
        >
          {action.pending ? "Desvinculando…" : "Desvincular cuenta"}
        </button>
      ) : null}
      <Feedback action={action} />
    </ProfileSection>
  );
}

function EventDetailsCard({ me }: { me: Profile }) {
  const updateEventDetails = useMutation(api.users.updateEventDetails);
  const action = useProfileAction();
  const [dietaryDraft, setDietaryDraft] = useState<string | undefined>();
  const [dietaryDetailsDraft, setDietaryDetailsDraft] = useState<
    string | undefined
  >();
  const [travelDraft, setTravelDraft] = useState<string | undefined>();
  const dietaryRestrictions = dietaryDraft ?? me.dietaryRestrictions ?? "";
  const dietaryDetails = dietaryDetailsDraft ?? me.dietaryDetails ?? "";
  const travelOrigin = travelDraft ?? me.travelOrigin ?? "";
  const hasChanges =
    dietaryRestrictions !== (me.dietaryRestrictions ?? "") ||
    dietaryDetails !== (me.dietaryDetails ?? "") ||
    travelOrigin !== (me.travelOrigin ?? "");

  return (
    <ProfileSection
      id="event-details-heading"
      title="Dieta y viaje"
      description="Los pequeños detalles para preparar tu llegada."
      icon={Utensils}
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void action.run(async () => {
            await updateEventDetails({
              dietaryDetails: dietaryDetails || undefined,
              dietaryRestrictions,
              travelOrigin,
            });
            setDietaryDraft(undefined);
            setDietaryDetailsDraft(undefined);
            setTravelDraft(undefined);
            return "Dieta y viaje guardados.";
          });
        }}
      >
        <fieldset className="min-w-0 space-y-5" disabled={action.pending}>
          <Field label="Restricciones alimentarias" htmlFor="dietary">
            <Input
              id="dietary"
              required
              placeholder="Ninguna, vegetariano, vegano, alergias…"
              value={dietaryRestrictions}
              onChange={(event) => setDietaryDraft(event.target.value)}
            />
          </Field>
          <Field label="Detalles de dieta (opcional)" htmlFor="dietary-details">
            <Textarea
              id="dietary-details"
              rows={3}
              placeholder="Cuéntanos si hay algo más que debamos tener en cuenta."
              value={dietaryDetails}
              onChange={(event) => setDietaryDetailsDraft(event.target.value)}
            />
          </Field>
          <div className="border-t border-hs-ink/15 pt-5">
            <Field label="¿Desde dónde viajas?" htmlFor="travel-origin">
              <div className="relative">
                <MapPin
                  className="pointer-events-none absolute top-3.5 left-3 size-4 text-hs-brown"
                  aria-hidden
                />
                <Input
                  id="travel-origin"
                  className="pl-10"
                  required
                  autoComplete="address-level2"
                  placeholder="Ciudad o región"
                  value={travelOrigin}
                  onChange={(event) => setTravelDraft(event.target.value)}
                />
              </div>
            </Field>
          </div>
        </fieldset>
        <div className="flex flex-col gap-3 border-t border-hs-ink/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-hs-brown">
            {hasChanges
              ? "Tienes cambios sin guardar."
              : "Sin cambios pendientes."}
          </p>
          <Button
            type="submit"
            disabled={action.pending || !hasChanges}
            className="w-full sm:w-auto"
          >
            <Save aria-hidden />{" "}
            {action.pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
        <Feedback action={action} hideMessage={hasChanges} />
      </form>
    </ProfileSection>
  );
}

function PhoneCard({ me }: { me: Profile }) {
  const requestPhoneCode = useMutation(api.onboarding.requestPhoneCode);
  const verifyPhoneCode = useMutation(api.onboarding.verifyPhoneCode);
  const action = useProfileAction();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [sentPhone, setSentPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const showForm = editing || !me.phoneConfirmed;

  return (
    <ProfileSection
      id="phone-heading"
      title="Teléfono"
      description="Un número de contacto para el evento."
      icon={Phone}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 bg-hs-sand/50 p-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-hs-brown">Número actual</p>
          <p className="break-all text-base font-semibold tabular-nums">
            {me.phone || "Sin número"}
          </p>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs font-semibold",
            me.phoneConfirmed ? "text-hs-navy" : "text-hs-brown"
          )}
        >
          {me.phoneConfirmed ? (
            <CheckCircle2 className="size-4" aria-hidden />
          ) : null}
          {me.phoneConfirmed ? "Verificado" : "Sin verificar"}
        </span>
      </div>
      {showForm ? (
        <>
          {sentPhone ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void action.run(async () => {
                  const result = await verifyPhoneCode({ code });
                  if (!result.ok) {
                    throw new Error(phoneVerifyMessage(result.reason));
                  }
                  setCode("");
                  setPhone("");
                  setSentPhone(null);
                  setDebugCode(null);
                  setEditing(false);
                  return "Teléfono verificado y actualizado.";
                });
              }}
            >
              <p className="text-sm text-hs-brown">
                Introduce el código para{" "}
                <span className="font-semibold break-all text-hs-ink">
                  {sentPhone}
                </span>
                . Caduca en 10 minutos.
              </p>
              {debugCode ? (
                <p className="border border-hs-navy/30 bg-hs-slate/20 p-3 text-sm text-hs-navy">
                  Código de prueba:{" "}
                  <span className="font-mono font-bold">{debugCode}</span>
                </p>
              ) : null}
              <Field label="Código de confirmación" htmlFor="phone-code">
                <Input
                  id="phone-code"
                  className="max-w-60 font-mono text-lg tracking-[0.3em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  placeholder="000000"
                  disabled={action.pending}
                  onChange={(event) =>
                    setCode(event.target.value.replaceAll(/\D/g, ""))
                  }
                />
              </Field>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="submit"
                  disabled={action.pending || code.length !== 6}
                >
                  {action.pending ? "Verificando…" : "Confirmar teléfono"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={action.pending}
                  onClick={() => {
                    action.clearFeedback();
                    setSentPhone(null);
                    setCode("");
                    setDebugCode(null);
                  }}
                >
                  Volver a enviar
                </Button>
              </div>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void action.run(async () => {
                  const result = await requestPhoneCode({ phone });
                  setDebugCode(result.debugCode ?? null);
                  setSentPhone(phone);
                  setCode("");
                  return result.delivery === "stub"
                    ? "Código de prueba generado."
                    : "Código de confirmación solicitado.";
                });
              }}
            >
              <Field
                label={
                  me.phoneConfirmed ? "Nuevo número" : "Número de teléfono"
                }
                htmlFor="phone"
              >
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  autoFocus={editing}
                  required
                  placeholder="+34 600 111 222"
                  aria-describedby="phone-hint"
                  value={phone}
                  disabled={action.pending}
                  onChange={(event) => setPhone(event.target.value)}
                />
                <p id="phone-hint" className="text-xs text-hs-brown">
                  Incluye el prefijo de tu país, por ejemplo +34.
                </p>
              </Field>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={action.pending || !phone.trim()}
                >
                  {action.pending ? "Solicitando código…" : "Enviar código"}
                </Button>
                {me.phoneConfirmed ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={action.pending}
                    onClick={() => {
                      action.clearFeedback();
                      setEditing(false);
                    }}
                  >
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </form>
          )}
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => {
            action.clearFeedback();
            setEditing(true);
          }}
        >
          Cambiar número
        </Button>
      )}
      <Feedback action={action} />
    </ProfileSection>
  );
}

function NotificationsCard({ consent }: { consent: boolean }) {
  const setConsent = useMutation(api.users.setNotificationConsent);
  const action = useProfileAction();

  return (
    <ProfileSection
      id="notifications-heading"
      title="Avisos del evento"
      description="Tú eliges si quieres recibirlos."
      icon={Bell}
    >
      <div className="flex items-start gap-3 border border-hs-ink/15 bg-hs-sand/30 p-4">
        <Checkbox
          aria-labelledby="notification-consent-label"
          className="mt-0.5"
          checked={consent}
          disabled={action.pending}
          onCheckedChange={(value) =>
            void action.run(async () => {
              await setConsent({ consent: value === true });
              return value === true
                ? "Avisos activados."
                : "Avisos desactivados.";
            })
          }
        />
        <span className="space-y-1">
          <span id="notification-consent-label" className="block font-semibold">
            Recibir avisos operativos
          </span>
          <span className="block text-sm leading-relaxed text-hs-brown">
            Comunicaciones de la organización sobre HackSpain.
          </span>
        </span>
      </div>
      <Feedback action={action} />
    </ProfileSection>
  );
}

export default function ProfilePage() {
  const me = useQuery(api.users.me);
  if (!me) {
    return <LoadingText />;
  }

  const initials = me.name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <Page className="[&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-4 [&_button]:focus-visible:outline-hs-navy">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-hs-brown underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hs-navy"
      >
        <ArrowLeft className="size-4" aria-hidden /> Volver al inicio
      </Link>
      <div className="overflow-hidden border-[3px] border-hs-ink">
        <div className="flex items-center justify-between gap-4 bg-hs-navy px-5 py-3 text-hs-paper sm:px-7">
          <h1 className="text-lg sm:text-xl">Mi perfil</h1>
          <span className="font-bungee text-xs text-hs-gold">HackSpain</span>
        </div>
        <div className="flex flex-col gap-5 bg-hs-sand/50 p-5 sm:flex-row sm:items-center sm:p-7">
          <div
            className="flex size-16 shrink-0 items-center justify-center border-[3px] border-hs-ink bg-hs-gold font-bungee text-2xl shadow-[4px_4px_0_var(--color-hs-ink)] sm:size-20"
            aria-hidden
          >
            {initials || <CircleUserRound className="size-8" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bungee text-xl leading-tight break-words sm:text-2xl">
              {me.name || "Tu cuenta"}
            </p>
            {me.email ? (
              <p className="mt-2 text-sm break-all text-hs-brown">{me.email}</p>
            ) : null}
            <p className="mt-3 text-sm text-hs-brown">
              Tu asistencia, tus preferencias y todo listo para el evento.
            </p>
          </div>
        </div>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-6">
        <div className="min-w-0 space-y-5 lg:space-y-6">
          <EventDetailsCard me={me} />
          <PhoneCard me={me} />
        </div>
        <div className="min-w-0 space-y-5 lg:space-y-6">
          <AttendanceCard status={me.attendanceStatus} />
          <GithubCard linked={me.githubLinked} username={me.githubUsername} />
          <NotificationsCard consent={me.notificationConsent} />
        </div>
      </div>
    </Page>
  );
}
