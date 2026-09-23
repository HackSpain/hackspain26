import { useRef } from "react";
import { splitBadgeName } from "../../lib/badge-name";
import { hsButtonClass } from "../ui/button-styles";
import LanyardBadge from "./lanyard-badge";
import { ShareBackdrop } from "./share-backdrop";
import { useDeviceTilt } from "./use-device-tilt";
import { useImageFromSrc } from "./use-image-from-src";

interface Props {
  fullName: string;
  githubHandle: string | null;
  /** The photo they put on their badge, when they chose one over their avatar. */
  photoDataUri: string | null;
}

/**
 * Someone else's badge, opened from a shared link. It stays playable, because
 * throwing the card around is the whole appeal, but it offers nothing to edit
 * and nothing to share: the only way on from here is into the event itself.
 */
export function BadgeShowcase({ fullName, githubHandle, photoDataUri }: Props) {
  const { tilt, needsPermission, requestAccess } = useDeviceTilt();
  const wind = useRef(0);
  const { firstName, lastName } = splitBadgeName(fullName);
  // Takes the same slot a dropped photo would, which already wins over the
  // avatar, so the card here matches the one in the link preview.
  const photo = useImageFromSrc(photoDataUri);

  return (
    <div className="relative h-full w-full overflow-hidden bg-hs-paper">
      <div className="absolute inset-0 z-0">
        <ShareBackdrop wind={wind} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-3 sm:px-8 sm:pt-6">
        <div className="pointer-events-auto mx-auto w-fit max-w-full select-none text-center">
          {/* Boxed like the headline on the confirmation page: the two share the
              same scene, so they should be recognisably the same place. */}
          <div className="border-[3px] border-hs-ink bg-hs-cream px-4 py-3 shadow-[6px_6px_0_0_var(--color-hs-ink)]">
            <h1 className="font-bungee text-[clamp(1.35rem,4.6vw,2.4rem)] text-hs-ink leading-none">
              {firstName} va a HackSpain 2026
            </h1>
            <p className="mt-2 font-sans text-hs-brown text-xs">
              Del 18 al 20 de septiembre en Madrid.
            </p>
          </div>
          {needsPermission && (
            <button
              className={hsButtonClass("teal", "micro", "!py-2 mt-3")}
              onClick={requestAccess}
              type="button"
            >
              Activar movimiento
            </button>
          )}
        </div>
      </div>

      <div className="absolute inset-0 z-10">
        <LanyardBadge
          content={{ droppedPhoto: photo, firstName, githubHandle, lastName }}
          tilt={tilt}
          wind={wind}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-3 sm:pb-5">
        <div className="pointer-events-auto mx-auto flex max-w-md flex-col items-center gap-3 border-[3px] border-hs-ink bg-hs-cream/95 p-4 text-center shadow-[6px_6px_0_0_var(--color-hs-ink)]">
          <span className="font-sans text-hs-brown text-sm">
            48 horas construyendo en la UPM, con 250 hackers más.
          </span>
          <a className={hsButtonClass("gold", "md", "w-full")} href="/">
            Descubre HackSpain
          </a>
        </div>
      </div>
    </div>
  );
}
