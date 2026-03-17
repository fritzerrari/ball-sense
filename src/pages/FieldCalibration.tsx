import AppLayout from "@/components/AppLayout";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Crosshair, Save, ArrowLeft, RotateCcw, Move, Undo2, Sparkles, Loader2 } from "lucide-react";
import { useField, useSaveCalibration } from "@/hooks/use-fields";
import { SkeletonCard } from "@/components/SkeletonCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FIELD_PRESETS = [
  { label: "Großfeld 105×68m", width: "105", height: "68" },
  { label: "Kleinfeld 68×50m", width: "68", height: "50" },
  { label: "Jugend 80×55m", width: "80", height: "55" },
  { label: "Futsal 40×20m", width: "40", height: "20" },
];

export default function FieldCalibration() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: field, isLoading } = useField(id);
  const saveCalibration = useSaveCalibration();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [width, setWidth] = useState("105");
  const [height, setHeight] = useState("68");
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [detecting, setDetecting] = useState(false);

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
    setImageFile(file);
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

  // Unified pointer events (works on iOS, Android, Desktop)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingIndex !== null) return;
    // Only respond to primary pointer (not from drag handles)
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) return;
    const pos = getRelativePos(e.clientX, e.clientY);
    if (!pos) return;
    addPoint(pos.x, pos.y);
  };

  const startDrag = (index: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingIndex(index);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    if (draggingIndex === null) return;

    const movePoint = (clientX: number, clientY: number) => {
      const pos = getRelativePos(clientX, clientY);
      if (!pos) return;
      setPoints((prev) => prev.map((p, i) => (i === draggingIndex ? pos : p)));
    };

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      movePoint(e.clientX, e.clientY);
    };
    const handlePointerUp = () => setDraggingIndex(null);

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [draggingIndex, getRelativePos]);

  const undoLastPoint = () => {
    setPoints((prev) => prev.slice(0, -1));
  };

  const handleAutoDetect = async () => {
    if (!imageFile) {
      toast.error("Bitte lade zuerst ein Bild hoch");
      return;
    }
    setDetecting(true);
    try {
      // Convert image to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const { data, error } = await supabase.functions.invoke("detect-field-corners", {
        body: { image: base64, mimeType: imageFile.type },
      });

      if (error) throw error;
      if (data?.corners && data.corners.length === 4) {
        setPoints(data.corners);
        toast.success("4 Ecken automatisch erkannt! Passe sie bei Bedarf per Drag an.");
      } else {
        toast.error("Ecken konnten nicht erkannt werden. Bitte manuell setzen.");
      }
    } catch (err) {
      console.error("Auto-detect error:", err);
      toast.error("Automatische Erkennung fehlgeschlagen. Bitte manuell setzen.");
    } finally {
      setDetecting(false);
    }
  };

  const handlePresetChange = (value: string) => {
    const preset = FIELD_PRESETS.find(p => p.label === value);
    if (preset) {
      setWidth(preset.width);
      setHeight(preset.height);
    }
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

          <div className="flex gap-2 flex-wrap">
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
            {imageFile && (
              <Button
                variant="hero"
                size="sm"
                onClick={handleAutoDetect}
                disabled={detecting}
              >
                {detecting ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Erkennung läuft...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1" /> Automatisch erkennen</>
                )}
              </Button>
            )}
          </div>

          {/* Calibration image area — NO touch-none to fix iOS */}
          <div
            ref={containerRef}
            className="aspect-video bg-muted/30 rounded-lg border-2 border-dashed border-border relative cursor-crosshair overflow-hidden select-none"
            style={{ touchAction: "none" }}
            onPointerDown={handlePointerDown}
          >
            {imageUrl && <img src={imageUrl} alt="Spielfeld" className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />}

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
                data-drag-handle
                className="absolute w-11 h-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary border-2 border-primary-foreground flex items-center justify-center text-xs font-bold text-primary-foreground shadow-lg cursor-grab active:cursor-grabbing z-10"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onPointerDown={(e) => startDrag(i, e)}
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

          {/* Field dimensions with presets */}
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Spielfeld-Vorlage</label>
              <Select onValueChange={handlePresetChange}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Vorlage wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_PRESETS.map(p => (
                    <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
