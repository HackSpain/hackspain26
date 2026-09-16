import { cn } from "@/lib/utils";

type TrackLike = { label: string; logoUrl?: string; website?: string };

/**
 * Sponsor logo for a track. Wordmarks are shown on a light plate so PNGs
 * with transparent backgrounds read on any surface; without a logo the
 * label is rendered instead, so callers never need a fallback of their own.
 */
export function TrackLogo({
  track,
  className,
}: {
  track: TrackLike;
  className?: string;
}) {
  if (!track.logoUrl) {
    return (
      <span className={cn("font-bungee text-sm leading-none", className)}>
        {track.label}
      </span>
    );
  }
  return (
    // Sponsor assets live under /public or on the sponsor's CDN; plain img keeps them out of next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={track.logoUrl}
      alt={track.label}
      className={cn("h-6 w-auto max-w-40 object-contain object-left", className)}
    />
  );
}

/**
 * Compact chip used wherever a challenge is listed. The wordmark already
 * names the sponsor, so the label is only shown when there is no logo; it
 * stays available to screen readers and as a tooltip.
 */
export function TrackTag({
  track,
  className,
}: {
  track: TrackLike;
  className?: string;
}) {
  return (
    <span
      title={track.label}
      className={cn(
        "inline-flex max-w-full items-center border border-hs-ink/30 bg-hs-paper px-1.5 py-0.5 text-[11px] uppercase tracking-wide",
        className,
      )}
    >
      {track.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.logoUrl}
          alt={track.label}
          className="h-4 w-auto max-w-24 shrink-0 object-contain"
        />
      ) : (
        <span className="min-w-0 truncate">{track.label}</span>
      )}
    </span>
  );
}
