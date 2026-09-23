import { useEffect, useRef, useState } from "react";
import { splitBadgeName } from "../../lib/badge-name";
import { OG_BADGE_HEIGHT, OG_BADGE_WIDTH } from "../../lib/badge-share-params";
import { copyToClipboard } from "../../lib/copy-to-clipboard";
import { InlineSvg } from "../media/inline-svg";
import { LINKEDIN_SVG, WHATSAPP_SVG, X_SVG } from "../theme/constants";
import { hsButtonClass } from "../ui/button-styles";
import { badgePhotoDataUri } from "./badge-photo-file";
import { ConfettiBurst } from "./confetti-burst";
import LanyardBadge from "./lanyard-badge";
import { ShareBackdrop } from "./share-backdrop";
import { useDeviceTilt } from "./use-device-tilt";
import { useDroppedPhoto } from "./use-dropped-photo";
import { useImageFromSrc } from "./use-image-from-src";

const POST_TEXT_TAIL =
  " Ya tengo mi acreditación: 48 horas construyendo en Madrid con 250 hackers más. Nos vemos allí.";
/**
 * X turns `@hackspain26` into a link to the account, so the post mentions it
 * there. LinkedIn has no plain-text equivalent — a handle typed into the
 * composer's prefilled text stays dead text — so it keeps the readable name.
 */
const X_POST_TEXT = `¡Voy a @hackspain26!${POST_TEXT_TAIL}`;
const LINKEDIN_POST_TEXT = `¡Voy a HackSpain 2026!${POST_TEXT_TAIL}`;
/** Keeps the link clear of the text so the post shows it as its own line. */
const POST_LINK_SEPARATOR = "\n\n";
const COPIED_RESET_MS = 2000;
const BADGE_DOWNLOAD_NAME = "acreditacion-hackspain-2026.png";

type CopyState = "copied" | "failed" | "idle";

const COPY_LABELS: Record<CopyState, string> = {
  copied: "¡Copiado!",
  failed: "Cópialo tú",
  idle: "Copiar enlace",
};

interface Props {
  /** Same-origin path to the badge image, so it can be downloaded directly. */
  badgeImagePath: string;
  fullName: string;
  githubHandle: string | null;
  /** Authorises saving a badge photo against their own signup. */
  managementToken: string;
  /** The photo already saved on their badge, so a reload keeps showing it. */
  photoDataUri: string | null;
  /** Version of the photo already stored, if they set one before. */
  photoVersion: number | null;
  /** Public page the share buttons point at. */
  shareUrl: string;
  whatsappUrl: string | null;
}

