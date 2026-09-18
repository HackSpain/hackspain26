"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { SplitText } from "gsap/SplitText";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { usePrefersReducedMotion } from "./motion";

gsap.registerPlugin(useGSAP, CustomEase, SplitText, ScrambleTextPlugin);

export { gsap, SplitText, useGSAP };

// Same curves as `--ease-out` in globals.css and the landing, so the venue
// screen moves like the rest of the brand.
function brandEase(name: string, curve: string) {
  return CustomEase.get(name) ?? CustomEase.create(name, curve);
}

export const TV_EASE_OUT = brandEase("hs-out", "0.23,1,0.32,1");
export const TV_EASE_MOVE = brandEase("hs-in-out", "0.77,0,0.175,1");
export const TV_EASE_POP = "back.out(1.4)";
/** Reduced motion keeps short opacity fades so changes stay legible. */
export const TV_REDUCED_FADE = 0.2;
export const TV_GOLD = "#eab619";
export const TV_INK = "#2a170f";
export const TV_PAPER = "#f4ecd8";

let visibilityBound = false;

/**
 * Effects can be torn down mid-tween (StrictMode replays, fast data). Jumping
 * to the end state before killing keeps rows from freezing half-hidden.
 */
export function settle(animation: gsap.core.Animation) {
  animation.progress(1).kill();
}

/** Kiosks stay open for days: freeze every tween while the tab is hidden. */
export function useTvVisibilityPause() {
  useEffect(() => {
    if (visibilityBound) {return;}
    visibilityBound = true;
    const sync = () => {
      if (document.visibilityState === "visible") {gsap.globalTimeline.resume();}
      else {gsap.globalTimeline.pause();}
    };
    document.addEventListener("visibilitychange", sync);
  }, []);
}

/**
 * Tweens a number in place and writes the formatted value to the element.
 * React renders the final value; the layout effect rewinds it before paint.
 */
export function useCountUp<T extends HTMLElement = HTMLSpanElement>(
  value: number,
  format: (value: number) => string,
  options?: { duration?: number; fromZero?: boolean },
) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<T>(null);
  const shown = useRef(options?.fromZero ? 0 : value);
  const duration = options?.duration ?? 1;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {return;}
    if (reduced || shown.current === value) {
      shown.current = value;
      el.textContent = format(value);
      return;
    }
    const proxy = { value: shown.current };
    const tween = gsap.to(proxy, {
      value,
      duration,
      ease: TV_EASE_OUT,
      onUpdate: () => {
        shown.current = proxy.value;
        el.textContent = format(proxy.value);
      },
    });
    return () => {
      settle(tween);
    };
  }, [value, format, reduced, duration]);

  return ref;
}

/** Bars grow to their share instead of snapping to it. */
export function useBarWidth<T extends HTMLElement = HTMLDivElement>(
  ratio: number,
) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<T>(null);
  const width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {return;}
    if (reduced) {
      gsap.set(el, { width });
      return;
    }
    const tween = gsap.to(el, {
      width,
      duration: 0.9,
      ease: TV_EASE_OUT,
      overwrite: "auto",
    });
    return () => {
      settle(tween);
    };
  }, [width, reduced]);

  return ref;
}

/**
 * Rows keep a stable DOM order and slide to their rank with a transform, so
 * reordering never remounts anything. Each row must be absolutely positioned
 * with height = 100% / rows.
 */
