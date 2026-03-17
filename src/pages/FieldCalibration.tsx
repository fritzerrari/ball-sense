import AppLayout from "@/components/AppLayout";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Crosshair, Save, ArrowLeft, RotateCcw, Move, Undo2 } from "lucide-react";
import { useField, useSaveCalibration } from "@/hooks/use-fields";
import { SkeletonCard } from "@/components/SkeletonCard";

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

  const cornerLabels = ["Links-Oben", "Rechts-Oben", "Rechts-Unten", "Links-Unten"];
  const canSave = points.length === 4;

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

  const addPoint = useCallback((x: number, y: number) => {
    setPoints((prev) => {
      if (prev.length >= 4) return prev;
      return [...prev, { x, y }];
    });
    if (navigator.vibrate) navigator.vibrate(30);
  }, []);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingIndex !== null) return;
    const pos = getRelativePos(e.clientX, e.clientY);
    if (!pos) return;
    addPoint(pos.x, pos.y);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (draggingIndex !== null) return;
    e.preventDefault();
    const touch = e.touches[0];
    const pos = getRelativePos(touch.clientX, touch.clientY);
    if (!pos) return;
    addPoint(pos.x, pos.y);
  };

  const startDrag = (index: number, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingIndex(index);
  };

  useEffect(() => {
    if (draggingIndex === null) return;

    const movePoint = (clientX: number, clientY: number) => {
      const pos = getRelativePos(clientX, clientY);
      if (!pos) return;
      setPoints((prev) => prev.map((p, i) => (i === draggingIndex ? pos : p)));
    };

    const handleMouseMove = (e: MouseEvent) => movePoint(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      movePoint(e.touches[0].clientX, e.touches[0].clientY);
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
    setPoints((prev) => prev.slice(0, -1));
  };

  const handleSave = async () => {
    if (!id || points.length !== 4) return;

    const calibration = {
      points,
      width_m: parseFloat(width) || 105,
      height_m: parseFloat(height) || 68,
      calibrated_at: new Date().toISOString(),
    };

    await saveCalibration.mutateAsync({ fieldId: id, calibration });
    navigate("/fields");
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto">
          <SkeletonCard count={2} />
        </div>
      </AppLayout>
    );
  }

  if (!field) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto text-muted-foreground text-center py-20">Platz nicht gefunden</div>
      </AppLayout>
    );
  }

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
          <div>
            <p className="text-sm text-muted-foreground">
              Lade ein Foto hoch und setze exakt 4 Ecken des Spielfelds.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Reihenfolge: {cornerLabels.map((label, i) => (
                <span key={label} className={i < points.length ? "text-primary font-medium" : ""}>
                  {i > 0 ? " → " : ""}
                  {label}
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
            <Button
              variant="heroOutline"
              size="sm"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute("capture", "environment");
                  fileInputRef.current.click();
                }
              }}
            >
              <Camera className="h-4 w-4 mr-1" /> Kamera
            </Button>
          </div>

          <div
            ref={containerRef}
            className="aspect-video bg-muted/30 rounded-lg border-2 border-dashed border-border relative cursor-crosshair overflow-hidden touch-none select-none"
            onClick={handleImageClick}
            onTouchStart={handleTouchStart}
          >
            {imageUrl && <img src={imageUrl} alt="Spielfeld" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />}

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {!imageUrl && (
                <span className="text-muted-foreground/50 text-sm text-center px-4">
                  Lade ein Bild hoch und klicke Ecke {Math.min(points.length + 1, 4)} von 4
                </span>
              )}
              {imageUrl && points.length < 4 && (
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-card/80 backdrop-blur-sm rounded-full text-xs text-foreground border border-border">
                  Klicke: {cornerLabels[points.length]} (Ecke {points.length + 1}/4)
                </span>
              )}
            </div>

            {points.length >= 2 && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {points.map((p, i) => {
                  if (i === 0) return null;
                  const prev = points[i - 1];
                  return (
                    <line
                      key={i}
                      x1={`${prev.x}%`}
                      y1={`${prev.y}%`}
                      x2={`${p.x}%`}
                      y2={`${p.y}%`}
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      strokeDasharray="6"
                      opacity={0.8}
                    />
                  );
                })}
                {points.length === 4 && (
                  <line
                    x1={`${points[3].x}%`}
                    y1={`${points[3].y}%`}
                    x2={`${points[0].x}%`}
                    y2={`${points[0].y}%`}
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    strokeDasharray="6"
                    opacity={0.8}
                  />
                )}
              </svg>
            )}

            {points.map((p, i) => (
              <div
                key={`corner-${i}`}
                className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary border-2 border-primary-foreground flex items-center justify-center text-[10px] font-bold text-primary-foreground shadow-lg cursor-grab active:cursor-grabbing z-10"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onMouseDown={(e) => startDrag(i, e)}
                onTouchStart={(e) => startDrag(i, e)}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {canSave && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary flex items-center gap-2">
              <Crosshair className="h-4 w-4" /> Kalibrierung bereit — alle 4 Ecken gesetzt.
            </div>
          )}

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
