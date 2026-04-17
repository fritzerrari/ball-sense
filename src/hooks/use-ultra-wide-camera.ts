import { useState, useCallback, useRef } from "react";

const STORAGE_KEY = "fieldiq_prefer_ultrawide";

/** Read the stored wide-angle default preference. */
export function getUltraWidePreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Save the stored wide-angle default preference. */
export function setUltraWidePreference(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // localStorage not available
  }
}

interface CameraDevice {
  deviceId: string;
  label: string;
  index: number;
}

type ZoomCapability = { min: number; max: number; step?: number };

/**
 * Provides wide-angle (0.5x) switching for mobile cameras.
 *
 * Strategy:
 * 1. Primary: Use `MediaStreamTrack.applyConstraints({ advanced: [{ zoom }] })`
 *    to switch zoom level — works on Pixel/Samsung where Chrome exposes a
 *    single logical camera with optical zoom range that automatically
 *    routes to the ultra-wide sensor at min zoom.
 * 2. Fallback: Cycle through enumerated rear devices (older Android, some
 *    custom ROMs) when the active track has no `zoom` capability.
 */
export function useUltraWideCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState(0);
  const [switching, setSwitching] = useState(false);
  const [zoomCapability, setZoomCapability] = useState<ZoomCapability | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number | null>(null);
  const [wideAngleActive, setWideAngleActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const detectDone = useRef(false);
  const detectPromise = useRef<Promise<CameraDevice[]> | null>(null);

  /** Detect rear cameras (used as fallback when zoom-API not available). */
  const detectCameras = useCallback((): Promise<CameraDevice[]> => {
    if (detectDone.current) return Promise.resolve(cameras);
    if (detectPromise.current) return detectPromise.current;

    detectPromise.current = (async () => {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        tempStream.getTracks().forEach((t) => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");

        const rearCandidates = videoDevices.filter((d) => {
          const label = d.label.toLowerCase();
          if (label.includes("facing front")) return false;
          if (label.includes("facetime")) return false;
          if (
            label.includes("front") &&
            !label.includes("back") &&
            !label.includes("rear") &&
            !label.includes("environment")
          ) {
            return false;
          }
          return true;
        });

        const finalList = rearCandidates.length > 0 ? rearCandidates : videoDevices;
        const mapped: CameraDevice[] = finalList.map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Kamera ${i + 1}`,
          index: i,
        }));

        setCameras(mapped);
        detectDone.current = true;
        return mapped;
      } catch {
        detectDone.current = true;
        return [];
      }
    })();

    return detectPromise.current;
  }, [cameras]);

  /** Inspect current track for zoom capability. */
  const inspectZoom = useCallback((stream: MediaStream) => {
    const track = stream.getVideoTracks()[0];
    if (!track || typeof track.getCapabilities !== "function") {
      setZoomCapability(null);
      setCurrentZoom(null);
      return;
    }
    const caps = track.getCapabilities() as MediaTrackCapabilities & { zoom?: ZoomCapability };
    if (caps.zoom && typeof caps.zoom.min === "number" && typeof caps.zoom.max === "number" && caps.zoom.max > caps.zoom.min) {
      setZoomCapability({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step });
      const settings = track.getSettings() as MediaTrackSettings & { zoom?: number };
      setCurrentZoom(settings.zoom ?? caps.zoom.min);
    } else {
      setZoomCapability(null);
      setCurrentZoom(null);
    }
  }, []);

  /** Initialize camera stream. */
  const initStream = useCallback(
    async (cameraIdx?: number): Promise<MediaStream | null> => {
      const detectedCameras = await detectCameras();

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const targetIdx = cameraIdx ?? activeCameraIndex;
      const targetDevice = detectedCameras[targetIdx];

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
        inspectZoom(stream);
        setWideAngleActive(false);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        return stream;
      } catch {
        return null;
      }
    },
    [detectCameras, activeCameraIndex, videoRef, inspectZoom],
  );

  /**
   * Toggle wide-angle mode. Prefers in-stream zoom (no flicker).
   * Falls back to device cycling for cameras without zoom capability.
   * Returns true if toggle succeeded, false if neither path is available.
   */
  const toggleWideAngle = useCallback(async (): Promise<boolean> => {
    if (switching) return false;

    // Path A: Zoom API (Pixel 8a, modern Samsung, etc.)
    if (zoomCapability && streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        setSwitching(true);
        try {
          const targetZoom = wideAngleActive ? 1 : zoomCapability.min;
          // Clamp to capability range
          const clamped = Math.max(zoomCapability.min, Math.min(zoomCapability.max, targetZoom));
          await track.applyConstraints({ advanced: [{ zoom: clamped }] as any });
          setCurrentZoom(clamped);
          setWideAngleActive(!wideAngleActive);
          setSwitching(false);
          return true;
        } catch {
          setSwitching(false);
          // fall through to device cycling
        }
      }
    }

    // Path B: Device cycling fallback
    const detectedCameras = await detectCameras();
    if (detectedCameras.length > 1) {
      setSwitching(true);
      const nextIdx = (activeCameraIndex + 1) % detectedCameras.length;
      const stream = await initStream(nextIdx);
      if (stream) {
        setActiveCameraIndex(nextIdx);
        setWideAngleActive(nextIdx !== 0);
      }
      setSwitching(false);
      return !!stream;
    }

    return false;
  }, [zoomCapability, wideAngleActive, switching, detectCameras, activeCameraIndex, initStream]);

  /** Whether wide-angle switching is available at all. */
  const wideAngleSupported =
    !!zoomCapability || cameras.length > 1;

  /** Human-readable label for current zoom/lens state. */
  const currentCameraLabel = useCallback((): string => {
    if (zoomCapability && currentZoom !== null) {
      if (currentZoom <= zoomCapability.min + 0.01) return "0.5x Weitwinkel";
      if (Math.abs(currentZoom - 1) < 0.01) return "1x";
      return `${currentZoom.toFixed(1)}x Zoom`;
    }
    if (cameras.length === 0) return "1x";
    if (cameras.length === 1) return "1x";
    return wideAngleActive ? "Weitwinkel" : "1x";
  }, [zoomCapability, currentZoom, cameras.length, wideAngleActive]);

  const getStream = useCallback(() => streamRef.current, []);

  return {
    /** True if wide-angle toggling is available (zoom-API or multiple devices). */
    wideAngleSupported,
    /** True if currently in wide-angle mode. */
    wideAngleActive,
    /** Number of detected rear cameras (debug). */
    cameraCount: cameras.length,
    /** Whether the active stream exposes a zoom range (debug). */
    hasZoomCapability: !!zoomCapability,
    /** True while switching. */
    switching,
    /** Toggle between standard and wide-angle. */
    toggleWideAngle,
    /** Initialize camera stream. */
    initStream,
    /** Get current MediaStream. */
    getStream,
    /** Detected camera devices. */
    cameras,
    /** Human-readable label. */
    currentCameraLabel,
    /** Force re-detection. */
    detectCameras,
  };
}
