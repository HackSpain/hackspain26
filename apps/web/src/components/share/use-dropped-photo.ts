import type { ChangeEvent, DragEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

interface DroppedPhoto {
  /** True while a file is being dragged over the page. */
  isDragging: boolean;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  photo: HTMLImageElement | null;
}

function isImageDrag(event: DragEvent<HTMLElement>): boolean {
  return [...event.dataTransfer.items].some(
    (item) => item.kind === "file" && item.type.startsWith("image/")
  );
}

/**
 * Accepts a photo dropped anywhere on the page and decodes it in the browser.
 * The object URL is revoked as soon as the image is decoded or replaced, so the
 * file itself never outlives the drop. What the caller does with the decoded
 * image is its own business: the confirmation page saves a small square copy so
 * the badge in its link preview can show it.
 */
export function useDroppedPhoto(): DroppedPhoto {
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [dragDepth, setDragDepth] = useState(0);
  const objectUrl = useRef<string | null>(null);

  const releaseUrl = useCallback(() => {
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
  }, []);

  useEffect(() => releaseUrl, [releaseUrl]);

  const loadPhoto = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/") || file.size > MAX_PHOTO_BYTES) {
        return;
      }

      releaseUrl();
      const url = URL.createObjectURL(file);
      objectUrl.current = url;

      const image = new Image();
      image.addEventListener(
        "load",
        () => {
          setPhoto(image);
          releaseUrl();
        },
        { once: true }
      );
      image.addEventListener("error", releaseUrl, { once: true });
      image.src = url;
    },
    [releaseUrl]
  );

  const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (isImageDrag(event)) {
      // Without this the browser navigates away to the dropped file.
      event.preventDefault();
      setDragDepth(1);
    }
  }, []);

  const onDragLeave = useCallback(() => setDragDepth(0), []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      setDragDepth(0);
      const file = [...event.dataTransfer.files].find((candidate) =>
        candidate.type.startsWith("image/")
      );
      if (!file) {
        return;
      }
      event.preventDefault();
      loadPhoto(file);
    },
    [loadPhoto]
  );

  const onFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (file) {
        loadPhoto(file);
      }
    },
    [loadPhoto]
  );

  return {
    isDragging: dragDepth > 0,
    onDragLeave,
    onDragOver,
    onDrop,
    onFileChange,
    photo,
  };
}
