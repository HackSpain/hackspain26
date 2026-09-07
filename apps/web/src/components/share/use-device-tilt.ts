import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/** iOS gates the sensor behind a permission call that needs a user gesture. */
type PermissionCapableOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

interface DeviceTilt {
  needsPermission: boolean;
  requestAccess: () => Promise<void>;
  /** Left-right tilt in degrees, or null until the sensor reports. */
  tilt: RefObject<number | null>;
}

function orientationApi(): PermissionCapableOrientation | null {
  if (typeof DeviceOrientationEvent === "undefined") {
    return null;
  }
  return DeviceOrientationEvent as PermissionCapableOrientation;
}

/**
 * Reports the phone's left-right tilt through a ref rather than state: the
 * sensor fires at frame rate, and re-rendering the scene on every reading would
 * cost far more than the reading is worth.
 */
export function useDeviceTilt(): DeviceTilt {
  const tilt = useRef<number | null>(null);
  const neutralTilt = useRef<number | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    const api = orientationApi();
    if (!api) {
      return;
    }
    if (typeof api.requestPermission === "function") {
      setNeedsPermission(true);
      return;
    }
    setListening(true);
  }, []);

  useEffect(() => {
    if (!listening) {
      return;
    }
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null) {
        return;
      }
      if (neutralTilt.current === null) {
        neutralTilt.current = event.gamma;
        tilt.current = 0;
        return;
      }
      tilt.current = event.gamma - neutralTilt.current;
    };
    const recalibrate = () => {
      neutralTilt.current = null;
      tilt.current = null;
    };
    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("orientationchange", recalibrate);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("orientationchange", recalibrate);
    };
  }, [listening]);

  const requestAccess = useCallback(async () => {
    const api = orientationApi();
    if (typeof api?.requestPermission !== "function") {
      return;
    }
    try {
      const state = await api.requestPermission();
      if (state === "granted") {
        setListening(true);
        setNeedsPermission(false);
      }
    } catch {
      /* Denied, or called outside a user gesture — leave the button in place. */
    }
  }, []);

  return { needsPermission, requestAccess, tilt };
}
