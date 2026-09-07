import {
  addBreadcrumb,
  captureException,
  captureMessage,
  getCurrentScope,
  startSpan,
  withScope,
} from "@sentry/astro";
import { initBotId } from "botid/client/core";
import type { ComponentPropsWithRef } from "react";
import { useEffect, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { ATTENDANCE_COMPANIES } from "../../data/attendance-companies";
import { HACKSPAIN_SOCIAL_URLS } from "../../data/landing-meta";
import type { AttendanceSlotId } from "../../lib/mentor-sponsor-validation";
import {
  ATTENDANCE_DAY_OPTIONS,
  ATTENDANCE_MEAL_OPTIONS,
  parseMentorSponsorBody,
} from "../../lib/mentor-sponsor-validation";
import type { DietaryRestrictionId } from "../../lib/signup-validation";
import { DIETARY_RESTRICTION_OPTIONS } from "../../lib/signup-validation";
import { hsControlBaseClass } from "../form/field-classes";
import { FormField } from "../form/form-field";
import { Input } from "../form/input";
import { Textarea } from "../form/textarea";
import { MosaicBackground } from "../mosaic/mosaic-background";
import { useLayoutProfile } from "../mosaic/use-layout-profile";
import { X_SVG } from "../theme/constants";
import { Button, ButtonLink } from "../ui/button";

const OTHER_COMPANY_ID = "__other__";

type FlowStatus = "idle" | "success" | "error" | "alreadyConfirmed";

/** Same brutalist checkbox as the hacker signup form (kept local there too). */
function HackSpainCheckbox({
  size = "default",
  ...inputProps
}: Omit<ComponentPropsWithRef<"input">, "type" | "size"> & {
  size?: "default" | "large";
}) {
  const isLarge = size === "large";
  const sizeClass = isLarge ? "h-6 w-6" : "h-4 w-4";
  const borderClass = isLarge
    ? "border-[3px] shadow-[2px_2px_0_0_var(--color-hs-ink)]"
    : "border-2";

  return (
    <span className={`relative mt-px ${sizeClass} shrink-0`}>
      <input
        {...inputProps}
        className={`peer absolute inset-0 z-10 ${sizeClass} cursor-pointer appearance-none opacity-0`}
        type="checkbox"
      />
      <span
        aria-hidden
        className={`pointer-events-none flex ${sizeClass} items-center justify-center rounded-sm border-hs-ink bg-hs-paper ${borderClass} transition-colors peer-checked:bg-hs-gold peer-hover:bg-hs-sand/55 peer-focus-visible:border-hs-navy [&_svg]:opacity-0 peer-checked:[&_svg]:opacity-100`}
      >
        <svg
          fill="none"
          height={isLarge ? 14 : 10}
          viewBox="0 0 14 14"
          width={isLarge ? 14 : 10}
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Marca de verificación</title>
          <path
            d="M2.5 7.2 5.6 10.3 11.5 3.8"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={isLarge ? 2.2 : 1.8}
          />
        </svg>
      </span>
    </span>
  );
}

interface FormValues {
  attendanceSlots: AttendanceSlotId[];
  companyChoice: string;
  companyOther: string;
  dietaryDataConsent: boolean;
  dietaryDetails: string;
  dietaryRestrictions: DietaryRestrictionId[];
  email: string;
  firstName: string;
  lastName: string;
  notes: string;
}

const EMPTY_VALUES: FormValues = {
  attendanceSlots: [],
  companyChoice: "",
  companyOther: "",
  dietaryDataConsent: false,
  dietaryDetails: "",
  dietaryRestrictions: [],
  email: "",
  firstName: "",
  lastName: "",
  notes: "",
};

const cellBase = "border-b-[3px] border-hs-ink bg-hs-paper p-4";
const cellLeftSm = `${cellBase} sm:border-r-[3px]`;

const t = {
  alreadyConfirmed:
    "Ya tenemos una confirmación con este correo. Si necesitas cambiar tus días o franjas, escríbenos a contact@hackspain.com.",
  attendanceHint:
    "Marca todas las franjas en las que cuentas con estar. Comida y cena nos sirven para calcular el catering.",
  attendanceTitle: "¿Cuándo estarás?",
  backHome: "Inicio",
  company: "Empresa",
  companyOtherLabel: "¿Cuál?",
  companyOtherOption: "Otra empresa",
  companyPlaceholder: "Elige tu empresa…",
  dietaryDataConsent:
    "Si has indicado una restricción o alergia, consiento expresamente que HackSpain trate estos datos únicamente para organizar comidas seguras y atender mis necesidades durante el evento.",
  dietaryDetails: "Detalles de alergias o restricciones",
  dietaryDetailsHint:
    "Cuéntanos cualquier detalle que debamos conocer para organizar las comidas.",
  dietaryRestrictions: "Restricciones alimentarias",
  dietaryRestrictionsHint: "Puedes marcar varias opciones.",
  email: "Email",
  errorAccessDenied:
    "No hemos podido verificar la solicitud. Recarga la página e inténtalo de nuevo, o usa un navegador normal con JavaScript activado.",
  errorAttendance: "Marca al menos una franja para saber cuándo estarás.",
  errorCompany: "Indica tu empresa.",
  errorDietaryConsent:
    "Debes consentir expresamente el tratamiento de los datos alimentarios que has indicado.",
  errorFirstName: "Indica tu nombre.",
  errorGeneric:
    "No hemos podido registrar tu asistencia. Inténtalo de nuevo en unos minutos o escríbenos a contact@hackspain.com.",
  errorInvalidEmail: "Introduce un correo electrónico válido.",
  errorLastName: "Indica tus apellidos.",
  firstName: "Nombre",
  lastName: "Apellidos",
  notes: "Notas",
  notesHint:
    "Cualquier cosa que debamos saber — horas de llegada o salida, acompañantes, dudas…",
  received:
    "¡Gracias! Hemos registrado tu asistencia y te hemos enviado un correo de confirmación.",
  submit: "Confirmar asistencia",
  submitting: "Enviando…",
  subtitle:
    "Para mentores y sponsors de HackSpain 2026 — 18 a 20 de septiembre, Madrid. Dinos qué días y en qué franjas estarás para que podamos organizar comidas y logística.",
  title: "Confirma tu asistencia",
} as const;

function messageForErrorCode(code: string): string {
  switch (code) {
    case "first_name_required": {
      return t.errorFirstName;
    }
    case "last_name_required": {
      return t.errorLastName;
    }
    case "invalid_email": {
      return t.errorInvalidEmail;
    }
    case "company_required": {
      return t.errorCompany;
    }
    case "attendance_required": {
      return t.errorAttendance;
    }
    case "dietary_consent_required": {
      return t.errorDietaryConsent;
    }
    default: {
      return t.errorGeneric;
    }
  }
}

export function MentorSponsorPage() {
  const profile = useLayoutProfile();

  const { register, handleSubmit, control, watch, formState } =
    useForm<FormValues>({ defaultValues: { ...EMPTY_VALUES } });
  const { isSubmitting } = formState;
  const companyChoice = watch("companyChoice");
  const dietaryRestrictions = watch("dietaryRestrictions");
  const dietaryDetails = watch("dietaryDetails");
  const hasDietaryData =
    dietaryRestrictions.length > 0 || dietaryDetails.trim().length > 0;

  const [status, setStatus] = useState<FlowStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (import.meta.env.DEV) {
      return;
    }
    initBotId({
      protect: [{ method: "POST", path: "/api/mentor-sponsor-signup" }],
    });
  }, []);

  useEffect(() => {
    getCurrentScope().setTag("flow", "mentor-sponsor-signup");
  }, []);

  const onSubmitForm: SubmitHandler<FormValues> = async (data) => {
    setErrorMessage("");

    addBreadcrumb({
      category: "ui",
      level: "info",
      message: "mentor-sponsor: submit",
    });

    const company =
      data.companyChoice === OTHER_COMPANY_ID
        ? data.companyOther.trim()
        : data.companyChoice;
    const payload = {
      attendanceSlots: data.attendanceSlots,
      company,
      dietaryDataConsent: data.dietaryDataConsent,
      dietaryDetails: data.dietaryDetails,
      dietaryRestrictions: data.dietaryRestrictions,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      notes: data.notes,
    };

    const parsed = parseMentorSponsorBody(payload);
    if (!parsed.ok) {
      addBreadcrumb({
        category: "mentor-sponsor",
        data: { code: parsed.error },
        level: "info",
        message: "client validation",
      });
      setErrorMessage(messageForErrorCode(parsed.error));
      setStatus("error");
      return;
    }

    try {
      const res = await startSpan(
        { name: "POST /api/mentor-sponsor-signup", op: "http.client" },
        async (span) => {
          const r = await fetch("/api/mentor-sponsor-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Same shape as `parseMentorSponsorBody` on the server.
            body: JSON.stringify(payload),
          });
          span.setAttribute("http.status_code", r.status);
          return r;
        }
      );
      const resJson = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (res.ok) {
        setStatus("success");
        return;
      }
      if (resJson.error === "duplicate_email" || res.status === 409) {
        addBreadcrumb({
          category: "http",
          data: { error: resJson.error, status: res.status },
          level: "info",
          message: "mentor-sponsor duplicate email (expected)",
          type: "http",
        });
        setStatus("alreadyConfirmed");
        return;
      }
      addBreadcrumb({
        category: "http",
        data: { error: resJson.error, status: res.status },
        level: "error",
        type: "http",
      });
      withScope((scope) => {
        scope.setTag("flow", "mentor-sponsor-signup");
        scope.setTag("source", "client");
        scope.setTag("http_status", String(res.status));
        if (resJson.error) {
          scope.setTag("api_error", resJson.error);
        }
        captureMessage(
          `Mentor/sponsor signup: API rejected ${res.status}${resJson.error ? ` (${resJson.error})` : ""}`,
          "error"
        );
      });
      if (res.status === 403) {
        setErrorMessage(t.errorAccessDenied);
      } else if (resJson.error) {
        setErrorMessage(messageForErrorCode(resJson.error));
      } else {
        setErrorMessage(t.errorGeneric);
      }
      setStatus("error");
    } catch (error) {
      if (error instanceof Error) {
        withScope((scope) => {
          scope.setTag("flow", "mentor-sponsor-signup");
          scope.setTag("source", "client");
          captureException(error);
        });
      }
      setErrorMessage(t.errorGeneric);
      setStatus("error");
    }
  };

  const showFinalPanel = status === "success" || status === "alreadyConfirmed";
  const finalPanelMessage =
    status === "alreadyConfirmed" ? t.alreadyConfirmed : t.received;

  return (
    <div className="relative z-0 min-h-dvh w-full">
      <MosaicBackground
        className="pointer-events-none fixed inset-0 -z-10 hidden h-full min-h-dvh w-full sm:block"
        variant={profile ?? "desktop"}
      />
      <div className="relative z-0 mx-auto max-w-4xl px-0 pb-0 sm:px-4 sm:pb-10">
        <div className="grid grid-cols-1 gap-0 border-hs-ink bg-hs-ink sm:border-[3px]">
          <div className="border-hs-ink border-b-[3px] bg-hs-teal px-4 py-5">
            <h1 className="font-bungee text-2xl text-hs-paper leading-tight sm:text-3xl">
              {t.title}
            </h1>
            <p className="mt-2 max-w-xl font-sans font-semibold text-base text-hs-paper leading-snug sm:text-lg">
              {t.subtitle}
            </p>
          </div>

          <div className="bg-hs-paper">
            {showFinalPanel ? (
              <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-8 border-hs-ink border-t-[3px] bg-gradient-to-b from-hs-paper/90 to-hs-sand/50 px-6 py-12 text-center sm:min-h-[min(48vh,480px)] sm:px-10 sm:py-16">
                <img
                  alt=""
                  className="h-auto max-h-[min(42vh,300px)] w-[min(88vw,260px)] object-contain object-bottom drop-shadow-[2px_3px_0_var(--color-hs-ink)]"
                  decoding="async"
                  height={320}
                  src="/happy_quijote.png"
                  width={320}
                />
                <div className="flex w-full max-w-lg flex-col items-center gap-8">
                  <p className="font-bold font-sans text-hs-ink text-lg leading-snug sm:text-xl">
                    {finalPanelMessage}
                  </p>
                  <div className="flex w-full flex-row flex-wrap items-center justify-center gap-3 sm:gap-4">
                    <ButtonLink href="/" size="success" variant="gold">
                      {t.backHome}
                    </ButtonLink>
                    <ButtonLink
                      aria-label="Seguir en Twitter a HackSpain"
                      href={HACKSPAIN_SOCIAL_URLS.x}
                      rel="noopener noreferrer"
                      size="success"
                      target="_blank"
                      variant="teal"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-4 w-4 shrink-0"
                          // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted SVG from ./constants
                          dangerouslySetInnerHTML={{ __html: X_SVG }}
                        />
                        Seguir en Twitter a HackSpain
                      </span>
                    </ButtonLink>
                  </div>
                </div>
              </div>
            ) : (
              <form
                className="flex flex-col gap-0 border-hs-ink border-t-[3px]"
                data-sentry-mask
                onSubmit={handleSubmit(onSubmitForm)}
              >
                <div className="grid gap-0 sm:grid-cols-2">
                  <FormField
                    className={cellLeftSm}
                    id="attendance-first-name"
                    label={t.firstName}
                    required
                  >
                    <Input
                      autoComplete="given-name"
                      required
                      {...register("firstName")}
                    />
                  </FormField>
                  <FormField
                    className={cellBase}
                    id="attendance-last-name"
                    label={t.lastName}
                    required
                  >
                    <Input
                      autoComplete="family-name"
                      required
                      {...register("lastName")}
                    />
                  </FormField>
                  <FormField
                    className={cellLeftSm}
                    id="attendance-email"
                    label={t.email}
                    required
                  >
                    <Input
                      autoComplete="email"
                      required
                      type="email"
                      {...register("email")}
                    />
                  </FormField>
                  <FormField
                    className={cellBase}
                    id="attendance-company"
                    label={t.company}
                    required
                  >
                    <select
                      className={`${hsControlBaseClass} cursor-pointer`}
                      required
                      {...register("companyChoice")}
                    >
                      <option disabled value="">
                        {t.companyPlaceholder}
                      </option>
                      {ATTENDANCE_COMPANIES.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      <option value={OTHER_COMPANY_ID}>
                        {t.companyOtherOption}
                      </option>
                    </select>
                  </FormField>
                </div>

                {companyChoice === OTHER_COMPANY_ID ? (
                  <FormField
                    className={cellBase}
                    id="attendance-company-other"
                    label={t.companyOtherLabel}
                    labelVariant="sans"
                    required
                  >
                    <Input
                      autoComplete="organization"
                      required
                      {...register("companyOther")}
                    />
                  </FormField>
                ) : null}

                <div className={cellBase}>
                  <fieldset className="min-w-0 border-0 p-0">
                    <legend className="font-bungee text-hs-ink text-sm tracking-wide">
                      {t.attendanceTitle} *
                    </legend>
                    <p className="mt-1 font-sans text-hs-brown text-sm leading-snug sm:text-[0.95rem]">
                      {t.attendanceHint}
                    </p>
                    <Controller
                      control={control}
                      name="attendanceSlots"
                      render={({ field }) => (
                        <div className="mt-3 flex flex-col gap-3">
                          {ATTENDANCE_DAY_OPTIONS.map((day) => (
                            <div key={day.id}>
                              <p className="font-extrabold font-sans text-hs-ink text-sm sm:text-base">
                                {day.label}
                              </p>
                              <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                                {ATTENDANCE_MEAL_OPTIONS.map((meal) => {
                                  const slotId: AttendanceSlotId = `${day.id}_${meal.id}`;
                                  const checked = field.value.includes(slotId);
                                  return (
                                    <label
                                      className="flex cursor-pointer items-start gap-1.5 rounded-sm border-[3px] border-hs-ink bg-hs-paper px-2 py-1.5 shadow-[2px_2px_0_0_var(--color-hs-ink)] transition-[background-color,box-shadow] hover:bg-hs-sand/40 has-[:focus-visible]:border-hs-navy has-[:checked]:bg-hs-gold/35"
                                      htmlFor={`attendance-slot-${slotId}`}
                                      key={slotId}
                                    >
                                      <HackSpainCheckbox
                                        checked={checked}
                                        id={`attendance-slot-${slotId}`}
                                        name={field.name}
                                        onBlur={field.onBlur}
                                        onChange={(event) => {
                                          const next = event.target.checked
                                            ? [...field.value, slotId]
                                            : field.value.filter(
                                                (value) => value !== slotId
                                              );
                                          field.onChange(next);
                                        }}
                                      />
                                      <span className="min-w-0 font-sans font-semibold text-hs-ink text-xs leading-tight sm:text-sm">
                                        {meal.label}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    />
                  </fieldset>
                </div>

                <div className={cellBase} data-sentry-block>
                  <fieldset className="min-w-0 border-0 p-0">
                    <legend className="font-bungee text-hs-ink text-sm tracking-wide">
                      {t.dietaryRestrictions}
                    </legend>
                    <p className="mt-1 font-sans text-hs-brown text-sm leading-snug sm:text-[0.95rem]">
                      {t.dietaryRestrictionsHint}
                    </p>
                    <Controller
                      control={control}
                      name="dietaryRestrictions"
                      render={({ field }) => (
                        <div className="mt-3 grid grid-cols-2 gap-1.5 md:grid-cols-4 min-[520px]:grid-cols-3">
                          {DIETARY_RESTRICTION_OPTIONS.map((option) => {
                            const checked = field.value.includes(option.id);
                            return (
                              <label
                                className="flex cursor-pointer items-start gap-1.5 rounded-sm border-[3px] border-hs-ink bg-hs-paper px-2 py-1.5 shadow-[2px_2px_0_0_var(--color-hs-ink)] transition-[background-color,box-shadow] hover:bg-hs-sand/40 has-[:focus-visible]:border-hs-navy has-[:checked]:bg-hs-gold/35"
                                htmlFor={`attendance-dietary-${option.id}`}
                                key={option.id}
                              >
                                <HackSpainCheckbox
                                  checked={checked}
                                  id={`attendance-dietary-${option.id}`}
                                  name={field.name}
                                  onBlur={field.onBlur}
                                  onChange={(event) => {
                                    const next = event.target.checked
                                      ? [...field.value, option.id]
                                      : field.value.filter(
                                          (value) => value !== option.id
                                        );
                                    field.onChange(next);
                                  }}
                                />
                                <span className="min-w-0 font-sans font-semibold text-hs-ink text-xs leading-tight sm:text-sm">
                                  {option.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    />
                  </fieldset>
                </div>

                <FormField
                  className={cellBase}
                  hint={t.dietaryDetailsHint}
                  id="attendance-dietary-details"
                  label={t.dietaryDetails}
                >
                  <Textarea
                    className="min-h-[90px] resize-y"
                    data-sentry-block
                    rows={3}
                    {...register("dietaryDetails")}
                  />
                </FormField>

                {hasDietaryData ? (
                  <div className={cellBase} data-sentry-block>
                    <label
                      className="flex cursor-pointer items-start gap-3"
                      htmlFor="attendance-dietary-data-consent"
                    >
                      <HackSpainCheckbox
                        id="attendance-dietary-data-consent"
                        required
                        size="large"
                        {...register("dietaryDataConsent")}
                      />
                      <span className="font-sans font-semibold text-hs-ink text-sm leading-snug sm:text-[0.95rem]">
                        {t.dietaryDataConsent} *
                      </span>
                    </label>
                  </div>
                ) : null}

                <FormField
                  className={cellBase}
                  hint={t.notesHint}
                  id="attendance-notes"
                  label={t.notes}
                >
                  <Textarea
                    className="min-h-[90px] resize-y"
                    rows={3}
                    {...register("notes")}
                  />
                </FormField>

                {status === "error" && errorMessage ? (
                  <div
                    className="border-hs-ink border-b-[3px] bg-hs-red/20 px-4 py-3 font-bold font-sans text-base text-hs-ink"
                    role="alert"
                  >
                    {errorMessage}
                  </div>
                ) : null}

                <div className="flex justify-end bg-hs-sand/30 p-4">
                  <Button disabled={isSubmitting} type="submit" variant="gold">
                    {isSubmitting ? t.submitting : t.submit}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
