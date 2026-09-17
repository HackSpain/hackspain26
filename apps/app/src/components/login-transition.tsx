"use client";

import { gsap } from "gsap";
import { useReducedMotion } from "motion/react";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Curtain shown from the moment a login code is accepted until the page the
 * user lands on has mounted. Without it the gate flips through "Cargando…",
 * remounts the login card for a frame and only then reaches the dashboard.
 *
 * The auth gate owns the lifecycle (it knows when the destination is
 * rendered); the login page only calls the context function to begin.
 */
const LoginTransitionContext = createContext<(email: string | null) => void>(
  () => {
    // No gate above (a page rendered outside it): nothing to cover.
  },
);

export const LoginTransitionProvider = LoginTransitionContext.Provider;

export function useBeginLoginTransition() {
  return useContext(LoginTransitionContext);
}

const BANDS = [
  "bg-hs-navy",
  "bg-hs-teal",
  "bg-hs-gold",
  "bg-hs-orange",
  "bg-hs-red",
] as const;

/** Seconds the curtain stays closed once fully risen, so a fast sign-in still reads as a scene change. */
const HOLD_S = 0.25;

export function LoginTransition({
  email,
  ready,
  onDone,
}: {
  email: string | null;
  /** The destination page is mounted underneath; lift the curtain. */
  ready: boolean;
  onDone: () => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const root = useRef<HTMLDivElement>(null);
  const scope = useRef<gsap.Context | null>(null);
  const entrance = useRef<gsap.core.Timeline | null>(null);
  const done = useRef(onDone);

  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  // Rise. `from` renders its start state synchronously and this runs before
  // paint, so the bands never show fully up for a frame.
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      if (reduced) {
        tl.from(root.current, { autoAlpha: 0, duration: 0.16, ease: "none" });
      } else {
        tl.from("[data-band]", {
          yPercent: 100,
          duration: 0.55,
          ease: "expo.out",
          stagger: 0.06,
        }).from(
          "[data-plate]",
          { autoAlpha: 0, y: 16, scale: 0.97, duration: 0.4, ease: "power3.out" },
          "-=0.3",
        );
        gsap.to("[data-slider]", {
          xPercent: 200,
          duration: 0.9,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      }
      entrance.current = tl;
    }, root);
    scope.current = ctx;
    return () => {
      ctx.revert();
      scope.current = null;
      entrance.current = null;
    };
  }, [reduced]);

  // Lift, once the rise has finished and the destination is underneath.
  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;
    void entrance.current?.then(() => {
      if (cancelled) {
        return;
      }
      scope.current?.add(() => {
        const tl = gsap.timeline({
          delay: HOLD_S,
          onComplete: () => done.current(),
        });
        if (reduced) {
          tl.to(root.current, { autoAlpha: 0, duration: 0.2, ease: "none" });
          return;
        }
        tl.to("[data-plate]", {
          autoAlpha: 0,
          y: -10,
          scale: 0.98,
          duration: 0.18,
          ease: "power2.in",
        }).to(
          "[data-band]",
          {
            yPercent: -100,
            duration: 0.5,
            ease: "expo.inOut",
            stagger: 0.05,
          },
          "-=0.1",
        );
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, reduced]);

  return (
    <div ref={root} className="fixed inset-0 z-[70] overflow-hidden">
      <div aria-hidden className="absolute inset-0">
        {BANDS.map((tone, index) => (
          <div
            key={tone}
            data-band
            className={cn("absolute inset-y-0", tone)}
            style={{
              left: `${index * 20}%`,
              // A hair of overlap hides sub-pixel seams between bands.
              width: "calc(20% + 1px)",
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div
          data-plate
          className="flex w-full max-w-xs flex-col items-center border-[3px] border-hs-ink bg-hs-paper px-8 py-8"
        >
          <img
            src="/logo.svg"
            alt="HackSpain"
            width={250}
            height={80}
            className="h-auto w-40"
          />
          <div
            aria-hidden
            className="mt-6 h-[3px] w-24 overflow-hidden bg-hs-sand"
          >
            <div data-slider className="h-full w-8 bg-hs-gold" />
          </div>
          <p
            role="status"
            className="mt-5 font-bungee text-xs tracking-wide text-hs-brown"
          >
            Entrando…
          </p>
          {email ? (
            <p className="mt-1 max-w-full break-all text-center text-sm text-hs-ink">
              {email}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
