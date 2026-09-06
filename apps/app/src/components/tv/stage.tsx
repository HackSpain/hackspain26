import type { ReactNode } from "react";
import type { TvWidget } from "@/lib/tv";
import { cn } from "@/lib/utils";
import { TvWidgetView } from "./widgets";

export function TvStage({
  widgets,
  fill = false,
  className,
  children,
  renderWidget,
}: {
  widgets: TvWidget[];
  fill?: boolean;
  className?: string;
  children?: ReactNode;
  renderWidget?: (widget: TvWidget) => ReactNode;
}) {
  return (
    <div
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
      {children}
    </div>
  );
}
