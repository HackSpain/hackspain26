import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function displayedAttendance(
  status: string | null | undefined,
  onboarded = false
): string | undefined {
  if (status === "cancelled") {
    return "cancelled";
  }
  if (onboarded || status === "attending") {
    return "attending";
  }
  if (status === null || status === undefined || status === "") {
    return undefined;
  }
  return status;
}

export function roleLabel(role: string | undefined): string | undefined {
  if (role === "admin") {
    return "admin";
  }
  return undefined;
}

export function attendanceLabel(status: string | null | undefined): string {
  switch (status) {
    case "attending": {
      return "Asistiré";
    }
    case "cancelled": {
      return "Cancelado";
    }
    case "undecided": {
      return "Sin decidir";
    }
    default: {
      return status || "Asistiré";
    }
  }
}

export function claimStatusLabel(status: string): string {
  switch (status) {
    case "pending": {
      return "Pendiente";
    }
    case "added": {
      return "Añadida";
    }
    case "rejected": {
      return "Rechazada";
    }
    case "assigned": {
      return "Asignada";
    }
    default: {
      return status;
    }
  }
}

export function teamMemberStatusLabel(status: string): string {
  if (status === "member") {
    return "Miembro";
  }
  if (status === "pending") {
    return "Pendiente";
  }
  return status;
}

export function identifierTypeLabel(type: string): string {
  if (type === "github") {
    return "GitHub";
  }
  if (type === "twitter") {
    return "X";
  }
  if (type === "email") {
    return "Email";
  }
  return type;
}

export function submissionStatusLabel(status: string): string {
  if (status === "draft") {
    return "Borrador";
  }
  if (status === "submitted") {
    return "Enviado";
  }
  return status;
}

export function perkTypeLabel(type: string): string {
  if (type === "email") {
    return "Solicitud por email";
  }
  if (type === "code") {
    return "Código";
  }
  return type;
}

export function joinDotLabel(...parts: (string | null | undefined)[]): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" · ");
}

export function perkName(company: string, title: string): string {
  return joinDotLabel(company, title) || "Perk sin nombre";
}

export function notificationStatusLabel(status: string): string {
  if (status === "sent") {
    return "Enviado";
  }
  if (status === "queued") {
    return "En cola";
  }
  return status;
}

/**
 * Epoch ms ⇄ the value of an `<input type="datetime-local">`, which is the
 * browser's local wall-clock time with no zone. Admins edit the window from
 * Spain, so the stored instant matches what they typed.
 */
export function toDatetimeLocal(ms: number | undefined): string {
  if (ms === undefined) {
    return "";
  }
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

const EVENT_DATE = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "long",
  timeZone: "Europe/Madrid",
  weekday: "long",
});

/** "sábado, 3 de octubre, 10:00" in Madrid time, matching the server copy. */
export function formatEventDate(ms: number): string {
  return EVENT_DATE.format(new Date(ms));
}
