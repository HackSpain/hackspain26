import {
  addBreadcrumb,
  captureException,
  captureMessage,
  getCurrentScope,
  startSpan,
  withScope,
} from "@sentry/astro";
import { initBotId } from "botid/client/core";
import { AnimatePresence, motion } from "motion/react";
import type { ComponentPropsWithRef } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { Controller, useForm, useWatch } from "react-hook-form";
import { HACKSPAIN_SOCIAL_URLS } from "../../data/landing-meta";
import {
  areSignupsClosed,
  SIGNUP_DEADLINE_MS,
} from "../../data/signup-deadline";
import { getStoredReferralCode } from "../../lib/referral-code";
import {
  hasValidSignupAccessKey,
  signupLateAccessKeyFromSearch,
} from "../../lib/signup-late-access";
import type {
  DietaryRestrictionId,
  HeardFromSourceId,
  OccupationStatusId,
} from "../../lib/signup-validation";
import {
  DIETARY_RESTRICTION_OPTIONS,
  HEARD_FROM_OPTIONS,
  HEARD_FROM_SOURCE_IDS,
  normalizeSocialUrl,
  OCCUPATION_STATUS_IDS,
  OCCUPATION_STATUS_OPTIONS,
  parseSignupBodyClient,
} from "../../lib/signup-validation";
import { FormField } from "../form/form-field";
import { Input } from "../form/input";
import { SocialPrefixInput } from "../form/social-prefix-input";
import { Textarea } from "../form/textarea";
import { MosaicBackground } from "../mosaic/mosaic-background";
import { useLayoutProfile } from "../mosaic/use-layout-profile";
import { X_SVG } from "../theme/constants";
import { Button, ButtonLink } from "../ui/button";

const STORAGE_KEY = "hackspain-signup-draft-v1";
const STORAGE_APPLIED_KEY = "hackspain-signup-applied-v1";

/** `setTimeout` truncates past 2^31-1 ms (~24.8 days); don't arm it beyond that. */
const MAX_TIMEOUT_MS = 2_147_483_647;

const UNICODE_LEFT_ARROW_PREFIX_RE = /^\u2190\s*/;
const ASCII_LEFT_ARROW_PREFIX_RE = /^←\s*/;
const LINE_BREAK_SPLIT_RE = /\r?\n/;
type FlowStatus = "idle" | "success" | "error" | "alreadyApplied" | "closed";

type HackSpainCheckboxProps = Omit<ComponentPropsWithRef<"input">, "type"> & {
  size?: "default" | "large";
};

function HackSpainCheckbox({
  size = "default",
  ...inputProps
}: HackSpainCheckboxProps) {
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

function readAppliedFlag(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return localStorage.getItem(STORAGE_APPLIED_KEY) === "1";
}

function setAppliedFlag() {
  try {
    localStorage.setItem(STORAGE_APPLIED_KEY, "1");
  } catch {
    /* ignore */
  }
}

interface StoredFields {
  achievements: string;
  ambassadorMotivation: string;
  dietaryDataConsent: boolean;
  dietaryDetails: string;
  dietaryRestrictions: DietaryRestrictionId[];
  email: string;
  employer: string;
  freeTime: string;
  fullName: string;
  githubUrl: string;
  heardFromOther: string;
  heardFromSources: HeardFromSourceId[];
  isUnderThirty: boolean;
  linkedinUrl: string;
  occupationStatuses: OccupationStatusId[];
  studyInstitution: string;
  wantsAmbassador: boolean;
  webUrl: string;
  xUrl: string;
}

const NON_PERSISTED_DRAFT_FIELDS = new Set<string>([
  "dietaryDataConsent",
  "dietaryDetails",
  "dietaryRestrictions",
  "isUnderThirty",
]);

const EMPTY_FIELDS: StoredFields = {
  achievements: "",
  ambassadorMotivation: "",
  dietaryDataConsent: false,
  dietaryDetails: "",
  dietaryRestrictions: [],
  email: "",
  employer: "",
  freeTime: "",
  fullName: "",
  githubUrl: "",
  heardFromOther: "",
  heardFromSources: [],
  isUnderThirty: false,
  linkedinUrl: "",
  occupationStatuses: [],
  studyInstitution: "",
  wantsAmbassador: false,
  webUrl: "",
  xUrl: "",
};

function readStoredFields(): StoredFields {
  if (typeof window === "undefined") {
    return { ...EMPTY_FIELDS };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...EMPTY_FIELDS };
    }
    const o = JSON.parse(raw) as Record<string, unknown>;
    const s = (k: keyof StoredFields) =>
      typeof o[k] === "string" ? (o[k] as string) : "";
    const wantsAmbassador = o.wantsAmbassador === true;
    const occupationIds = OCCUPATION_STATUS_IDS as readonly string[];
    const occupationValues = Array.isArray(o.occupationStatuses)
      ? o.occupationStatuses
      : [];
    const occupationStatuses = occupationValues.filter(
      (value): value is OccupationStatusId =>
        typeof value === "string" && occupationIds.includes(value)
    );
    const ids = HEARD_FROM_SOURCE_IDS as readonly string[];
    const sourceValues = Array.isArray(o.heardFromSources)
      ? o.heardFromSources
      : [];
    const heardFromSources = sourceValues.filter(
      (value): value is HeardFromSourceId =>
        typeof value === "string" && ids.includes(value)
    );
    const heardFromOther =
      typeof o.heardFromOther === "string" ? o.heardFromOther : "";
    return {
      achievements: s("achievements"),
      ambassadorMotivation: s("ambassadorMotivation"),
      dietaryDataConsent: false,
      dietaryDetails: "",
      dietaryRestrictions: [],
      email: s("email"),
      employer: s("employer"),
      freeTime: s("freeTime"),
      fullName: s("fullName"),
      githubUrl: s("githubUrl"),
      heardFromOther,
      heardFromSources,
      isUnderThirty: false,
      linkedinUrl: s("linkedinUrl"),
      occupationStatuses,
      studyInstitution: s("studyInstitution"),
      wantsAmbassador,
      webUrl: s("webUrl"),
      xUrl: s("xUrl"),
    };
  } catch {
    return { ...EMPTY_FIELDS };
  }
}

