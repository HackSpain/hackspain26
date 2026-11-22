const WHITESPACE_SPLIT_RE = /\s+/;

export function firstNameFrom(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return "hacker";
  }
  const first = trimmed.split(WHITESPACE_SPLIT_RE)[0] ?? "hacker";
  return first.length > 24 ? first.slice(0, 24) : first;
}

export function landingOrigin(): string {
  return (process.env.LANDING_URL ?? "https://hackspain.com").replace(
    /\/$/,
    ""
  );
}

export function confirmUrl(token: string): string {
  const url = new URL("/confirmacion", `${landingOrigin()}/`);
  url.searchParams.set("token", token);
  return url.toString();
}

export function cancelUrl(token: string): string {
  const url = new URL("/cancelacion", `${landingOrigin()}/`);
  url.searchParams.set("token", token);
  return url.toString();
}

export function reviewEmailText(input: {
  editionLabel: string;
  fullName: string;
  origin: string;
  roleLabel: string;
}): string {
  const firstName = firstNameFrom(input.fullName);
  return `Hola ${firstName},

Gracias por apuntarte a ${input.editionLabel}. Hemos recibido tu solicitud para participar como ${input.roleLabel}.

Vamos a revisar cada candidatura. Cuando tengamos novedades sobre tu plaza, te escribiremos a este mismo correo.

Nos vemos pronto,
El equipo de HackSpain

Has recibido este correo porque enviaste una solicitud desde ${input.origin}. Si no has sido tú, puedes ignorarlo.`;
}

export function acceptEmailText(input: {
  confirmUrl: string;
  editionLabel: string;
  fullName: string;
  requiresConfirmed: boolean;
}): string {
  const firstName = firstNameFrom(input.fullName);
  if (input.requiresConfirmed) {
    return `Hola ${firstName},

Tienes plaza en ${input.editionLabel}. Confirma que asistirás desde este enlace personal:

${input.confirmUrl}

Abrir el enlace no confirma nada: tendrás que pulsar el botón en la página.

Nos vemos pronto,
El equipo de HackSpain`;
  }
  return `Hola ${firstName},

Tienes plaza en ${input.editionLabel}. Ya puedes entrar en https://hackspain.app con este mismo email.

Nos vemos pronto,
El equipo de HackSpain`;
}

export function cancellationEmailText(input: {
  cancelUrl: string;
  editionLabel: string;
  fullName: string;
}): string {
  const firstName = firstNameFrom(input.fullName);
  return `Hola ${firstName},

Hemos recibido una solicitud para cancelar tu participación en ${input.editionLabel}.

Gestiona la cancelación desde este enlace personal:
${input.cancelUrl}

Abrir el enlace no cancela nada: tendrás que confirmar la acción en la página. Si no has solicitado la cancelación, puedes ignorar este correo y tu participación no cambiará.

El equipo de HackSpain`;
}
