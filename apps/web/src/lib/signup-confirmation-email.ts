import type { CreateEmailOptions } from "resend";
import { Resend } from "resend";
import {
  ACCEPTANCE_EMAIL_SUBJECT,
  acceptanceEmailHtml,
  acceptanceEmailText,
} from "./acceptance-email-template";
import { envFromRuntime, siteOriginFromRuntime } from "./runtime-env";

interface ResendConfig {
  apiKey: string;
  from: string;
}

function readResendConfig(): ResendConfig | null {
  const apiKey = envFromRuntime("RESEND_API_KEY");
  const from = envFromRuntime("RESEND_FROM");
  if (!(apiKey && from)) {
    return null;
  }
  return { apiKey, from };
}

let cachedResend: Resend | null = null;
let cachedApiKey = "";

function getResend(apiKey: string): Resend {
  if (cachedResend && cachedApiKey === apiKey) {
    return cachedResend;
  }
  cachedResend = new Resend(apiKey);
  cachedApiKey = apiKey;
  return cachedResend;
}

export interface ConfirmationEmailInput {
  email: string;
  fullName: string;
  signupId: string;
  wantsAmbassador: boolean;
}

export type ConfirmationEmailResult =
  | { ok: true; messageId: string }
  | {
      ok: false;
      reason: "resend_disabled" | "send_failed";
      detail?: string;
    };

interface SendEmailInput {
  category: string;
  entityReference: string;
  /** Optional; when present it is sent alongside `text` as a multipart body. */
  html?: string;
  idempotencyKey: string;
  subject: string;
  text: string;
  to: string;
}

async function sendEmail(
  input: SendEmailInput
): Promise<ConfirmationEmailResult> {
  const config = readResendConfig();
  if (!config) {
    return { ok: false, reason: "resend_disabled" };
  }

  const payload: CreateEmailOptions = {
    from: config.from,
    headers: { "X-Entity-Ref-ID": input.entityReference },
    subject: input.subject,
    tags: [{ name: "category", value: input.category }],
    text: input.text,
    to: input.to,
    ...(input.html ? { html: input.html } : {}),
  };

  try {
    const result = await getResend(config.apiKey).emails.send(payload, {
      idempotencyKey: input.idempotencyKey,
    });
    if (result.error) {
      return {
        detail: `${result.error.name}: ${result.error.message}`,
        ok: false,
        reason: "send_failed",
      };
    }
    return { messageId: result.data.id, ok: true };
  } catch (error) {
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error).slice(0, 256);
    return { detail, ok: false, reason: "send_failed" };
  }
}

const WHITESPACE_SPLIT_RE = /\s+/;

function firstNameFrom(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return "hacker";
  }
  const first = trimmed.split(WHITESPACE_SPLIT_RE)[0];
  return first.length > 24 ? first.slice(0, 24) : first;
}

function signupFormUrl(): string {
  return new URL("/signup", siteOriginFromRuntime()).toString();
}

function signupManagementUrl(managementToken: string): string {
  const url = new URL("/cancelacion", siteOriginFromRuntime());
  url.searchParams.set("token", managementToken);
  return url.toString();
}

function signupConfirmationText(input: ConfirmationEmailInput): string {
  const firstName = firstNameFrom(input.fullName);
  const ambassadorNote = input.wantsAmbassador
    ? "\n\nTambién hemos anotado que te interesa participar como embajador/a. Si tu perfil encaja, te escribiremos con los siguientes pasos."
    : "";

  return `Hola ${firstName},

Gracias por apuntarte a HackSpain 2026! Hemos recibido tu solicitud correctamente.

Vamos a revisar cada candidatura personalmente. Cuando tengamos novedades sobre tu plaza, te escribiremos a este mismo correo.${ambassadorNote}

Mientras tanto, puedes seguirnos para estar al día:

X: https://x.com/hackspain26
Instagram: https://www.instagram.com/hackspain26/

Si quieres compartir la inscripción con alguien, usa este enlace:
${signupFormUrl()}

Nos vemos pronto,
El equipo de HackSpain

Has recibido este correo porque enviaste una solicitud desde ${siteOriginFromRuntime()}. Si no has sido tú, puedes ignorarlo.`;
}

export interface SignupCancellationEmailInput {
  email: string;
  fullName: string;
  managementToken: string;
  requestedAt: string;
  signupId: string;
}

