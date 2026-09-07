import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type PhoneVerifyFailure =
  | "no_challenge"
  | "expired"
  | "too_many_attempts"
  | "incorrect";

export function phoneVerifyMessage(reason: PhoneVerifyFailure): string {
  switch (reason) {
    case "no_challenge": {
      return "Pide primero un código al teléfono";
    }
    case "expired": {
      return "Ese código ha caducado. Pide uno nuevo.";
    }
    case "too_many_attempts": {
      return "Demasiados intentos. Pide un código nuevo.";
    }
    case "incorrect": {
      return "Código incorrecto";
    }
  }
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

export type IdentifierType = "email" | "github" | "twitter";

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

export function identifierPlaceholder(type: IdentifierType): string {
  if (type === "email") {
    return "name@email.com";
  }
  if (type === "github") {
    return "username";
  }
  return "@handle";
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
