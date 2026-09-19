export type ParseResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

function pathSegments(pathname: string): string[] {
  return pathname.split("/").filter((part) => part.length > 0);
}

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const [id] = pathSegments(url.pathname);
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (
    host !== "youtube.com" &&
    host !== "m.youtube.com" &&
    host !== "youtube-nocookie.com"
  ) {
    return null;
  }
  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v");
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  }
  const [kind, id] = pathSegments(url.pathname);
  if ((kind === "embed" || kind === "shorts" || kind === "live") && id) {
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  return null;
}

function asUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

export function parseYoutubeWatchUrl(raw: string): ParseResult {
  const url = asUrl(raw);
  if (!url) {
    return {
      ok: false,
      message: "Pega un enlace de YouTube (youtube.com o youtu.be).",
    };
  }
  const id = youtubeId(url);
  if (!id) {
    return {
      ok: false,
      message: "Tiene que ser un vídeo de YouTube, no Loom ni un archivo.",
    };
  }
  return { ok: true, value: `https://www.youtube.com/watch?v=${id}` };
}

export function parseGithubRepoUrl(raw: string): ParseResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: "El repo de GitHub es obligatorio." };
  }
  const github =
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(
      trimmed
    );
  const short = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(
    trimmed
  );
  const owner = github?.[1] ?? short?.[1];
  const repo = github?.[2] ?? short?.[2];
  if (!owner || !repo || owner === "." || repo === ".") {
    return {
      ok: false,
      message: "Usa https://github.com/org/repo (sin /tree ni /blob).",
    };
  }
  return { ok: true, value: `https://github.com/${owner}/${repo}` };
}

export function parseOptionalProductUrl(
  raw: string | undefined
): ParseResult | { ok: true; value: undefined } {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return { ok: true, value: undefined };
  }
  const url = asUrl(trimmed);
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
    return {
      ok: false,
      message: "El enlace del producto tiene que empezar por http(s)://",
    };
  }
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return {
      ok: false,
      message: "El enlace del producto tiene que ser público, no localhost.",
    };
  }
  return { ok: true, value: url.href };
}

export function parseProjectName(raw: string): ParseResult {
  const name = raw.trim();
  if (name.length < 2) {
    return { ok: false, message: "Ponle un nombre al proyecto (mínimo 2 caracteres)." };
  }
  if (name.length > 80) {
    return { ok: false, message: "El nombre es demasiado largo." };
  }
  return { ok: true, value: name };
}
