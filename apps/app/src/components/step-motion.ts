"use client";

import { useEffect, useState } from "react";

/**
 * Shared motion for multi-step cards (login, onboarding): steps slide in
 * from the side they advance towards while the card animates its height to
 * the new step.
 */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const SLIDE_PX = 24;

export type Direction = 1 | -1;

export const stepVariants = {
  active: { opacity: 1, x: 0 },
  exit: (direction: Direction) => ({ x: -direction * SLIDE_PX, opacity: 0 }),
  initial: (direction: Direction) => ({ x: direction * SLIDE_PX, opacity: 0 }),
};

export const reducedStepVariants = {
  active: { opacity: 1 },
  exit: { opacity: 0 },
  initial: { opacity: 0 },
};

/** Ref callback plus the node's live content height, for animating a wrapper to it. */
export function useMeasuredHeight(): [
  (node: HTMLElement | null) => void,
  number | null,
] {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!node) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setHeight(entry.contentRect.height);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, height];
}
