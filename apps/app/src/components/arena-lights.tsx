"use client";

import { gsap } from "gsap";
import { useLayoutEffect, useRef } from "react";

export function ArenaLights() {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const media = gsap.matchMedia(root);
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(".arena-light-left", { rotation: -27 }, {
        rotation: 28, duration: 5.4, ease: "sine.inOut", repeat: -1, yoyo: true,
      });
      gsap.fromTo(".arena-light-right", { rotation: 26 }, {
        rotation: -30, duration: 6.8, ease: "sine.inOut", repeat: -1, yoyo: true,
      });
      gsap.fromTo(".arena-light-center", { rotation: -12, opacity: 0.3 }, {
        rotation: 16, opacity: 0.8, duration: 4.2, ease: "sine.inOut", repeat: -1, yoyo: true,
      });
      gsap.fromTo(".arena-light-pool", { xPercent: -12, scaleX: 0.85, opacity: 0.3 }, {
        xPercent: 12, scaleX: 1.15, opacity: 0.6, duration: 5.4, ease: "sine.inOut", repeat: -1, yoyo: true,
      });
    });
    return () => media.revert();
  }, []);
  return (
    <div ref={root} aria-hidden className="pointer-events-none absolute inset-0 z-20 isolate overflow-hidden mix-blend-screen">
      <div className="arena-light arena-light-left" />
      <div className="arena-light arena-light-right" />
      <div className="arena-light arena-light-center" />
      <div className="arena-light-pool" />
    </div>
  );
}
