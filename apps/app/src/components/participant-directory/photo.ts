/**
 * The map draws every photo inside a 28px disc, yet uploads arrive at up to
 * 2MB and GitHub serves 460px avatars. Decoding and rescaling eighty of
 * those on every repaint is most of what made the graph crawl, so the disc
 * asks for a small copy: `/api/files/<id>?w=` resizes on our side and GitHub
 * honours `s=`. Other hosts are left alone.
 */
export const PHOTO_WIDTH = 128;

export function photoThumbnail(url: string, width = PHOTO_WIDTH): string {
	if (url.startsWith("/api/files/")) {
		const [path, query] = url.split("?", 2);
		const params = new URLSearchParams(query);
		params.set("w", String(width));
		return `${path}?${params}`;
	}
	if (URL.canParse(url)) {
		const parsed = new URL(url);
		if (parsed.hostname === "avatars.githubusercontent.com") {
			parsed.searchParams.set("s", String(width));
			return parsed.toString();
		}
	}
	return url;
}
