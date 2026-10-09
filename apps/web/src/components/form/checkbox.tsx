import type { ComponentPropsWithRef } from "react";

type HackSpainCheckboxProps = Omit<
  ComponentPropsWithRef<"input">,
  "type" | "size"
> & {
  size?: "default" | "large";
};

export function HackSpainCheckbox({
  size = "default",
  ...inputProps
}: HackSpainCheckboxProps) {
  const isLarge = size === "large";
  const sizeClass = isLarge ? "h-6 w-6" : "h-4 w-4";
  const borderClass = isLarge
    ? "border-[3px] shadow-[2px_2px_0_0_var(--color-hs-ink)]"
    : "border-2";

  return (
    <span className={`relative mt-px ${sizeClass} shrink-0`}>
      <input
        {...inputProps}
        className={`peer absolute inset-0 z-10 ${sizeClass} cursor-pointer appearance-none opacity-0`}
        type="checkbox"
      />
      <span
        aria-hidden
        className={`pointer-events-none flex ${sizeClass} items-center justify-center rounded-sm border-hs-ink bg-hs-paper ${borderClass} transition-colors peer-checked:bg-hs-gold peer-hover:bg-hs-sand/55 peer-focus-visible:border-hs-navy [&_svg]:opacity-0 peer-checked:[&_svg]:opacity-100`}
      >
        <svg
          fill="none"
          height={isLarge ? 14 : 10}
          viewBox="0 0 14 14"
          width={isLarge ? 14 : 10}
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Marca de verificación</title>
          <path
            d="M2.5 7.2 5.6 10.3 11.5 3.8"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={isLarge ? 2.2 : 1.8}
          />
        </svg>
      </span>
    </span>
  );
}
