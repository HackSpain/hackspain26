"use client";

import { Toaster as Sonner } from "sonner";
import type { ToasterProps } from "sonner";

/**
 * Brand-styled Sonner. Unstyled base with the same vocabulary as `Alert`:
 * a 3 px ink border, flat paper fill and a coloured border per status.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      offset={20}
      mobileOffset={16}
      gap={10}
      duration={4000}
      visibleToasts={3}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-start gap-3 border-[3px] border-hs-ink bg-hs-paper px-4 py-3 text-left text-sm text-hs-ink shadow-[4px_4px_0_0_var(--color-hs-ink)] sm:w-[22rem]",
          title: "font-medium leading-snug",
          description: "text-hs-brown leading-snug",
          icon: "mt-0.5 size-4 shrink-0 [&>svg]:size-4",
          error: "border-hs-red [&_[data-icon]]:text-hs-red",
          success: "border-hs-teal [&_[data-icon]]:text-hs-teal",
          info: "border-hs-navy [&_[data-icon]]:text-hs-navy",
          warning: "border-hs-gold [&_[data-icon]]:text-hs-gold",
          actionButton:
            "ml-auto shrink-0 border-2 border-hs-ink bg-hs-gold px-2.5 py-1 font-bungee text-xs uppercase text-hs-ink",
          cancelButton:
            "ml-auto shrink-0 border-2 border-hs-ink bg-hs-paper px-2.5 py-1 font-bungee text-xs uppercase text-hs-ink",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
