import { useState, useCallback, useRef } from "react";

const STORAGE_KEY = "fieldiq_prefer_ultrawide";

interface CameraDevice {
  deviceId: string;
  label: string;
  index: number;
}

/**
 * Detects available rear cameras and provides cycling between them.
 * On most phones, camera 0 = standard, camera 1 = ultra-wide, camera 2 = telephoto.
 * Since labels are unreliable (especially on Android), we enumerate all rear cameras
 * and let the user cycle through them.
 */
export function useUltraWideCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState(0);
  const [switching, setSwitching] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const detectDone = useRef(false);
  const detectPromise = useRef<Promise<CameraDevice[]> | null>(null);

  /**
   * Detect rear cameras. Returns a promise that resolves to the detected devices.
   * Safe to call multiple times — only runs once.
   */
  const detectCameras = useCallback((): Promise<CameraDevice[]> => {
    if (detectDone.current) return Promise.resolve(cameras);
    if (detectPromise.current) return detectPromise.current;

    detectPromise.current = (async () => {
      try {
        // Need a temporary stream to get labeled devices
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        tempStream.getTracks().forEach((t) => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");

        // Debug: log all cameras found
        console.log("[UltraWide] All video devices:", videoDevices.map(d => ({
          id: d.deviceId.slice(0, 8),
          label: d.label,
        })));

        // Filter out front-facing cameras using robust heuristics for Android
        // Android Chrome often labels cameras as "camera2 X, facing back/front"
        const rearCandidates = videoDevices.filter((d) => {
          const label = d.label.toLowerCase();
          // Explicitly exclude "facing front" (Android Chrome format)
          if (label.includes("facing front")) return false;
          // Exclude "facetime" (macOS)
          if (label.includes("facetime")) return false;
          // Exclude generic "front" only when NOT also containing back/rear/environment
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

        // Use all video devices if filtering left us with none
        const finalList = rearCandidates.length > 0 ? rearCandidates : videoDevices;

        const mapped: CameraDevice[] = finalList.map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Kamera ${i + 1}`,
          index: i,
        }));

        console.log(`[UltraWide] Detected ${mapped.length} rear camera(s):`, mapped.map(c => c.label));

        setCameras(mapped);
        detectDone.current = true;
        return mapped;
      } catch (err) {
        console.warn("[UltraWide] Camera detection failed:", err);
        detectDone.current = true;
        return [];
      }
    })();

    return detectPromise.current;
  }, [cameras]);

  /** Get a readable label for the current camera */
  const currentCameraLabel = useCallback((): string => {
    if (cameras.length === 0) return "Kamera";
    const cam = cameras[activeCameraIndex];
    if (!cam) return "Kamera";
    const label = cam.label.toLowerCase();
    if (label.includes("ultra") || label.includes("wide") || label.includes("weitwinkel") || label.includes("0.5")) {
      return "0.5x Weitwinkel";
    }
    if (label.includes("tele") || label.includes("zoom") || label.includes("2x") || label.includes("3x")) {
      return `${activeCameraIndex + 1}x Tele`;
    }
    // Default: show index-based label
    if (cameras.length <= 1) return "1x";
    return `Kamera ${activeCameraIndex + 1}/${cameras.length}`;
  }, [cameras, activeCameraIndex]);

  /**
   * Initialize or switch the camera stream.
   * Ensures camera detection has completed before selecting a device.
   */
  const initStream = useCallback(
    async (cameraIdx?: number): Promise<MediaStream | null> => {
      // Ensure detection is done before using cameras list
      const detectedCameras = await detectCameras();

      // Stop existing stream
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

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        return stream;
      } catch {
        return null;
      }
    },
    [detectCameras, activeCameraIndex, videoRef],
  );

  /** Cycle to the next camera */
  const cycleCamera = useCallback(async () => {
    const detectedCameras = await detectCameras();
    if (detectedCameras.length <= 1 || switching) return;

    setSwitching(true);
    const nextIdx = (activeCameraIndex + 1) % detectedCameras.length;
    const stream = await initStream(nextIdx);

    if (stream) {
      setActiveCameraIndex(nextIdx);
    }
    setSwitching(false);
  }, [detectCameras, switching, activeCameraIndex, initStream]);

  /** Get the current stream ref */
  const getStream = useCallback(() => streamRef.current, []);

  const hasMultipleCameras = cameras.length > 1;

  return {
    /** Whether multiple rear cameras were detected */
    hasMultipleCameras,
    /** Number of detected cameras (useful for debug display) */
    cameraCount: cameras.length,
    /** Index of the currently active camera */
    activeCameraIndex,
    /** True while switching cameras */
    switching,
    /** Cycle to the next available camera */
    cycleCamera,
    /** Initialize camera stream (call instead of raw getUserMedia) */
    initStream,
    /** Get current MediaStream */
    getStream,
    /** Detected camera devices */
    cameras,
    /** Human-readable label for the active camera */
    currentCameraLabel,
    /** Force re-detection of cameras */
    detectCameras,
  };
}

/** Read the stored preference for camera index */
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
