import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "fieldiq_prefer_ultrawide";

interface CameraDevice {
  deviceId: string;
  label: string;
  index: number;
}

/**
 * Detects available rear cameras and provides cycling between them.
 * On most phones, camera 0 = standard, camera 1 = ultra-wide, camera 2 = telephoto.
 * Since labels are unreliable, we let the user cycle through all rear cameras.
 */
export function useUltraWideCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState(0);
  const [switching, setSwitching] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const detectDone = useRef(false);

  // Detect rear cameras on mount
  const detectCameras = useCallback(async () => {
    if (detectDone.current) return;
    try {
      // Need a temporary stream to get labeled devices
      const tempStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      tempStream.getTracks().forEach((t) => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");

      // Filter out front-facing cameras (best-effort heuristic)
      const rearCandidates = videoDevices.filter((d) => {
        const label = d.label.toLowerCase();
        // Exclude devices explicitly labeled as front-facing
        if (label.includes("front") && !label.includes("back") && !label.includes("rear")) {
          return false;
        }
        // Exclude devices labeled "facetime" (macOS)
        if (label.includes("facetime")) return false;
        return true;
      });

      // Use all video devices if filtering left us with none
      const finalList = rearCandidates.length > 0 ? rearCandidates : videoDevices;

      const mapped: CameraDevice[] = finalList.map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Kamera ${i + 1}`,
        index: i,
      }));

      setCameras(mapped);
      detectDone.current = true;
    } catch {
      // Can't enumerate — single camera assumed
    }
  }, []);

  useEffect(() => {
    detectCameras();
  }, [detectCameras]);

  const hasMultipleCameras = cameras.length > 1;

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

  /** Initialize or switch the camera stream */
  const initStream = useCallback(
    async (cameraIdx?: number): Promise<MediaStream | null> => {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const targetIdx = cameraIdx ?? activeCameraIndex;
      const targetDevice = cameras[targetIdx];

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
    [cameras, activeCameraIndex, videoRef],
  );

  /** Cycle to the next camera */
  const cycleCamera = useCallback(async () => {
    if (!hasMultipleCameras || switching) return;

    setSwitching(true);
    const nextIdx = (activeCameraIndex + 1) % cameras.length;
    const stream = await initStream(nextIdx);

    if (stream) {
      setActiveCameraIndex(nextIdx);
    }
    setSwitching(false);
  }, [hasMultipleCameras, switching, activeCameraIndex, cameras.length, initStream]);

  /** Get the current stream ref */
  const getStream = useCallback(() => streamRef.current, []);

  return {
    /** Whether multiple rear cameras were detected */
    hasMultipleCameras,
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