export function ConfirmationPage({
  badgeImagePath,
  fullName,
  githubHandle,
  managementToken,
  photoDataUri,
  photoVersion: storedPhotoVersion,
  shareUrl,
  whatsappUrl,
}: Props) {
  const { tilt, needsPermission, requestAccess } = useDeviceTilt();
  const { photo, isDragging, onDragOver, onDragLeave, onDrop, onFileChange } =
    useDroppedPhoto();
  const fileInput = useRef<HTMLInputElement>(null);
  const wind = useRef(0);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [linkedinOpen, setLinkedinOpen] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(storedPhotoVersion);
  const [savingPhoto, setSavingPhoto] = useState(false);

  const { firstName, lastName } = splitBadgeName(fullName);

  /** Whatever they saved earlier, until they drop something new over it. */
  const savedPhoto = useImageFromSrc(photoDataUri);

  /*
   * The photo they drop only lives in this tab, but the social image is drawn on
   * the server. So a small square copy is saved against their signup, and the
   * badge someone else sees carries the photo they actually chose.
   */
  useEffect(() => {
    if (!photo) {
      return;
    }

    const dataUri = badgePhotoDataUri(photo);
    if (!dataUri) {
      return;
    }

    let cancelled = false;
    setSavingPhoto(true);

    fetch("/api/badge-photo", {
      body: JSON.stringify({ photo: dataUri, token: managementToken }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { version?: number | null } | null) => {
        if (!cancelled && body) {
          setPhotoVersion(body.version ?? Date.now());
        }
      })
      .catch(() => {
        /* The badge on this page still shows it; only the shared copy lags. */
      })
      .finally(() => {
        if (!cancelled) {
          setSavingPhoto(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [photo, managementToken]);

  /** Cache-busted so a new photo is not hidden behind the stored image. */
  const badgeImageSrc = photoVersion
    ? `${badgeImagePath}&v=${photoVersion}`
    : badgeImagePath;

  /** Their words, then their badge link — worded per platform, see above. */
  const linkedinDraft = `${LINKEDIN_POST_TEXT}${POST_LINK_SEPARATOR}${shareUrl}`;
  const xDraft = `${X_POST_TEXT}${POST_LINK_SEPARATOR}${shareUrl}`;

  /*
   * The composer writes the post itself, but it cannot attach an image from a
   * URL. So LinkedIn opens the steps below rather than a link, and this fires
   * once the image is saved and ready to upload.
   */
  const linkedinHref = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(linkedinDraft)}`;
  /*
   * The whole post goes in `text`, with no `url` alongside it: X appends that
   * parameter with a space of its own, which would undo the separation above.
   */
  const xHref = `https://x.com/intent/tweet?text=${encodeURIComponent(xDraft)}`;

  const handleCopyLink = async () => {
    const succeeded = await copyToClipboard(shareUrl);
    setCopyState(succeeded ? "copied" : "failed");
    if (succeeded) {
      setTimeout(() => setCopyState("idle"), COPIED_RESET_MS);
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop target, not a control — the photo is optional decoration and everything else on the page is reachable without it.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same drop target.
    <div
      className="relative h-full w-full overflow-hidden bg-hs-paper"
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="absolute inset-0 z-0">
        <ShareBackdrop wind={wind} />
      </div>

      <input
        accept="image/*"
        className="sr-only"
        data-testid="photo-file-input"
        onChange={onFileChange}
        ref={fileInput}
        type="file"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-3 sm:px-8 sm:pt-6">
        <div className="pointer-events-auto mx-auto w-fit max-w-full select-none text-center">
          {/* Joining the group is the one thing that has to happen here, so it
              travels with the headline instead of queueing behind the sharing
              below, where it was the fourth button of four. */}
          <div className="border-[3px] border-hs-ink bg-hs-cream px-4 py-3 shadow-[6px_6px_0_0_var(--color-hs-ink)]">
            <h1 className="font-bungee text-[clamp(1.35rem,4.6vw,2.4rem)] text-hs-ink leading-none">
              Plaza confirmada
            </h1>
            {whatsappUrl && (
              <>
                <a
                  className={hsButtonClass(
                    "gold",
                    "md",
                    "mt-3 w-full gap-2 text-center"
                  )}
                  href={whatsappUrl}
                  rel="noopener"
                  target="_blank"
                >
                  <InlineSvg
                    className="h-4 w-4"
                    decorative
                    svg={WHATSAPP_SVG}
                  />
                  Entrar al grupo de WhatsApp
                </a>
                <p className="mt-2 font-sans text-hs-brown text-xs">
                  Todos los avisos se harán en el grupo.
                </p>
              </>
            )}
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
          content={{
            droppedPhoto: photo ?? savedPhoto,
            firstName,
            githubHandle,
            lastName,
          }}
          onPhotoClick={() => fileInput.current?.click()}
          tilt={tilt}
          wind={wind}
        />
      </div>

      <ConfettiBurst />

      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-30 border-[6px] border-hs-ink border-dashed bg-hs-gold/10" />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-3 sm:pb-5">
        <div className="pointer-events-auto mx-auto flex max-w-2xl flex-col gap-3 border-[3px] border-hs-ink bg-hs-cream/95 p-4 shadow-[6px_6px_0_0_var(--color-hs-ink)]">
          {/* Opening LinkedIn takes over the panel: the other two ways out would
              only compete with the steps, so they wait behind the back button. */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="font-bungee text-hs-ink text-xs uppercase tracking-wide">
                {linkedinOpen ? "Compartir en LinkedIn" : "Compártelo"}
              </span>
              {/* Held back while the LinkedIn steps are open, where the panel is
                  about getting the image posted rather than about why. */}
              {!linkedinOpen && (
                <p className="mt-1 font-sans text-hs-brown text-xs">
                  Ayuda a que más builders se unan a HackSpain compartiendo tu
                  participación.
                </p>
              )}
            </div>
            {linkedinOpen && (
              <button
                className={hsButtonClass("teal", "micro", "!py-2")}
                onClick={() => setLinkedinOpen(false)}
                type="button"
              >
                Volver
              </button>
            )}
          </div>

          {!linkedinOpen && (
            <div className="flex flex-col gap-2 sm:flex-row">
              {/* The two platforms share a row on mobile, which keeps this panel
                  two rows tall instead of three and leaves the badge the height
                  it needs. `contents` dissolves the wrapper from sm up, so the
                  original three-across row is unchanged there. */}
              <div className="flex gap-2 sm:contents">
                {/* Both marks inherit the button's ink, so they read as lettering
                    rather than as the platforms' own badges. */}
                <button
                  aria-expanded={linkedinOpen}
                  className={hsButtonClass(
                    "gold",
                    "md",
                    "!px-3 sm:!px-6 min-w-0 flex-1 gap-2"
                  )}
                  onClick={() => setLinkedinOpen(true)}
                  type="button"
                >
                  <InlineSvg
                    className="h-4 w-4 shrink-0"
                    decorative
                    svg={LINKEDIN_SVG}
                  />
                  LinkedIn
                </button>
                <a
                  className={hsButtonClass(
                    "gold",
                    "md",
                    "!px-3 sm:!px-6 min-w-0 flex-1 gap-2 text-center"
                  )}
                  href={xHref}
                  rel="noopener"
                  target="_blank"
                >
                  <InlineSvg
                    className="h-4 w-4 shrink-0"
                    decorative
                    svg={X_SVG}
                  />
                  Twitter
                </a>
              </div>
              <button
                className={hsButtonClass("teal", "md", "flex-1")}
                onClick={handleCopyLink}
                type="button"
              >
                {COPY_LABELS[copyState]}
              </button>
            </div>
          )}

          {/* Some browsers refuse the clipboard outright, so the link itself is
              offered rather than leaving a button that appears to do nothing. */}
          {copyState === "failed" && !linkedinOpen && (
            <input
              aria-label="Enlace a tu acreditación"
              className="w-full border-[3px] border-hs-ink bg-hs-paper px-3 py-2 font-sans text-hs-ink text-xs outline-none focus-visible:border-hs-navy"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              value={shareUrl}
            />
          )}

          {linkedinOpen && (
            <div className="flex flex-col gap-3 border-hs-ink border-t-[3px] pt-3">
              <img
                alt={`Acreditación de HackSpain 2026 a nombre de ${fullName}`}
                className="h-auto w-full border-[3px] border-hs-ink bg-hs-paper"
                height={OG_BADGE_HEIGHT}
                src={badgeImageSrc}
                width={OG_BADGE_WIDTH}
              />

              <ol className="flex flex-col gap-2">
                <li className="flex items-center justify-between gap-3">
                  <span className="font-sans text-hs-ink text-sm">
                    {savingPhoto
                      ? "Guardando tu foto en la imagen..."
                      : "1. Descarga la imagen"}
                  </span>
                  <a
                    className={hsButtonClass("teal", "micro", "!py-2")}
                    download={BADGE_DOWNLOAD_NAME}
                    href={badgeImageSrc}
                  >
                    Descargar
                  </a>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="font-sans text-hs-ink text-sm">
                    2. Súbela al post
                  </span>
                  <a
                    className={hsButtonClass("gold", "micro", "!py-2")}
                    href={linkedinHref}
                    rel="noopener"
                    target="_blank"
                  >
                    Abrir LinkedIn
                  </a>
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
