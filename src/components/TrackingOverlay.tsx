import { useRef, useEffect } from "react";
import type { Detection } from "@/lib/football-tracker";

interface TrackingOverlayProps {
  detections: Detection[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Canvas overlay that draws crosshair markers for detected players and ball.
 * Meant to be absolutely positioned over a video element.
 */
export function TrackingOverlay({ detections, width = 1280, height = 720, className }: TrackingOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas to display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // Only draw persons and ball — filter out other labels
    const validDetections = detections.filter(d => d.label === "person" || d.label === "ball");
    let playerIndex = 0;

    for (const det of validDetections) {
      const cx = det.x * w;
      const cy = det.y * h;

      if (det.label === "ball") {
        // Ball: yellow circle
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(250, 204, 21, 0.9)";
        ctx.fill();
        ctx.strokeStyle = "rgba(250, 204, 21, 1)";
        ctx.lineWidth = 2;
        ctx.stroke();
        continue;
      }

      // Player crosshair
      const isHome = det.team === "home" || !det.team;
      const color = isHome ? "rgba(59, 130, 246, 0.9)" : "rgba(239, 68, 68, 0.9)";
      const fillColor = isHome ? "rgba(59, 130, 246, 0.15)" : "rgba(239, 68, 68, 0.15)";
      const r = 10;
      const crossLen = 6;

      // Circle
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(cx - crossLen, cy);
      ctx.lineTo(cx + crossLen, cy);
      ctx.moveTo(cx, cy - crossLen);
      ctx.lineTo(cx, cy + crossLen);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ID label — use sequential player index for consistent numbering
      playerIndex++;
      ctx.font = "bold 9px system-ui";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.fillText(String(playerIndex), cx, cy - r - 3);
    }
  }, [detections, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
