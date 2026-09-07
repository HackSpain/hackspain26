import type { ClipboardEvent, FocusEvent } from "react";
import type { ProfileFieldKind } from "../../lib/signup-validation";
import { cleanProfilePasteText } from "../../lib/signup-validation";

const socialComboWrapClass =
  "flex w-full min-w-0 rounded-sm border-[3px] border-hs-ink bg-hs-paper transition-[border-color] duration-150 ease-out focus-within:border-hs-navy [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_var(--color-hs-paper)]";

const socialPrefixClass =
  "inline-flex shrink-0 items-center self-stretch whitespace-nowrap border-r-[3px] border-hs-ink bg-hs-sand/45 px-2 font-mono text-[clamp(0.62rem,2.2vw,0.8125rem)] font-bold leading-tight tracking-tight text-hs-ink select-none sm:px-2.5 sm:text-sm";

const socialInnerInputClass =
  "font-sans min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-base text-hs-ink outline-none focus:outline-none focus-visible:outline-none [color-scheme:light] placeholder:text-hs-ink/42 selection:bg-hs-gold/50 selection:text-hs-ink focus:ring-0 focus-visible:ring-0 [&:-webkit-autofill]:[-webkit-text-fill-color:var(--color-hs-ink)]";

export interface SocialPrefixInputProps {
  id?: string;
  name: string;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onChange: (value: string) => void;
  placeholder: string;
  prefix: string;
  profileKind: ProfileFieldKind;
  value: string;
}

export function SocialPrefixInput({
  id,
  name,
  prefix,
  profileKind,
  value,
  onChange,
  onBlur,
  placeholder,
}: SocialPrefixInputProps) {
  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const raw = e.clipboardData.getData("text/plain");
    onChange(cleanProfilePasteText(raw, profileKind));
  }

  return (
    <div className={socialComboWrapClass}>
      <span aria-hidden="true" className={socialPrefixClass}>
        {prefix}
      </span>
      <input
        autoComplete="off"
        className={socialInnerInputClass}
        id={id ?? undefined}
        inputMode="text"
        name={name}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        placeholder={placeholder}
        spellCheck={false}
        type="text"
        value={value}
      />
    </div>
  );
}
