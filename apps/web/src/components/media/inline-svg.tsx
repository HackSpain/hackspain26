import type { HTMLAttributes } from "react";

interface Props {
  className?: string;
  decorative?: boolean;
  /** Stretch SVG to fill the box edge-to-edge (distorts if aspect ratio differs). */
  fill?: "none";
  label?: string;
  svg: string;
}

const HAS_PRESERVE_ASPECT = /preserveAspectRatio="/;
const PRESERVE_ASPECT_ATTR = /preserveAspectRatio="[^"]*"/;
const OPEN_SVG_TAG = /<svg\b/;

function svgWithPreserveRatio(svg: string, ratio: string): string {
  if (HAS_PRESERVE_ASPECT.test(svg)) {
    return svg.replace(PRESERVE_ASPECT_ATTR, `preserveAspectRatio="${ratio}"`);
  }
  return svg.replace(OPEN_SVG_TAG, `<svg preserveAspectRatio="${ratio}"`);
}

export function InlineSvg({
  svg,
  className = "",
  decorative = false,
  label,
  fill,
}: Props) {
  let a11y: HTMLAttributes<HTMLSpanElement>;
  if (label !== null && label !== undefined) {
    a11y = { "aria-label": label, role: "img" };
  } else if (decorative) {
    a11y = { "aria-hidden": true };
  } else {
    a11y = {};
  }
  const html = fill === "none" ? svgWithPreserveRatio(svg, "none") : svg;
  const base =
    fill === "none"
      ? "flex min-h-0 min-w-0 flex-1 [&>svg]:block [&>svg]:h-full [&>svg]:w-full [&>svg]:min-h-0 [&>svg]:min-w-0"
      : "inline-flex max-w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full [&>svg]:max-w-full";
  return (
    <span
      className={`${base} ${className}`.trim()}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG markup is authored/bundled in-repo, not user input.
      dangerouslySetInnerHTML={{ __html: html }}
      {...a11y}
    />
  );
}