export function sendSignupConfirmationEmail(
  input: ConfirmationEmailInput
): Promise<ConfirmationEmailResult> {
  return sendEmail({
    category: "signup_confirmation",
    entityReference: `hackspain-signup-${input.signupId}`,
    idempotencyKey: `signup-confirmation/${input.signupId}`,
    subject: "Hemos recibido tu solicitud — HackSpain 2026",
    text: signupConfirmationText(input),
    to: input.email,
  });
}

export function sendSignupCancellationEmail(
  input: SignupCancellationEmailInput
): Promise<ConfirmationEmailResult> {
  const firstName = firstNameFrom(input.fullName);
  const managementUrl = signupManagementUrl(input.managementToken);
  const text = `Hola ${firstName},

Hemos recibido una solicitud para cancelar tu participación en HackSpain 2026.

Gestiona la cancelación desde este enlace personal:
${managementUrl}

Abrir el enlace no cancela nada: tendrás que confirmar la acción en la página. Si no has solicitado la cancelación, puedes ignorar este correo y tu participación no cambiará.

El equipo de HackSpain`;

  return sendEmail({
    category: "signup_cancellation",
    entityReference: `hackspain-signup-cancellation-${input.signupId}`,
    idempotencyKey: `signup-cancellation/${input.signupId}/${input.requestedAt}`,
    subject: "Confirma la cancelación — HackSpain 2026",
    text,
    to: input.email,
  });
}

export interface SignupAcceptanceEmailInput {
  email: string;
  fullName: string;
  managementToken: string;
  signupId: string;
}

function signupAcceptanceUrl(managementToken: string): string {
  const url = new URL("/confirmacion", siteOriginFromRuntime());
  url.searchParams.set("token", managementToken);
  return url.toString();
}

/**
 * Absolute URL for the raster logo in `public/`. Email clients cannot resolve
 * relative image paths, and a data: URI would be stripped by Gmail.
 */
function emailLogoUrl(): string {
  return new URL("/hs-email-logo.png", siteOriginFromRuntime()).toString();
}

/**
 * Sent when a place is granted. The confirm link is the confirmation: opening it
 * moves the signup from accepted to confirmed. The cancel link points at the
 * ordinary management page, so someone who cannot come can free the place
 * without writing in.
 */
export function sendSignupAcceptanceEmail(
  input: SignupAcceptanceEmailInput
): Promise<ConfirmationEmailResult> {
  const content = {
    cancelUrl: signupManagementUrl(input.managementToken),
    confirmUrl: signupAcceptanceUrl(input.managementToken),
    firstName: firstNameFrom(input.fullName),
    logoUrl: emailLogoUrl(),
  };

  return sendEmail({
    category: "signup_acceptance",
    entityReference: `hackspain-signup-acceptance-${input.signupId}`,
    html: acceptanceEmailHtml(content),
    idempotencyKey: `signup-acceptance/${input.signupId}`,
    subject: ACCEPTANCE_EMAIL_SUBJECT,
    text: acceptanceEmailText(content),
    to: input.email,
  });
}

export interface MentorSponsorConfirmationEmailInput {
  attendanceLines: readonly string[];
  email: string;
  firstName: string;
  signupId: string;
}

/** Sent to mentors and sponsors after they confirm their attendance slots. */
export function sendMentorSponsorConfirmationEmail(
  input: MentorSponsorConfirmationEmailInput
): Promise<ConfirmationEmailResult> {
  const firstName = firstNameFrom(input.firstName);
  const slotList = input.attendanceLines.map((line) => `- ${line}`).join("\n");
  const text = `Hola ${firstName},

¡Gracias por confirmar tu asistencia a HackSpain 2026 (18–20 de septiembre, Madrid)!

Hemos anotado estas franjas:

${slotList}

Con esto organizamos comidas y logística, así que si tus planes cambian, escríbenos a contact@hackspain.com y lo actualizamos.

Nos vemos pronto,
El equipo de HackSpain

Has recibido este correo porque confirmaste tu asistencia desde ${siteOriginFromRuntime()}. Si no has sido tú, puedes ignorarlo.`;

  return sendEmail({
    category: "mentor_sponsor_confirmation",
    entityReference: `hackspain-mentor-sponsor-${input.signupId}`,
    idempotencyKey: `mentor-sponsor-confirmation/${input.signupId}`,
    subject: "Asistencia confirmada — HackSpain 2026",
    text,
    to: input.email,
  });
}
