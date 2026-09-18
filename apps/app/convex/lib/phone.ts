/**
 * Phone numbers as E.164 with a real country prefix. The dashboard offers the
 * prefix as a dropdown (Spain by default) and the national number as a text
 * box; the CLI still takes one string. Either way the value stored is
 * `+<code><national>` and the national part must have a length that exists
 * for that country. No verification: this is a contact number for the venue.
 */

export type PhoneCountry = {
  /** ISO 3166-1 alpha-2, for the dropdown key and the flag. */
  iso: string;
  /** Country calling code, digits only. */
  code: string;
  name: string;
  /** Allowed national number lengths (digits after the country code). */
  lengths: readonly number[];
  /** First digits a national number may start with, when the plan is that regular (Spain). */
  leading?: RegExp;
};

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

/** Spain first, then the rest alphabetically by Spanish name. */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { iso: "ES", code: "34", name: "España", lengths: [9], leading: /^[6789]/ },
  { iso: "DE", code: "49", name: "Alemania", lengths: range(7, 12) },
  { iso: "AD", code: "376", name: "Andorra", lengths: [6, 8, 9] },
  { iso: "AR", code: "54", name: "Argentina", lengths: [10, 11] },
  { iso: "AT", code: "43", name: "Austria", lengths: range(7, 13) },
  { iso: "BE", code: "32", name: "Bélgica", lengths: [8, 9] },
  { iso: "BO", code: "591", name: "Bolivia", lengths: [8] },
  { iso: "BR", code: "55", name: "Brasil", lengths: [10, 11] },
  { iso: "CA", code: "1", name: "Canadá", lengths: [10] },
  { iso: "CL", code: "56", name: "Chile", lengths: [9] },
  { iso: "CO", code: "57", name: "Colombia", lengths: [10] },
  { iso: "CR", code: "506", name: "Costa Rica", lengths: [8] },
  { iso: "CU", code: "53", name: "Cuba", lengths: [8] },
  { iso: "DK", code: "45", name: "Dinamarca", lengths: [8] },
  { iso: "EC", code: "593", name: "Ecuador", lengths: [9] },
  { iso: "SV", code: "503", name: "El Salvador", lengths: [8] },
  { iso: "US", code: "1", name: "Estados Unidos", lengths: [10] },
  { iso: "FI", code: "358", name: "Finlandia", lengths: range(6, 11) },
  { iso: "FR", code: "33", name: "Francia", lengths: [9] },
  { iso: "GR", code: "30", name: "Grecia", lengths: [10] },
  { iso: "GT", code: "502", name: "Guatemala", lengths: [8] },
  { iso: "HN", code: "504", name: "Honduras", lengths: [8] },
  { iso: "IE", code: "353", name: "Irlanda", lengths: range(7, 9) },
  { iso: "IT", code: "39", name: "Italia", lengths: range(6, 11) },
  { iso: "LU", code: "352", name: "Luxemburgo", lengths: range(6, 9) },
  { iso: "MA", code: "212", name: "Marruecos", lengths: [9] },
  { iso: "MX", code: "52", name: "México", lengths: [10] },
  { iso: "NI", code: "505", name: "Nicaragua", lengths: [8] },
  { iso: "NO", code: "47", name: "Noruega", lengths: [8] },
  { iso: "NL", code: "31", name: "Países Bajos", lengths: [9] },
  { iso: "PA", code: "507", name: "Panamá", lengths: [7, 8] },
  { iso: "PY", code: "595", name: "Paraguay", lengths: [9] },
  { iso: "PE", code: "51", name: "Perú", lengths: [9] },
  { iso: "PL", code: "48", name: "Polonia", lengths: [9] },
  { iso: "PT", code: "351", name: "Portugal", lengths: [9] },
  { iso: "GB", code: "44", name: "Reino Unido", lengths: [10] },
  { iso: "CZ", code: "420", name: "República Checa", lengths: [9] },
  { iso: "DO", code: "1", name: "República Dominicana", lengths: [10] },
  { iso: "RO", code: "40", name: "Rumanía", lengths: [9] },
  { iso: "SE", code: "46", name: "Suecia", lengths: range(7, 10) },
  { iso: "CH", code: "41", name: "Suiza", lengths: [9] },
  { iso: "UY", code: "598", name: "Uruguay", lengths: [8] },
  { iso: "VE", code: "58", name: "Venezuela", lengths: [10] },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0] as PhoneCountry;

export const PHONE_ERROR =
  "Introduce un teléfono válido con el prefijo de tu país, como +34 600 111 222";

/** Distinct calling codes, longest first, so "+351" is not read as "+35" + "1". */
const CODES = [...new Set(PHONE_COUNTRIES.map((country) => country.code))].toSorted(
  (a, b) => b.length - a.length,
);

/** Every country sharing a calling code (+1 covers several). */
export function countriesForCode(code: string): PhoneCountry[] {
  return PHONE_COUNTRIES.filter((country) => country.code === code);
}

/** Split `+34600111222` into its prefix and national part, when we know the prefix. */
export function splitPhone(e164: string): { code: string; national: string } | null {
  const digits = e164.replaceAll(/\D/g, "");
  const code = CODES.find((candidate) => digits.startsWith(candidate));
  if (!code) {
    return null;
  }
  return { code, national: digits.slice(code.length) };
}

/** Why `national` is not a number for `code`, or null when it is fine. */
export function nationalNumberError(code: string, national: string): string | null {
  const digits = national.replaceAll(/\D/g, "");
  if (digits === "") {
    return "Escribe tu número.";
  }
  const countries = countriesForCode(code);
  if (countries.length === 0) {
    // Unknown prefix (CLI free text): loose E.164, 8 to 15 digits in total.
    const total = code.length + digits.length;
    return total >= 8 && total <= 15 ? null : "Ese número no parece válido.";
  }
  const lengthOk = countries.some((country) => country.lengths.includes(digits.length));
  if (!lengthOk) {
    const lengths = [
      ...new Set(countries.flatMap((country) => country.lengths)),
    ].toSorted((a, b) => a - b);
    const expected =
      lengths.length === 1
        ? `${lengths[0]} cifras`
        : `entre ${lengths[0]} y ${lengths.at(-1)} cifras`;
    return `Un número con prefijo +${code} tiene ${expected}.`;
  }
  const leadingOk = countries.some(
    (country) => !country.leading || country.leading.test(digits),
  );
  if (!leadingOk) {
    return `Un número con prefijo +${code} no empieza por ${digits[0]}.`;
  }
  return null;
}

/**
 * E.164 for `input`, or null when it is not a phone number. Accepts "+34 600…",
 * "0034 600…" and, with no prefix at all, a bare Spanish number (9 digits
 * starting with 6-9); anything else without a prefix is rejected so we never
 * store a number we could not dial.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  let digits = trimmed.replaceAll(/\D/g, "");
  const hasPrefix = trimmed.startsWith("+") || trimmed.startsWith("00");
  if (trimmed.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (!hasPrefix) {
    const spain = DEFAULT_PHONE_COUNTRY;
    if (spain.lengths.includes(digits.length) && spain.leading?.test(digits)) {
      return `+${spain.code}${digits}`;
    }
    return null;
  }
  const split = splitPhone(`+${digits}`);
  if (split) {
    return nationalNumberError(split.code, split.national) === null ? `+${digits}` : null;
  }
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}
