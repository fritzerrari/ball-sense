import AppLayout from "@/components/AppLayout";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Crosshair, Save, ArrowLeft, RotateCcw, Move, Info, Undo2 } from "lucide-react";
import { useField, useSaveCalibration } from "@/hooks/use-fields";
import { SkeletonCard } from "@/components/SkeletonCard";
import { toast } from "sonner";

/** Given 3 corners in order (A, B, C), estimate the 4th corner D
 *  to complete a parallelogram: D = A + C - B
 *  This works for the pattern: A→B→C→D where AB∥DC and AD∥BC */
function estimate4thCorner(
  pts: { x: number; y: number }[],
  missingIndex: number
): { x: number; y: number } {
  // For a quadrilateral ABCD (0,1,2,3):
  // Missing 0: D=B+D? => 0 = 1 + 3 - 2
  // Missing 1: 1 = 0 + 2 - 3
  // Missing 2: 2 = 1 + 3 - 0
  // Missing 3: 3 = 0 + 2 - 1
  // But we only have 3 points. Let's map them:
  const [a, b, c] = pts; // the 3 points user placed

  // Depending on which corner is missing, calculate differently
  // For simplicity: assume the 3 points are placed in order and the missing one completes the parallelogram
  switch (missingIndex) {
    case 0: // missing top-left: TL = TR + BL - BR
      return { x: a.x + c.x - b.x, y: a.y + c.y - b.y };
    case 1: // missing top-right: TR = TL + BR - BL
      return { x: a.x + b.x - c.x, y: a.y + b.y - c.y };
    case 2: // missing bottom-right: BR = TR + BL - TL
      return { x: b.x + c.x - a.x, y: b.y + c.y - a.y };
    case 3: // missing bottom-left: BL = TL + BR - TR
    default:
      return { x: a.x + b.x - c.x, y: a.y + b.y - c.y };
  }
}

