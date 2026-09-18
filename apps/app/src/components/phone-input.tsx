"use client";

import { useState } from "react";
import type { PhoneCountry } from "@convex/lib/phone";
import {
  DEFAULT_PHONE_COUNTRY,
  nationalNumberError,
  PHONE_COUNTRIES,
  splitPhone,
} from "@convex/lib/phone";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Regional indicator pair for an ISO code, e.g. "ES" → 🇪🇸. */
function flag(iso: string): string {
  return String.fromCodePoint(
    ...[...iso].map((letter) => 0x1_f1_e6 + (letter.codePointAt(0) ?? 65) - 65),
  );
}

function countryByIso(iso: string): PhoneCountry {
  return PHONE_COUNTRIES.find((country) => country.iso === iso) ?? DEFAULT_PHONE_COUNTRY;
}

/** The dropdown entry a stored E.164 number belongs to; Spain when unknown. */
function countryFor(e164: string | undefined): PhoneCountry {
  const split = e164 ? splitPhone(e164) : null;
  if (!split) {
    return DEFAULT_PHONE_COUNTRY;
  }
  return (
    PHONE_COUNTRIES.find((country) => country.code === split.code) ??
    DEFAULT_PHONE_COUNTRY
  );
}

/** Groups of three, the way people read a mobile number. */
function groupDigits(digits: string): string {
  return digits.replaceAll(/(\d{3})(?=\d)/g, "$1 ");
}

export type PhoneState = {
  /** `+34600111222`, or "" while the national part is empty. */
  e164: string;
  /** Why it cannot be saved yet, or null. */
  error: string | null;
};

function phoneState(iso: string, national: string): PhoneState {
  const country = countryByIso(iso);
  const digits = national.replaceAll(/\D/g, "");
  return {
    e164: digits ? `+${country.code}${digits}` : "",
    error: nationalNumberError(country.code, digits),
  };
}

/**
 * Country prefix (Spain by default) plus the national number, validated
 * against `convex/lib/phone.ts` as you type. `onChange` receives the E.164
 * string and the current error so the host can gate its submit button.
 */
export function PhoneInput({
  id,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  /** Stored E.164 number to start from. */
  value: string | undefined;
  onChange: (state: PhoneState) => void;
  disabled?: boolean;
}) {
  const [iso, setIso] = useState(() => countryFor(value).iso);
  const [national, setNational] = useState(() =>
    groupDigits(value ? (splitPhone(value)?.national ?? "") : ""),
  );
  // Complain once the field is left, or as soon as the number is already as
  // long as the country allows (so an extra digit is flagged while typing).
  const [touched, setTouched] = useState(false);
  const state = phoneState(iso, national);
  const digits = national.replaceAll(/\D/g, "");
  const longest = Math.max(...countryByIso(iso).lengths);
  const error =
    digits !== "" && (touched || digits.length >= longest) ? state.error : null;

  function update(nextIso: string, nextNational: string) {
    setIso(nextIso);
    setNational(nextNational);
    onChange(phoneState(nextIso, nextNational));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Select
          value={iso}
          disabled={disabled}
          onValueChange={(next) => update(next, national)}
        >
          <SelectTrigger className="w-[7.25rem] shrink-0" aria-label="Prefijo del país">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-72">
            {PHONE_COUNTRIES.map((country) => (
              <SelectItem key={country.iso} value={country.iso}>
                <span aria-hidden>{flag(country.iso)}</span>
                <span className="tabular-nums">+{country.code}</span>
                <span className="sr-only">{country.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={groupDigits("600111222")}
          value={national}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "tabular-nums",
            error &&
              "border-hs-red focus-visible:border-hs-red focus-visible:ring-hs-red/25",
          )}
          onChange={(event) => {
            const typed = event.target.value;
            // A pasted "+34 600…" moves its prefix to the dropdown.
            if (typed.trim().startsWith("+")) {
              const split = splitPhone(typed);
              if (split) {
                const country = PHONE_COUNTRIES.find(
                  (entry) => entry.code === split.code,
                );
                if (country) {
                  update(country.iso, groupDigits(split.national));
                  return;
                }
              }
            }
            update(iso, groupDigits(typed.replaceAll(/\D/g, "")));
          }}
          onBlur={() => setTouched(true)}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-hs-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
