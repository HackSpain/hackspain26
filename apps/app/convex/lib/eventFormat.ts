const DATE_FORMAT = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "long",
  timeZone: "Europe/Madrid",
  weekday: "long",
});

/** "sábado, 3 de octubre, 10:00" in Madrid time. */
export function formatEventDate(ms: number): string {
  return DATE_FORMAT.format(new Date(ms));
}

const DAY_FORMAT = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Madrid",
  year: "numeric",
});

function madridDay(ms: number): { day: string; month: string; year: string } {
  const parts = DAY_FORMAT.formatToParts(new Date(ms));
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return { day, month, year };
}

/** Compact Madrid range for emails. Missing bounds leave the caller to fall back. */
export function editionDatesLine(
  startsAt?: number,
  endsAt?: number
): string | undefined {
  if (startsAt === undefined || endsAt === undefined) {
    return undefined;
  }
  const start = madridDay(startsAt);
  const end = madridDay(endsAt);
  if (start.month === end.month && start.year === end.year) {
    return `Madrid · ${start.day}—${end.day} ${start.month} ${start.year}`;
  }
  if (start.year === end.year) {
    return `Madrid · ${start.day} ${start.month} — ${end.day} ${end.month} ${start.year}`;
  }
  return `Madrid · ${start.day} ${start.month} ${start.year} — ${end.day} ${end.month} ${end.year}`;
}
