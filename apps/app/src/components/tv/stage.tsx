"use client";

import { useRef } from "react";
import type { ReactNode, RefObject } from "react";
import type { TvWidget } from "@/lib/tv";
import { cn } from "@/lib/utils";
import {
  gsap,
  TV_EASE_OUT,
  TV_REDUCED_FADE,
  useGSAP,
  useTvVisibilityPause,
} from "./gsap";
import { usePrefersReducedMotion } from "./motion";
import { TvWidgetView } from "./widgets";

/**
 * Widgets wipe in from a diagonal sweep, top-left to bottom-right, the way
 * landing cells slide onto the mosaic. Only the venue screen opts in.
 */
function useStageEntrance(
  root: RefObject<HTMLDivElement | null>,
  widgets: TvWidget[],
  enabled: boolean,
) {
  const reduced = usePrefersReducedMotion();
  useTvVisibilityPause();
  const key = widgets.map((widget) => widget._id).join("|");

  useGSAP(
    () => {
      const stage = root.current;
      if (!enabled || !stage) {return;}
      if (reduced) {
        gsap.fromTo(
          stage.querySelectorAll("[data-tv-box]"),
          { opacity: 0 },
          { opacity: 1, duration: TV_REDUCED_FADE, ease: "none", clearProps: "opacity" },
        );
        return;
      }
      const order = widgets.toSorted(
        (a, b) => a.y + a.x * 0.6 - (b.y + b.x * 0.6),
      );
      const boxes = order
        .map((widget) =>
          stage.querySelector<HTMLElement>(`[data-tv-box="${widget._id}"]`),
        )
        .filter((node): node is HTMLElement => node !== null);
      const sweep = stage.querySelector<HTMLElement>("[data-tv-sweep]");
      if (boxes.length === 0) {return;}

      try {
        const timeline = gsap.timeline({ defaults: { ease: TV_EASE_OUT } });
        if (sweep) {
          timeline.fromTo(
            sweep,
            { yPercent: 0, opacity: 1 },
            { yPercent: 100 * 100, opacity: 0.4, duration: 1.1, ease: "power2.inOut" },
            0,
          );
          timeline.to(sweep, { opacity: 0, duration: 0.3 }, ">-0.1");
        }
        timeline.fromTo(
          boxes,
          { clipPath: "inset(0% 0% 100% 0%)", y: 36, opacity: 0 },
          {
            clipPath: "inset(0% 0% 0% 0%)",
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.07,
            clearProps: "clipPath,opacity,transform",
          },
          0.12,
        );
      } catch {
        gsap.set(boxes, { clearProps: "clipPath,opacity,transform" });
      }
    },
    { scope: root, dependencies: [key, enabled, reduced], revertOnUpdate: true },
  );
}

export function TvStage({
  widgets,
  fill = false,
  className,
  children,
  renderWidget,
  enter = false,
}: {
  widgets: TvWidget[];
  fill?: boolean;
  className?: string;
  children?: ReactNode;
  renderWidget?: (widget: TvWidget) => ReactNode;
  /** Play the mosaic-style entrance when the layout mounts. */
  enter?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useStageEntrance(root, widgets, enter && !renderWidget);

  return (
    <div
      ref={root}
      className={cn(
        "relative overflow-hidden bg-hs-ink [container-type:size]",
        fill ? "h-full w-full" : "aspect-video w-full",
        className,
      )}
    >
      {widgets.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <p className="font-bungee text-[clamp(1.5rem,6cqw,5rem)] text-hs-gold/60 uppercase">
            Madrid · 2026
          </p>
        </div>
      ) : (
        widgets.map((widget) =>
          renderWidget ? (
            renderWidget(widget)
          ) : (
            <div
              key={widget._id}
              data-tv-box={widget._id}
              className="absolute overflow-hidden"
              style={{
                left: `${widget.x}%`,
                top: `${widget.y}%`,
                width: `${widget.w}%`,
                height: `${widget.h}%`,
                zIndex: widget.z,
              }}
            >
              <TvWidgetView widget={widget} />
            </div>
          ),
        )
      )}
      {enter && !renderWidget && widgets.length > 0 ? (
        <div
          data-tv-sweep
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-50 h-[1%] bg-hs-gold opacity-0 shadow-[0_0_2cqw_0.3cqw_rgba(234,182,25,0.45)]"
        />
      ) : null}
      {children}
    </div>
  );
}
