import type { Artboard } from "../mosaic/artboard";
import { ARTBOARD_DESKTOP } from "../mosaic/artboard";

export function vp(
  x: number,
  y: number,
  w: number,
  h: number,
  artboard: Artboard = ARTBOARD_DESKTOP
): React.CSSProperties {
  return {
    height: `${(h / artboard.h) * 100}%`,
    left: `${(x / artboard.w) * 100}%`,
    position: "absolute",
    top: `${(y / artboard.h) * 100}%`,
    width: `${(w / artboard.w) * 100}%`,
  };
}

export function P({
  bg = "bg-hs-paper",
  align = "center",
  className,
  children,
}: {
  bg?: string;
  align?: "center" | "start";
  className?: string;
  /** Optional — `<P bg="…" />` is used throughout as an empty colored spacer. */
  children?: React.ReactNode;
}) {
  const a =
    align === "start"
      ? "items-start justify-start"
      : "items-center justify-center";
  return (
    <div
      className={[
        "flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden",
        a,
        "@[180px]:gap-2 gap-1 @[180px]:p-3 p-1.5",
        bg,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