export function useRankRows(order: readonly string[]) {
  const reduced = usePrefersReducedMotion();
  const nodes = useRef(new Map<string, HTMLElement>());
  const placed = useRef(new Set<string>());
  const key = order.join("|");

  const register = useCallback(
    (id: string) => (node: HTMLElement | null) => {
      if (node) {nodes.current.set(id, node);}
      else {nodes.current.delete(id);}
    },
    [],
  );

  useLayoutEffect(() => {
    const ids = key ? key.split("|") : [];
    const tweens: gsap.core.Tween[] = [];
    for (const [rank, id] of ids.entries()) {
      const el = nodes.current.get(id);
      if (!el) {continue;}
      const yPercent = rank * 100;
      if (reduced) {
        placed.current.add(id);
        gsap.set(el, { yPercent });
        continue;
      }
      if (!placed.current.has(id)) {
        placed.current.add(id);
        gsap.set(el, { yPercent });
        tweens.push(
          gsap.from(el, {
            x: -28,
            opacity: 0,
            duration: 0.7,
            ease: TV_EASE_OUT,
            delay: 0.3 + rank * 0.06,
            clearProps: "opacity",
          }),
        );
        continue;
      }
      tweens.push(
        gsap.to(el, {
          yPercent,
          duration: 0.7,
          ease: TV_EASE_MOVE,
          overwrite: "auto",
        }),
      );
    }
    return () => {
      for (const tween of tweens) {settle(tween);}
    };
  }, [key, reduced]);

  return register;
}

/**
 * Newest-first streams: when rows appear at the top, the list starts offset by
 * their height and slides back, so existing rows visibly make room.
 */
export function useStreamShift(
  listRef: RefObject<HTMLElement | null>,
  ids: readonly string[],
  onEnter?: (rows: HTMLElement[]) => void,
) {
  const reduced = usePrefersReducedMotion();
  const previous = useRef<Set<string> | null>(null);
  const key = ids.join("|");

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) {return;}
    const current = key ? key.split("|") : [];
    const seen = previous.current;
    previous.current = new Set(current);
    const rows = [...list.children].filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    );

    if (!seen) {
      if (reduced || rows.length === 0) {return;}
      const tween = gsap.from(rows, {
        opacity: 0,
        y: 14,
        duration: 0.7,
        ease: TV_EASE_OUT,
        stagger: 0.06,
        delay: 0.25,
        clearProps: "opacity,transform",
      });
      return () => {
        settle(tween);
      };
    }

    let fresh = 0;
    while (fresh < current.length && !seen.has(current[fresh] ?? "")) {fresh += 1;}
    if (fresh === 0) {return;}

    const entering = rows.slice(0, fresh);
    if (reduced) {
      const fade = gsap.fromTo(
        entering,
        { opacity: 0 },
        { opacity: 1, duration: TV_REDUCED_FADE, ease: "none", clearProps: "opacity" },
      );
      onEnter?.(entering);
      return () => {
        settle(fade);
      };
    }

    const anchor = rows[fresh];
    const first = rows[0];
    if (!first) {return;}
    const shift = anchor
      ? anchor.getBoundingClientRect().top - first.getBoundingClientRect().top
      : entering.reduce((sum, row) => sum + row.offsetHeight, 0);

    const timeline = gsap.timeline();
    timeline.fromTo(
      list,
      { y: -shift },
      { y: 0, duration: 0.75, ease: TV_EASE_OUT, clearProps: "transform" },
    );
    timeline.fromTo(
      entering,
      { opacity: 0, x: -18 },
      {
        opacity: 1,
        x: 0,
        duration: 0.6,
        ease: TV_EASE_OUT,
        stagger: 0.05,
        clearProps: "opacity,transform",
      },
      0.1,
    );
    onEnter?.(entering);
    return () => {
      settle(timeline);
    };
  }, [key, listRef, reduced, onEnter]);
}

/**
 * Gold flash through a `[data-flash]` overlay. Tailwind v4 emits `color-mix()`
 * backgrounds, which GSAP cannot interpolate, so we fade a layer instead.
 */
export function flashGold(targets: HTMLElement | HTMLElement[], duration = 1.4) {
  const list = Array.isArray(targets) ? targets : [targets];
  const layers = list.flatMap((el) =>
    el.matches("[data-flash]")
      ? [el]
      : [...el.querySelectorAll<HTMLElement>("[data-flash]")],
  );
  if (layers.length === 0) {
    return null;
  }
  return gsap.fromTo(
    layers,
    { opacity: 0.85 },
    { opacity: 0, duration, ease: "power2.out" },
  );
}

/** Overlay class for `flashGold`; the parent needs `relative`. */
export const FLASH_LAYER_CLASS =
  "pointer-events-none absolute inset-0 bg-hs-gold opacity-0";
