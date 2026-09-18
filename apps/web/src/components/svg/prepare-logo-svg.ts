const SVG_COMMENT_RE = /<!--[\s\S]*?-->\s*/g;
const CRLF_TO_LF = /\r\n/g;
const LOGO_DIMENSIONS_RE = /<svg width="928" height="306"/;

export function prepareLogoSvg(raw: string): string {
  return raw
    .replace(SVG_COMMENT_RE, "")
    .replace(CRLF_TO_LF, "\n")
    .replace(
      LOGO_DIMENSIONS_RE,
      '<svg role="img" aria-label="HACKSPAIN" focusable="false" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"'
    );
}
