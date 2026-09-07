import type { ComponentPropsWithoutRef, Ref } from "react";
import type { HsButtonSize, HsButtonVariant } from "./button-styles";
import { hsButtonClass } from "./button-styles";

export type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: HsButtonVariant;
  size?: HsButtonSize;
};

export const Button = function Button({
  variant = "gold",
  size = "md",
  className,
  type = "button",
  ref,
  ...props
}: ButtonProps & { ref?: Ref<HTMLButtonElement | null> }) {
  return (
    <button
      className={hsButtonClass(variant, size, className)}
      ref={ref}
      type={type}
      {...props}
    />
  );
};

export type ButtonLinkProps = ComponentPropsWithoutRef<"a"> & {
  variant?: HsButtonVariant;
  size?: HsButtonSize;
};

export const ButtonLink = function ButtonLink({
  variant = "gold",
  size = "md",
  className,
  children,
  ref,
  ...props
}: ButtonLinkProps & { ref?: Ref<HTMLAnchorElement | null> }) {
  return (
    <a className={hsButtonClass(variant, size, className)} ref={ref} {...props}>
      {children}
    </a>
  );
};
