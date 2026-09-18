import {
  countriesForCode,
  normalizePhone,
  splitPhone,
} from "../../../app/convex/lib/phone";

/**
 * The dashboard's phone rules (`apps/app/convex/lib/phone.ts`, a pure module
 * the binary bundles), with English messages for the prompt. Same outcome as
 * `users.setPhone` on the server, so a rejected number never makes the trip.
 */
export function validatePhone(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Enter your number.";
  }
  if (normalizePhone(trimmed)) {
    return;
  }
  const hasPrefix = trimmed.startsWith("+") || trimmed.startsWith("00");
  if (!hasPrefix) {
    return "Start with your country code, like +34 600 111 222.";
  }
  const digits = (
    trimmed.startsWith("00") ? trimmed.slice(2) : trimmed
  ).replaceAll(/\D/g, "");
  const split = splitPhone(`+${digits}`);
  if (!split) {
    return "That does not look like a phone number.";
  }
  if (split.national === "") {
    return "Add the number after the country code.";
  }
  const countries = countriesForCode(split.code);
  const lengths = [
    ...new Set(countries.flatMap((country) => country.lengths)),
  ].toSorted((a, b) => a - b);
  if (!lengths.includes(split.national.length)) {
    const expected =
      lengths.length === 1
        ? `${lengths[0]} digits`
        : `${lengths[0]} to ${lengths.at(-1)} digits`;
    return `A +${split.code} number has ${expected}.`;
  }
  return `A +${split.code} number does not start with ${split.national[0]}.`;
}

/** E.164 for a value `validatePhone` accepted. */
export function formatPhone(value: string): string {
  return normalizePhone(value) ?? value.trim();
}
