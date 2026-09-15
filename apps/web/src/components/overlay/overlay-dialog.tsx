import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { Children, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useOverlayLock } from "./overlay-lock";

export function OverlayDialog({
  children,
  onClose,
  titleId,
  width = "max-w-4xl",
}: {
  children: ReactNode;
  onClose: () => void;
  titleId: string;
  width?: "max-w-3xl" | "max-w-4xl";
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  useOverlayLock(true);

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
      if (event.key === "Tab") {
        const elements = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex="0"]'
        );
        const first = elements?.[0];
        const last = elements ? [...elements].at(-1) : undefined;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [onClose]);

  // Keep the portal outside the transformed mosaic, including during exit.
  return createPortal(
    <motion.div
      animate="visible"
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-hs-ink/97"
      exit="exit"
      initial="hidden"
      ref={dialogRef}
      role="dialog"
      variants={{
        exit: { opacity: 0, transition: { duration: 0.16 } },
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            delayChildren: reducedMotion ? 0 : 0.05,
            duration: 0.2,
            staggerChildren: reducedMotion ? 0 : 0.08,
          },
        },
      }}
    >
      <button
        aria-label="Cerrar"
        className="group fixed top-4 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-hs-paper/30 bg-hs-ink text-hs-paper shadow-lg transition-[background-color,border-color,color,scale] duration-150 hover:border-hs-gold hover:bg-hs-gold hover:text-hs-ink focus-visible:outline-2 focus-visible:outline-hs-gold focus-visible:outline-offset-4 active:scale-[0.96] motion-reduce:transition-none sm:top-6 sm:right-8"
        onClick={onClose}
        ref={closeRef}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
      <div className={`mx-auto px-3 pt-20 pb-10 sm:px-4 sm:py-16 ${width}`}>
        {Children.map(children, (child) => (
          <motion.div
            variants={{
              exit: {
                opacity: 0,
                transition: { duration: 0.12, ease: "easeOut" },
                y: reducedMotion ? 0 : -6,
              },
              hidden: { opacity: 0, y: reducedMotion ? 0 : 20 },
              visible: {
                opacity: 1,
                transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
                y: 0,
              },
            }}
          >
            {child}
          </motion.div>
        ))}
      </div>
    </motion.div>,
    document.body
  );
}