export default function FieldCalibration() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: field, isLoading } = useField(id);
  const saveCalibration = useSaveCalibration();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [width, setWidth] = useState("105");
  const [height, setHeight] = useState("68");
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [missingCorner, setMissingCorner] = useState<number>(3); // which corner is estimated in 3-point mode
  const [use3PointMode, setUse3PointMode] = useState(false);

  // The estimated 4th point (only in 3-point mode with exactly 3 points)
  const estimated4th = use3PointMode && points.length === 3
    ? estimate4thCorner(points, missingCorner)
    : null;

  // All 4 points for display (real + estimated)
  const allPoints = estimated4th
    ? [...points.slice(0, missingCorner), estimated4th, ...points.slice(missingCorner)]
    : points;

  // Effective final points for saving
  const finalPoints = use3PointMode && points.length === 3 && estimated4th
    ? (() => {
        // Insert estimated point at the missing position
        const result = [...points];
        result.splice(missingCorner, 0, estimated4th);
        return result;
      })()
    : points;

  const maxPoints = use3PointMode ? 3 : 4;
  const canSave = finalPoints.length === 4;

  useEffect(() => {
    if (field) {
      setWidth(String(field.width_m));
      setHeight(String(field.height_m));
    }
  }, [field]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setPoints([]);
  };

  const getRelativePos = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }, []);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingIndex !== null) return;
    if (points.length >= maxPoints) return;
    const pos = getRelativePos(e.clientX, e.clientY);
    if (!pos) return;
    setPoints([...points, pos]);
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (draggingIndex !== null) return;
    if (points.length >= maxPoints) return;
    e.preventDefault();
    const touch = e.touches[0];
    const pos = getRelativePos(touch.clientX, touch.clientY);
    if (!pos) return;
    setPoints([...points, pos]);
    if (navigator.vibrate) navigator.vibrate(30);
  };

  // Drag handlers
  const startDrag = (index: number, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingIndex(index);
  };

  useEffect(() => {
    if (draggingIndex === null) return;

    const onMove = (clientX: number, clientY: number) => {
      const pos = getRelativePos(clientX, clientY);
      if (!pos) return;
      setPoints(prev => prev.map((p, i) => i === draggingIndex ? pos : p));
    };

    const handleMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleEnd = () => setDraggingIndex(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [draggingIndex, getRelativePos]);

  const undoLastPoint = () => {
    setPoints(prev => prev.slice(0, -1));
  };

  const handleSave = async () => {
    if (!id || !canSave) return;
    const calibration = {
      points: finalPoints,
      width_m: parseFloat(width) || 105,
      height_m: parseFloat(height) || 68,
      calibrated_at: new Date().toISOString(),
    };
    await saveCalibration.mutateAsync({ fieldId: id, calibration });
    navigate("/fields");
  };

  const cornerLabels = ["Links-Oben", "Rechts-Oben", "Rechts-Unten", "Links-Unten"];

  // In 3-point mode, the labels the user needs to click (excluding the missing one)
  const activeLabels = use3PointMode
    ? cornerLabels.filter((_, i) => i !== missingCorner)
    : cornerLabels;

  if (isLoading) return <AppLayout><div className="max-w-3xl mx-auto"><SkeletonCard count={2} /></div></AppLayout>;
  if (!field) return <AppLayout><div className="max-w-3xl mx-auto text-muted-foreground text-center py-20">Platz nicht gefunden</div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Link to="/fields" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Zurück zu Plätze
        </Link>

        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <Crosshair className="h-6 w-6 text-primary" /> Kalibrierung — {field.name}
        </h1>

        <div className="glass-card p-6 space-y-4">
          {/* Mode selection */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!use3PointMode ? "hero" : "heroOutline"}
              size="sm"
              onClick={() => { setUse3PointMode(false); setPoints([]); }}
            >
              4 Ecken (Standard)
            </Button>
            <Button
              variant={use3PointMode ? "hero" : "heroOutline"}
              size="sm"
              onClick={() => { setUse3PointMode(true); setPoints([]); }}
            >
              3 Ecken (fehlende Ecke berechnen)
            </Button>
          </div>

          {/* Missing corner selector in 3-point mode */}
          {use3PointMode && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
              <p className="text-sm text-foreground flex items-center gap-1.5">
                <Info className="h-4 w-4 text-primary shrink-0" />
                Welche Ecke ist im Bild nicht sichtbar?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {cornerLabels.map((label, i) => (
                  <Button
                    key={i}
                    size="sm"
                    variant={missingCorner === i ? "hero" : "outline"}
                    className="text-xs h-7 px-2"
                    onClick={() => { setMissingCorner(i); setPoints([]); }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground">
              {use3PointMode
                ? "Lade ein Foto hoch und klicke die 3 sichtbaren Ecken an. Die fehlende Ecke wird automatisch berechnet."
                : "Lade ein Foto vom Spielfeld hoch und klicke die 4 Ecken des Spielfelds an."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Reihenfolge: {activeLabels.map((l, i) => (
                <span key={l} className={i < points.length ? "text-primary font-medium" : ""}>
                  {i > 0 ? " → " : ""}{l}
                </span>
              ))}
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Move className="h-3 w-3" /> Punkte können per Drag verschoben werden
            </p>
          </div>

          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
            <Button variant="heroOutline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Foto hochladen
            </Button>
            <Button variant="heroOutline" size="sm" onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.setAttribute("capture", "environment");
                fileInputRef.current.click();
              }
            }}>
              <Camera className="h-4 w-4 mr-1" /> Kamera
            </Button>
          </div>

          {/* Calibration area */}
          <div
            ref={containerRef}
            className="aspect-video bg-muted/30 rounded-lg border-2 border-dashed border-border relative cursor-crosshair overflow-hidden touch-none select-none"
            onClick={handleImageClick}
            onTouchStart={handleTouchStart}
          >
            {imageUrl && (
              <img src={imageUrl} alt="Spielfeld" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {!imageUrl && (
                <span className="text-muted-foreground/50 text-sm text-center px-4">
                  {use3PointMode
                    ? "Lade ein Bild hoch und klicke die 3 sichtbaren Ecken an"
                    : `Lade ein Bild hoch und klicke Ecke ${points.length + 1} von 4`}
                </span>
              )}
              {imageUrl && points.length < maxPoints && (
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-card/80 backdrop-blur-sm rounded-full text-xs text-foreground border border-border">
                  Klicke: {activeLabels[points.length]} (Ecke {points.length + 1}/{maxPoints})
                </span>
              )}
            </div>

            {/* Lines between all display points */}
            {allPoints.length >= 2 && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {allPoints.map((p, i) => {
                  if (i === 0) return null;
                  const prev = allPoints[i - 1];
                  return <line key={i} x1={`${prev.x}%`} y1={`${prev.y}%`} x2={`${p.x}%`} y2={`${p.y}%`} stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="6" opacity={0.8} />;
                })}
                {allPoints.length === 4 && (
                  <line x1={`${allPoints[3].x}%`} y1={`${allPoints[3].y}%`} x2={`${allPoints[0].x}%`} y2={`${allPoints[0].y}%`} stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="6" opacity={0.8} />
                )}
              </svg>
            )}

            {/* Real points (draggable) */}
            {points.map((p, i) => (
              <div
                key={`real-${i}`}
                className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary border-2 border-primary-foreground flex items-center justify-center text-[10px] font-bold text-primary-foreground shadow-lg cursor-grab active:cursor-grabbing z-10"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onMouseDown={(e) => startDrag(i, e)}
                onTouchStart={(e) => startDrag(i, e)}
              >
                {use3PointMode ? activeLabels[i]?.[0] : i + 1}
              </div>
            ))}

            {/* Estimated 4th point */}
            {estimated4th && (
              <div
                className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent border-2 border-dashed border-accent-foreground flex items-center justify-center text-[10px] font-bold text-accent-foreground shadow-lg z-10 animate-pulse"
                style={{ left: `${estimated4th.x}%`, top: `${estimated4th.y}%` }}
                title={`Geschätzt: ${cornerLabels[missingCorner]}`}
              >
                ?
              </div>
            )}
          </div>

          {/* Calibration status */}
          {canSave && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 flex items-center gap-2">
              <Crosshair className="h-4 w-4" />
              {use3PointMode
                ? `Kalibrierung bereit — 3 Ecken gesetzt, ${cornerLabels[missingCorner]} wurde berechnet.`
                : "Kalibrierung sieht plausibel aus — alle 4 Ecken gesetzt."}
            </div>
          )}

          {/* Field dimensions */}
          <div className="flex gap-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Breite (m)</label>
              <input type="number" value={width} onChange={(e) => setWidth(e.target.value)} className="w-24 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Länge (m)</label>
              <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="w-24 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {points.length > 0 && (
              <Button variant="ghost" size="sm" onClick={undoLastPoint} className="flex items-center gap-1">
                <Undo2 className="h-4 w-4" /> Letzte Ecke entfernen
              </Button>
            )}
            <Button variant="ghost" onClick={() => setPoints([])} className="flex items-center gap-1">
              <RotateCcw className="h-4 w-4" /> Zurücksetzen
            </Button>
            <Button variant="hero" disabled={!canSave || saveCalibration.isPending} onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" /> Kalibrierung speichern
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
