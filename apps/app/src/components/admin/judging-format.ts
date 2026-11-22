export function randomSeed(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

export function formatSigned(value: number | null): string {
  if (value === null) {
    return "—";
  }
  const fixed = Math.abs(value).toFixed(2);
  if (value > 0) {
    return `+${fixed}`;
  }
  if (value < 0) {
    return `−${fixed}`;
  }
  return fixed;
}

export function formatDate(value: number): string {
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}
