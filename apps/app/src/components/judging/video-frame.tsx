import { parseVideoUrl } from "@/lib/video";

export function VideoFrame({ url }: { url?: string }) {
  const embed = parseVideoUrl(url);

  return (
    <div className="aspect-video w-full overflow-hidden border-[3px] border-hs-ink bg-hs-ink outline outline-black/10">
      {embed?.kind === "file" ? (
        <video
          className="size-full bg-hs-ink object-contain"
          controls
          playsInline
          preload="metadata"
          src={embed.src}
        >
          <track kind="captions" srcLang="es" label="Sin subtítulos" />
          Tu navegador no puede reproducir este vídeo.
        </video>
      ) : embed ? (
        <iframe
          title="Vídeo del proyecto"
          src={embed.src}
          className="size-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-hs-sand px-4 text-center">
          <p className="text-sm font-medium text-pretty text-hs-brown">
            Este proyecto no tiene vídeo.
          </p>
        </div>
      )}
    </div>
  );
}
