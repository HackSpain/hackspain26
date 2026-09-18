import { CircleUserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export function initialsOf(name: string | null | undefined): string {
  return (
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() ?? ""
  );
}

/**
 * Profile picture with an initials fallback. `src` is a Vercel Blob URL, our
 * own /api/files path (legacy Convex uploads) or the GitHub avatar URL, so a
 * plain img is enough.
 */
export function Avatar({
  name,
  src,
  className,
  textClassName,
}: {
  name?: string | null;
  src?: string | null;
  className?: string;
  textClassName?: string;
}) {
  const initials = initialsOf(name);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden border-[3px] border-hs-ink bg-hs-gold font-bungee text-hs-ink",
        className,
      )}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : initials ? (
        <span className={textClassName}>{initials}</span>
      ) : (
        <CircleUserRound className="size-1/2" />
      )}
    </span>
  );
}
