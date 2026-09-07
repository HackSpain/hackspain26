import type { ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement } from "react";
import {
  hsHintClass,
  hsLabelBungeeClass,
  hsLabelSansClass,
} from "./field-classes";

type LabelVariant = "bungee" | "sans";

export interface FormFieldProps {
  children: ReactElement<{ id?: string }>;
  className?: string;
  hint?: ReactNode;
  id: string;
  label: ReactNode;
  labelVariant?: LabelVariant;
  required?: boolean;
}

export function FormField({
  id,
  label,
  hint,
  required,
  labelVariant = "bungee",
  className,
  children,
}: FormFieldProps) {
  const labelTextClass =
    labelVariant === "bungee" ? hsLabelBungeeClass : hsLabelSansClass;

  const control = isValidElement(children)
    ? cloneElement(children, { id })
    : children;

  return (
    <div className={className}>
      <label className="flex flex-col gap-1" htmlFor={id}>
        <span className={labelTextClass}>
          {label}
          {required ? " *" : null}
        </span>
        {hint === null || hint === undefined ? null : (
          <span className={hsHintClass}>{hint}</span>
        )}
        {control}
      </label>
    </div>
  );
}
