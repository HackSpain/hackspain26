const SVG_COMMENT_RE = /<!--[\s\S]*?-->\s*/g;
const CRLF_TO_LF = /\r\n/g;
const FILL_NONE_ATTR_RE = /\sfill="none"\s/g;
const WIDTH_HEIGHT_ATTR_RE = /\bwidth="[^"]*"\s*height="[^"]*"\s*/g;
const STROKE_WIDTH_ATTR_RE = /stroke-width="[^"]*"/g;
const OPEN_SVG_TAG_RE = /<svg\b/;

export function prepareIllustrationSvg(raw: string): string {
  let out = raw
    .replace(SVG_COMMENT_RE, "")
    .replace(CRLF_TO_LF, "\n")
    .replace(FILL_NONE_ATTR_RE, " ")
    .replace(WIDTH_HEIGHT_ATTR_RE, "");

  // Keep the original strokes and fills, but ensure they are thick enough and use the ink color
  out = out.replace(STROKE_WIDTH_ATTR_RE, 'stroke-width="3"');

  // Normalize dark export colors to the site ink token
  out = out.replaceAll(/#4a2c1f/gi, "var(--color-hs-ink)");
  out = out.replaceAll(/#401a05/gi, "var(--color-hs-ink)");
  out = out.replaceAll(/#33211a/gi, "var(--color-hs-ink)");
  out = out.replaceAll(/#3f291e/gi, "var(--color-hs-ink)");
  out = out.replaceAll(/#3b2719/gi, "var(--color-hs-ink)");
  out = out.replaceAll(/#010b1b/gi, "var(--color-hs-ink)");
  out = out.replaceAll(/#000000/gi, "var(--color-hs-ink)");
  out = out.replaceAll(/#000\b/gi, "var(--color-hs-ink)");

  out = out.replace(
    OPEN_SVG_TAG_RE,
    '<svg focusable="false" aria-hidden="true" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"'
  );

  return out;
}