function writeStoredFields(fields: StoredFields) {
  try {
    const storedFields = JSON.stringify(fields, (key, value) =>
      NON_PERSISTED_DRAFT_FIELDS.has(key) ? undefined : value
    );
    localStorage.setItem(STORAGE_KEY, storedFields);
  } catch {
    /* ignore quota / private mode */
  }
}

function clearStoredFields() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function signupLateAccessKeyFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return signupLateAccessKeyFromSearch(window.location.search);
}

const X_PREFIX = "x.com/";
const LINKEDIN_PREFIX = "linkedin.com/in/";
const GITHUB_PREFIX = "github.com/";

const cellBase = "border-b-[3px] border-hs-ink bg-hs-paper p-4";
const cellLeftSm = `${cellBase} sm:border-r-[3px]`;

const t = {
  achievements: "Logros e hitos",
  achievementsHint:
    "Lo que te enorgullece — hackathones, estudios, deporte, voluntariado, arte, trabajo… técnico o no.",
  alreadyApplied:
    "Ya tenemos una solicitud con este correo. No necesitas volver a enviarla; te contactaremos por email cuando haya novedades.",
  ambassadorCheckboxAfter: "",
  ambassadorCheckboxBefore: "Quiero participar como ",
  ambassadorCheckboxLink: "embajador/a",
  ambassadorWhyHint:
    "Unas frases sobre qué te mueve — comunidad, tech, tu campus, llegar a gente nueva…",
  ambassadorWhyLabel: "¿Por qué quieres ser embajador/a?",
  applicationReceived:
    "¡Gracias! Hemos recibido tu solicitud. Espera nuestra respuesta por correo; te escribiremos en cuanto podamos.",
  backHome: "← Inicio",
  dietaryDataConsent:
    "Si has indicado una restricción o alergia, consiento expresamente que HackSpain trate estos datos únicamente para organizar comidas seguras y atender mis necesidades durante el evento.",
  dietaryDetails: "Detalles de alergias o restricciones",
  dietaryDetailsHint:
    "Cuéntanos cualquier detalle que debamos conocer para organizar las comidas.",
  dietaryRestrictions: "Restricciones alimentarias",
  dietaryRestrictionsHint: "Puedes marcar varias opciones.",
  email: "Email",
  employer: "Empresa u organización",
  errorAccessDenied:
    "No hemos podido verificar la solicitud. Recarga la página e inténtalo de nuevo, o usa un navegador normal con JavaScript activado.",
  errorDietaryConsent:
    "Debes consentir expresamente el tratamiento de los datos alimentarios que has indicado.",
  errorEmployer: "Indica tu empresa u organización.",
  errorFormOutdated:
    "No hemos podido recibir tu solicitud. Tus datos siguen guardados en este navegador; recarga la página y vuelve a intentarlo en unos minutos.",
  errorFullName: "Indica tu nombre completo.",
  errorGeneric:
    "No hemos podido recibir tu solicitud. Tus datos siguen guardados en este navegador; inténtalo de nuevo en unos minutos.",
  errorInvalidEmail: "Introduce un correo electrónico válido.",
  errorInvalidSocialUrl:
    "Uno o más enlaces no son válidos para ese campo (revisa X, LinkedIn, GitHub o tu web).",
  errorInvitation:
    "El enlace personal no es válido o ya no está disponible. Puedes completar el formulario manualmente.",
  errorSocialRequired: "Añade al menos un enlace a perfil o web.",
  errorStudyInstitution: "Indica tu universidad o centro de estudios.",
  errorUnderThirty: "Debes confirmar que eres menor de 30 años.",
  followSocialsHint:
    "Síguenos en redes para enterarte de fechas, novedades y todo lo que viene en HackSpain 2026.",
  followSocialsLabel: "También en redes",
  freeTime: "Fuera del cole / curro",
  freeTimeHint:
    "Hobbies, clubes, asociaciones, side projects, cómo desconectas — lo que te represente.",
  fullName: "Nombre completo",
  github: "GitHub",
  heardFrom: "¿Cómo nos has conocido?",
  heardFromOtherPlaceholder: "Cuéntanos cómo nos encontraste…",
  legalPrivacyLinkLabel: "política de privacidad",
  legalSubmitNoticeAfter:
    ", incluida la comunicación de tus datos a patrocinadores oficiales de HackSpain según se indica allí.",
  legalSubmitNoticeBefore: "Al enviar este formulario aceptas nuestra ",
  linkedin: "LinkedIn",
  occupationStatus: "¿Estudias / trabajas?",
  signupsClosed:
    "Las inscripciones para HackSpain 2026 están cerradas. Gracias por el interés — síguenos en redes para enterarte de la próxima edición.",
  signupsClosedSubtitle:
    "El plazo para enviar solicitudes ha terminado. Síguenos en redes para no perderte lo que viene.",
  socialGithubPlaceholder: "usuario o usuario/repo — o pega un enlace",
  socialLinkedinPlaceholder: "usuario, company/acme o pega un enlace",
  socialXPlaceholder: "usuario, @usuario o pega un enlace",
  socialsRequiredHint:
    "Añade al menos un enlace (X, LinkedIn, GitHub o tu web).",
  socialsTitle: "Redes y enlaces",
  studyInstitution: "Universidad o centro",
  submit: "Enviar solicitud",
  submitting: "Enviando…",
  subtitle:
    "Cuéntanos quién eres y qué te motiva a participar. Como las plazas son limitadas, revisaremos cada solicitud y te confirmaremos por correo si has sido seleccionado/a.",
  title: "Apúntate al hackathon",
  underThirtyConfirmation: "Confirmo que soy menor de 30 años.",
  web: "Web",
  x: "X (Twitter)",
} as const;

function ambassadorQueryEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const v = new URLSearchParams(window.location.search).get("ambassador");
  return v === "1" || v === "true" || v === "yes";
}

type SignupAttention = null | "heard" | "ambassador";

export function SignupPage() {
  const profile = useLayoutProfile();
  const homeHref = "/";
  const ambassadorPageHref = "/ambassador";
  const privacyHref = "/privacy";

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState,
  } = useForm<StoredFields>({ defaultValues: { ...EMPTY_FIELDS } });
  const { isSubmitting } = formState;
  const heardFromSources = watch("heardFromSources");
  const occupationStatuses = watch("occupationStatuses");
  const wantsAmbassador = watch("wantsAmbassador");
  const dietaryRestrictions = watch("dietaryRestrictions");
  const dietaryDetails = watch("dietaryDetails");
  const hasDietaryData =
    dietaryRestrictions.length > 0 || dietaryDetails.trim().length > 0;

  const [attentionTarget, setAttentionTarget] = useState<SignupAttention>(null);
  const heardFromSectionRef = useRef<HTMLDivElement>(null);
  const ambassadorSectionRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<FlowStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [deadlinePassed, setDeadlinePassed] = useState(() =>
    areSignupsClosed()
  );
  const [lateAccessKey, setLateAccessKey] = useState("");

  useLayoutEffect(() => {
    setLateAccessKey(signupLateAccessKeyFromLocation());
  }, []);

  // No polling: arm a single timer for the deadline so a page left open across
  // it closes itself instead of letting someone finish a doomed form.
  useEffect(() => {
    if (deadlinePassed) {
      return;
    }
    const msLeft = SIGNUP_DEADLINE_MS - Date.now();
    if (msLeft <= 0) {
      setDeadlinePassed(true);
      return;
    }
    if (msLeft > MAX_TIMEOUT_MS) {
      return;
    }
    const id = window.setTimeout(() => setDeadlinePassed(true), msLeft);
    return () => window.clearTimeout(id);
  }, [deadlinePassed]);

  useLayoutEffect(() => {
    if (readAppliedFlag()) {
      setStatus("alreadyApplied");
      return;
    }
    reset(readStoredFields());
  }, [reset]);

  const watched = useWatch({ control });
  useEffect(() => {
    if (status === "success" || status === "alreadyApplied") {
      return;
    }
    if (!watched) {
      return;
    }
    writeStoredFields(watched as StoredFields);
  }, [watched, status]);

  useEffect(() => {
    if (ambassadorQueryEnabled()) {
      setValue("wantsAmbassador", true, { shouldDirty: true });
    }
  }, [setValue]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      return;
    }
    initBotId({
      protect: [{ method: "POST", path: "/api/signup" }],
    });
  }, []);

  useEffect(() => {
    getCurrentScope().setTag("flow", "signup");
  }, []);

  function pulseAttention(target: "heard" | "ambassador") {
    setErrorMessage("");
    setAttentionTarget(null);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAttentionTarget(target);
        const el =
          target === "heard"
            ? heardFromSectionRef.current
            : ambassadorSectionRef.current;
        if (!el || typeof window === "undefined") {
          return;
        }
        const smooth = window.matchMedia(
          "(prefers-reduced-motion: no-preference)"
        ).matches;
        el.scrollIntoView({
          behavior: smooth ? "smooth" : "auto",
          block: "center",
        });
      });
    });
  }

  useEffect(() => {
    if (!attentionTarget) {
      return;
    }
    const id = window.setTimeout(() => setAttentionTarget(null), 1400);
    return () => window.clearTimeout(id);
  }, [attentionTarget]);

  const onSubmitForm: SubmitHandler<StoredFields> = async (data) => {
    setErrorMessage("");

    addBreadcrumb({
      category: "ui",
      level: "info",
      message: "signup: submit",
    });

    if (data.heardFromSources.length === 0) {
      addBreadcrumb({
        category: "signup",
        level: "info",
        message: "no heard from selected",
      });
      pulseAttention("heard");
      return;
    }
    const payload = { ...data };
    const referralCode = getStoredReferralCode();
    if (referralCode) {
      Object.assign(payload, { referralCode });
    }
    if (hasValidSignupAccessKey(lateAccessKey)) {
      Object.assign(payload, { signupAccessKey: lateAccessKey });
    }
    const parsed = parseSignupBodyClient(payload);
    if (!parsed.ok) {
      addBreadcrumb({
        category: "signup",
        data: { code: parsed.code },
        level: "info",
        message: "client validation",
      });
      if (parsed.code === "generic") {
        captureMessage("Signup: client validation failed (generic)", "warning");
      }
      if (parsed.code === "heard_from") {
        pulseAttention("heard");
        return;
      }
      if (parsed.code === "heard_from_other") {
        pulseAttention("heard");
        requestAnimationFrame(() => {
          document.querySelector("#signup-heard-from-other")?.focus();
        });
        return;
      }
      if (parsed.code === "ambassador_motivation") {
        pulseAttention("ambassador");
        return;
      }
      if (parsed.code === "social_required") {
        setErrorMessage(t.errorSocialRequired);
      } else if (parsed.code === "invalid_social_url") {
        setErrorMessage(t.errorInvalidSocialUrl);
      } else if (parsed.code === "invalid_email") {
        setErrorMessage(t.errorInvalidEmail);
      } else if (parsed.code === "fullName") {
        setErrorMessage(t.errorFullName);
      } else if (parsed.code === "study_institution") {
        setErrorMessage(t.errorStudyInstitution);
      } else if (parsed.code === "employer") {
        setErrorMessage(t.errorEmployer);
      } else if (parsed.code === "dietary_consent") {
        setErrorMessage(t.errorDietaryConsent);
      } else if (parsed.code === "under_thirty") {
        setErrorMessage(t.errorUnderThirty);
      } else {
        setErrorMessage(t.errorGeneric);
      }
      setStatus("error");
      return;
    }
    try {
      const res = await startSpan(
        { name: "POST /api/signup", op: "http.client" },
        async (span) => {
          const r = await fetch("/api/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Same shape as `parseSignupBody` on the server.
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
        clearStoredFields();
        setAppliedFlag();
        setStatus("success");
        return;
      }
      const isInvitationError =
        resJson.error === "invalid_invitation" ||
        resJson.error === "invitation_used" ||
        resJson.error === "invitation_email_mismatch";
      const isDuplicateEmail =
        resJson.error === "duplicate_email" ||
        (res.status === 409 && !isInvitationError);
      // The deadline passed while this form was open — expected, not a failure.
      if (resJson.error === "signups_closed") {
        addBreadcrumb({
          category: "http",
          data: { error: resJson.error, status: res.status },
          level: "info",
          message: "signup rejected after the deadline (expected)",
          type: "http",
        });
        setStatus("closed");
        return;
      }
      if (isDuplicateEmail) {
        addBreadcrumb({
          category: "http",
          data: { error: resJson.error, status: res.status },
          level: "info",
          message: "signup duplicate email (expected)",
          type: "http",
        });
        clearStoredFields();
        setAppliedFlag();
        setStatus("alreadyApplied");
        return;
      }
      addBreadcrumb({
        category: "http",
        data: { error: resJson.error, status: res.status },
        level: "error",
        type: "http",
      });
      withScope((scope) => {
        scope.setTag("flow", "signup");
        scope.setTag("source", "client");
        scope.setTag("http_status", String(res.status));
        if (resJson.error) {
          scope.setTag("api_error", resJson.error);
        }
        scope.setContext("form", {
          heardFrom: data.heardFromSources,
          occupationStatuses: data.occupationStatuses,
          wantsAmbassador: data.wantsAmbassador,
        });
        captureMessage(
          `Signup: API rejected ${res.status}${resJson.error ? ` (${resJson.error})` : ""}`,
          "error"
        );
      });
      if (res.status === 403) {
        setErrorMessage(t.errorAccessDenied);
      } else if (isInvitationError) {
        setErrorMessage(t.errorInvitation);
      } else if (resJson.error === "social_required") {
        setErrorMessage(t.errorSocialRequired);
      } else if (resJson.error === "invalid_social_url") {
        setErrorMessage(t.errorInvalidSocialUrl);
      } else if (resJson.error === "ambassador_motivation_required") {
        setStatus("error");
        pulseAttention("ambassador");
        return;
      } else if (resJson.error === "fullName_required") {
        setErrorMessage(t.errorFullName);
      } else if (resJson.error === "study_institution_required") {
        setErrorMessage(t.errorStudyInstitution);
      } else if (resJson.error === "employer_required") {
        setErrorMessage(t.errorEmployer);
      } else if (resJson.error === "dietary_consent_required") {
        setErrorMessage(t.errorDietaryConsent);
      } else if (resJson.error === "under_thirty_required") {
        setErrorMessage(t.errorUnderThirty);
      } else if (resJson.error === "heard_from_other_required") {
        setStatus("error");
        pulseAttention("heard");
        requestAnimationFrame(() => {
          document.querySelector("#signup-heard-from-other")?.focus();
        });
        return;
      } else if (resJson.error === "heard_from_required") {
        setStatus("error");
        pulseAttention("heard");
        return;
      } else if (resJson.error === "invalid_email") {
        setErrorMessage(t.errorInvalidEmail);
      } else if (res.status === 400) {
        setErrorMessage(t.errorFormOutdated);
      } else {
        setErrorMessage(t.errorGeneric);
      }
      setStatus("error");
    } catch (error) {
      if (error instanceof Error) {
        withScope((scope) => {
          scope.setTag("flow", "signup");
          scope.setTag("source", "client");
          captureException(error);
        });
      } else {
        addBreadcrumb({
          category: "signup",
          message: "submit: caught non-Error (ignored for issues)",
          data: { kind: Object.prototype.toString.call(error) },
          level: "warning",
        });
      }
      setErrorMessage(t.errorGeneric);
      setStatus("error");
    }
  };

  const webReg = register("webUrl", {
    onChange: () => setAttentionTarget(null),
  });

  // An application already sent still wins over the closed notice — whoever got
  // in before the deadline should see their confirmation, not "estamos cerrados".
  const alreadyDone = status === "success" || status === "alreadyApplied";
  const lateAccessAllowed = hasValidSignupAccessKey(lateAccessKey);
  const showClosed =
    !alreadyDone &&
    ((deadlinePassed && !lateAccessAllowed) || status === "closed");
  const showFinalPanel = alreadyDone || showClosed;
  let finalPanelMessage = t.applicationReceived;
  if (status === "alreadyApplied") {
    finalPanelMessage = t.alreadyApplied;
  } else if (showClosed) {
    finalPanelMessage = t.signupsClosed;
  }

  return (
    <div className="relative z-0 min-h-dvh w-full">
      <MosaicBackground
        className="pointer-events-none fixed inset-0 -z-10 hidden h-full min-h-dvh w-full sm:block"
        variant={profile ?? "desktop"}
      />
      <div className="relative z-0 mx-auto max-w-6xl px-0 pb-0 sm:px-4 sm:pb-10">
        <div className="grid grid-cols-1 gap-0 border-hs-ink bg-hs-ink sm:border-[3px]">
          <div className="border-hs-ink border-b-[3px] bg-hs-orange px-4 py-5">
            <h1 className="font-bungee text-2xl text-hs-ink leading-tight sm:text-3xl">
              {t.title}
            </h1>
            <p className="mt-2 max-w-xl font-sans font-semibold text-base text-hs-ink leading-snug sm:text-lg">
              {showClosed ? t.signupsClosedSubtitle : t.subtitle}
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
                    <ButtonLink href={homeHref} size="success" variant="gold">
                      {t.backHome
                        .replace(UNICODE_LEFT_ARROW_PREFIX_RE, "")
                        .replace(ASCII_LEFT_ARROW_PREFIX_RE, "")
                        .trim() || t.backHome}
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
                    id="signup-full-name"
                    label={t.fullName}
                    required
                  >
                    <Input
                      autoComplete="name"
                      required
                      {...register("fullName")}
                    />
                  </FormField>
                  <FormField
                    className={cellBase}
                    id="signup-email"
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
                </div>

                <div className="border-hs-ink border-b-[3px] bg-hs-teal/25 px-4 py-3">
                  <p className="font-bungee text-base text-hs-ink tracking-wide sm:text-lg">
                    {t.socialsTitle}
                  </p>
                  <p className="mt-1 font-sans font-semibold text-hs-ink text-sm sm:text-base">
                    {t.socialsRequiredHint}
                  </p>
                </div>
                <div className="grid gap-0 sm:grid-cols-2">
                  <FormField
                    className={cellLeftSm}
                    id="signup-x-url"
                    label={t.x}
                    labelVariant="sans"
                  >
                    <Controller
                      control={control}
                      name="xUrl"
                      render={({ field }) => (
                        <SocialPrefixInput
                          name={field.name}
                          onBlur={field.onBlur}
                          onChange={(v) => field.onChange(v)}
                          placeholder={t.socialXPlaceholder}
                          prefix={X_PREFIX}
                          profileKind="x"
                          value={field.value}
                        />
                      )}
                    />
                  </FormField>
                  <FormField
                    className={cellBase}
                    id="signup-linkedin-url"
                    label={t.linkedin}
                    labelVariant="sans"
                  >
                    <Controller
                      control={control}
                      name="linkedinUrl"
                      render={({ field }) => (
                        <SocialPrefixInput
                          name={field.name}
                          onBlur={field.onBlur}
                          onChange={(v) => field.onChange(v)}
                          placeholder={t.socialLinkedinPlaceholder}
                          prefix={LINKEDIN_PREFIX}
                          profileKind="linkedin"
                          value={field.value}
                        />
                      )}
                    />
                  </FormField>
                  <FormField
                    className={cellLeftSm}
                    id="signup-github-url"
                    label={t.github}
                    labelVariant="sans"
                  >
                    <Controller
                      control={control}
                      name="githubUrl"
                      render={({ field }) => (
                        <SocialPrefixInput
                          name={field.name}
                          onBlur={field.onBlur}
                          onChange={(v) => field.onChange(v)}
                          placeholder={t.socialGithubPlaceholder}
                          prefix={GITHUB_PREFIX}
                          profileKind="github"
                          value={field.value}
                        />
                      )}
                    />
                  </FormField>
                  <FormField
                    className={cellBase}
                    id="signup-web-url"
                    label={t.web}
                    labelVariant="sans"
                  >
                    <Input
                      autoComplete="url"
                      inputMode="url"
                      placeholder="yoursite.com or https://..."
                      type="text"
                      {...webReg}
                      onBlur={(e) => {
                        webReg.onBlur(e);
                        const norm = normalizeSocialUrl(
                          e.target.value.trim(),
                          "web"
                        );
                        if (norm) {
                          setValue("webUrl", norm, {
                            shouldTouch: true,
                            shouldValidate: true,
                          });
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const raw = e.clipboardData.getData("text/plain");
                        const line =
                          raw
                            .split(LINE_BREAK_SPLIT_RE)
                            .map((l) => l.trim())
                            .find((l) => l.length > 0) ?? "";
                        if (!line) {
                          return;
                        }
                        const norm = normalizeSocialUrl(line, "web");
                        setValue("webUrl", norm || line, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                      }}
                    />
                  </FormField>
                </div>

                <FormField
                  className={cellBase}
                  hint={t.achievementsHint}
                  id="signup-achievements"
                  label={t.achievements}
                >
                  <Textarea
                    className="min-h-[120px] resize-y"
                    rows={5}
                    {...register("achievements")}
                  />
                </FormField>

                <FormField
                  className={cellBase}
                  hint={t.freeTimeHint}
                  id="signup-free-time"
                  label={t.freeTime}
                >
                  <Textarea
                    className="min-h-[120px] resize-y"
                    rows={5}
                    {...register("freeTime")}
                  />
                </FormField>

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
                                htmlFor={`signup-dietary-${option.id}`}
                                key={option.id}
                              >
                                <HackSpainCheckbox
                                  checked={checked}
                                  id={`signup-dietary-${option.id}`}
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
                  id="signup-dietary-details"
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
                      htmlFor="signup-dietary-data-consent"
                    >
                      <HackSpainCheckbox
                        id="signup-dietary-data-consent"
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

                <div className={cellBase}>
                  <fieldset className="min-w-0 border-0 p-0">
                    <legend className="font-bungee text-hs-ink text-sm tracking-wide">
                      {t.occupationStatus}
                    </legend>
                    <p className="mt-1 font-sans font-semibold text-hs-ink/75 text-xs">
                      Puedes marcar ambas opciones o ninguna.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      {OCCUPATION_STATUS_OPTIONS.map((option) => (
                        <label
                          className="flex cursor-pointer items-center gap-2 rounded-sm border-[3px] border-hs-ink bg-hs-paper px-3 py-2 shadow-[2px_2px_0_0_var(--color-hs-ink)] hover:bg-hs-sand/40 has-[:focus-visible]:border-hs-navy has-[:checked]:bg-hs-gold/35"
                          htmlFor={`signup-occupation-${option.id}`}
                          key={option.id}
                        >
                          <HackSpainCheckbox
                            id={`signup-occupation-${option.id}`}
                            value={option.id}
                            {...register("occupationStatuses", {
                              onChange: (event) => {
                                if (
                                  option.id === "student" &&
                                  !event.target.checked
                                ) {
                                  setValue("studyInstitution", "", {
                                    shouldDirty: true,
                                  });
                                }
                                if (
                                  option.id === "working" &&
                                  !event.target.checked
                                ) {
                                  setValue("employer", "", {
                                    shouldDirty: true,
                                  });
                                }
                              },
                            })}
                          />
                          <span className="font-sans font-semibold text-hs-ink text-sm">
                            {option.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>

                <AnimatePresence initial={false}>
                  {occupationStatuses.includes("student") ? (
                    <motion.div
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      initial={{ height: 0, opacity: 0 }}
                      key="signup-study-institution"
                      transition={{ duration: 0.24 }}
                    >
                      <FormField
                        className={cellBase}
                        id="signup-study-institution"
                        label={t.studyInstitution}
                        required
                      >
                        <Input
                          autoComplete="organization"
                          required
                          {...register("studyInstitution")}
                        />
                      </FormField>
                    </motion.div>
                  ) : null}
                  {occupationStatuses.includes("working") ? (
                    <motion.div
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      initial={{ height: 0, opacity: 0 }}
                      key="signup-employer"
                      transition={{ duration: 0.24 }}
                    >
                      <FormField
                        className={cellBase}
                        id="signup-employer"
                        label={t.employer}
                        required
                      >
                        <Input
                          autoComplete="organization"
                          required
                          {...register("employer")}
                        />
                      </FormField>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div
                  className={`${cellBase} relative isolate`}
                  ref={heardFromSectionRef}
                >
                  <FormField
                    className="min-w-0 border-0 bg-transparent p-0 shadow-none"
                    id="signup-heard-from"
                    label={t.heardFrom}
                    required
                  >
                    <fieldset className="min-w-0 border-0 p-0">
                      <legend className="sr-only">
                        {t.heardFrom} (obligatorio)
                      </legend>
                      <Controller
                        control={control}
                        name="heardFromSources"
                        render={({ field }) => (
                          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4 min-[520px]:grid-cols-3">
                            {HEARD_FROM_OPTIONS.map((option) => {
                              const checked = field.value.includes(option.id);
                              return (
                                <label
                                  className="flex cursor-pointer items-start gap-1.5 rounded-sm border-[3px] border-hs-ink bg-hs-paper px-2 py-1.5 shadow-[2px_2px_0_0_var(--color-hs-ink)] transition-[background-color,box-shadow] hover:bg-hs-sand/40 has-[:focus-visible]:border-hs-navy has-[:checked]:bg-hs-gold/35"
                                  htmlFor={`signup-heard-from-${option.id}`}
                                  key={option.id}
                                >
                                  <HackSpainCheckbox
                                    checked={checked}
                                    id={`signup-heard-from-${option.id}`}
                                    name={field.name}
                                    onBlur={field.onBlur}
                                    onChange={(event) => {
                                      const next = event.target.checked
                                        ? [...field.value, option.id]
                                        : field.value.filter(
                                            (value) => value !== option.id
                                          );
                                      field.onChange(next);
                                      setAttentionTarget(null);
                                      if (
                                        option.id === "other" &&
                                        !event.target.checked
                                      ) {
                                        setValue("heardFromOther", "", {
                                          shouldDirty: true,
                                        });
                                      }
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
                      {heardFromSources.includes("other") ? (
                        <div className="mt-3">
                          <Input
                            aria-required
                            autoComplete="off"
                            id="signup-heard-from-other"
                            placeholder={t.heardFromOtherPlaceholder}
                            type="text"
                            {...register("heardFromOther", {
                              onChange: () => setAttentionTarget(null),
                            })}
                          />
                        </div>
                      ) : null}
                    </fieldset>
                  </FormField>
                  {attentionTarget === "heard" ? (
                    <div
                      aria-hidden
                      className="hs-signup-field-attention-overlay"
                    />
                  ) : null}
                </div>

                <div className="border-hs-ink border-b-[3px] bg-hs-teal/15 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <HackSpainCheckbox
                      id="signup-wants-ambassador"
                      size="large"
                      {...register("wantsAmbassador", {
                        onChange: () => setAttentionTarget(null),
                      })}
                    />
                    <div className="min-w-0 font-sans font-semibold text-base text-hs-ink leading-snug sm:text-[1.05rem]">
                      <label
                        className="cursor-pointer"
                        htmlFor="signup-wants-ambassador"
                      >
                        {t.ambassadorCheckboxBefore}
                      </label>
                      <a
                        className="font-extrabold text-hs-navy underline decoration-2 underline-offset-2 hover:text-hs-ink"
                        href={ambassadorPageHref}
                      >
                        {t.ambassadorCheckboxLink}
                      </a>
                      <label
                        className="cursor-pointer"
                        htmlFor="signup-wants-ambassador"
                      >
                        {t.ambassadorCheckboxAfter}
                      </label>
                    </div>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {wantsAmbassador ? (
                    <motion.div
                      animate={{ height: "auto", opacity: 1 }}
                      className="overflow-hidden border-hs-ink border-b-[3px]"
                      exit={{ height: 0, opacity: 0 }}
                      initial={{ height: 0, opacity: 0 }}
                      key="signup-ambassador-fields"
                      ref={ambassadorSectionRef}
                      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="relative isolate grid gap-0 bg-hs-paper">
                        <FormField
                          className={cellBase}
                          hint={t.ambassadorWhyHint}
                          id="signup-ambassador-motivation"
                          label={t.ambassadorWhyLabel}
                          required
                        >
                          <Textarea
                            className="min-h-[100px] resize-y"
                            rows={4}
                            {...register("ambassadorMotivation", {
                              onChange: () => setAttentionTarget(null),
                            })}
                          />
                        </FormField>
                        {attentionTarget === "ambassador" ? (
                          <div
                            aria-hidden
                            className="hs-signup-field-attention-overlay"
                          />
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {status === "error" && errorMessage ? (
                  <div
                    className="border-hs-ink border-b-[3px] bg-hs-red/20 px-4 py-3 font-bold font-sans text-base text-hs-ink"
                    role="alert"
                  >
                    {errorMessage}
                  </div>
                ) : null}

                <div className="flex flex-col gap-4 bg-hs-sand/30 p-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
                  <div className="max-w-xl sm:max-w-md">
                    <label
                      className="flex cursor-pointer items-start gap-3"
                      htmlFor="signup-under-thirty"
                    >
                      <HackSpainCheckbox
                        id="signup-under-thirty"
                        required
                        size="large"
                        {...register("isUnderThirty")}
                      />
                      <span className="font-sans font-semibold text-hs-ink text-sm leading-snug sm:text-[0.95rem]">
                        {t.underThirtyConfirmation} *
                      </span>
                    </label>
                    <p className="mt-3 font-sans font-semibold text-hs-ink text-xs leading-snug sm:text-sm">
                      {t.legalSubmitNoticeBefore}
                      <a
                        className="font-extrabold text-hs-navy underline decoration-2 underline-offset-2 hover:text-hs-ink"
                        href={`${privacyHref}#privacy-policy`}
                      >
                        {t.legalPrivacyLinkLabel}
                      </a>
                      {t.legalSubmitNoticeAfter}
                    </p>
                  </div>
                  <Button
                    className="shrink-0 self-end sm:self-auto"
                    disabled={isSubmitting}
                    type="submit"
                    variant="gold"
                  >
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
