import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "fieldiq_prefer_ultrawide";

interface CameraDevice {
  deviceId: string;
  label: string;
  isUltraWide: boolean;
}

/**
 * Detects available rear cameras, identifies the ultra-wide lens,
 * and provides a toggle to switch between standard and ultra-wide.
 */
export function useUltraWideCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [useUltraWide, setUseUltraWide] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [switching, setSwitching] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Detect rear cameras on mount
  const detectCameras = useCallback(async () => {
    try {
      // Need a temporary stream to get labeled devices
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      tempStream.getTracks().forEach((t) => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");

      // Identify ultra-wide by label heuristics
      const mapped: CameraDevice[] = videoDevices
        .filter((d) => {
          const label = d.label.toLowerCase();
          // Filter to rear-facing cameras (heuristic: not "front", or contains "back"/"rear"/"environment")
          return (
            !label.includes("front") ||
            label.includes("back") ||
            label.includes("rear") ||
            label.includes("environment")
          );
        })
        .map((d) => {
          const label = d.label.toLowerCase();
          const isUltraWide =
            label.includes("ultra") ||
            label.includes("wide") ||
            label.includes("weitwinkel") ||
            label.includes("0.5") ||
            label.includes("13mm") ||
            label.includes("16mm");
          return {
            deviceId: d.deviceId,
            label: d.label,
            isUltraWide,
          };
        });

      setCameras(mapped);
    } catch {
      // Can't enumerate — single camera assumed
    }
  }, []);

  useEffect(() => {
    detectCameras();
  }, [detectCameras]);

  const ultraWideDevice = cameras.find((c) => c.isUltraWide);
  const standardDevice = cameras.find((c) => !c.isUltraWide);
  const hasUltraWide = !!ultraWideDevice && !!standardDevice;

  /** Initialize or switch the camera stream */
  const initStream = useCallback(
    async (preferUltraWide: boolean): Promise<MediaStream | null> => {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const targetDevice = preferUltraWide && ultraWideDevice ? ultraWideDevice : standardDevice;

      const constraints: MediaStreamConstraints = {
        video: targetDevice
          ? {
              deviceId: { exact: targetDevice.deviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            }
          : {
              facingMode: "environment",
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
        audio: false,
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        return stream;
      } catch {
        return null;
      }
    },
    [ultraWideDevice, standardDevice, videoRef],
  );

  /** Toggle between standard and ultra-wide */
  const toggle = useCallback(async () => {
    if (!hasUltraWide || switching) return;

    setSwitching(true);
    const next = !useUltraWide;
    const stream = await initStream(next);

    if (stream) {
      setUseUltraWide(next);
    }
    setSwitching(false);
  }, [hasUltraWide, switching, useUltraWide, initStream]);

  /** Get the current stream ref */
  const getStream = useCallback(() => streamRef.current, []);

  return {
    /** Whether an ultra-wide camera was detected */
    hasUltraWide,
    /** Whether ultra-wide is currently active */
    useUltraWide,
    /** True while switching cameras */
    switching,
    /** Toggle between 0.5x and 1x */
    toggle,
    /** Initialize camera stream (call instead of raw getUserMedia) */
    initStream,
    /** Get current MediaStream */
    getStream,
    /** Detected camera devices */
    cameras,
  };
}

/** Read the stored preference */
export function getUltraWidePreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Save the stored preference */
export function setUltraWidePreference(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // localStorage not available
  }
}
