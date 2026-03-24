import AppLayout from "@/components/AppLayout";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Camera,
  Upload,
  Crosshair,
  Save,
  ArrowLeft,
  RotateCcw,
  Move,
  Undo2,
  Sparkles,
  Loader2,
  Ruler,
  Goal,
  CircleDot,
  CornerDownRight,
  LineChart,
} from "lucide-react";
import { useField, useSaveCalibration } from "@/hooks/use-fields";
import { SkeletonCard } from "@/components/SkeletonCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { FieldCoverage, FieldRect } from "@/lib/types";

type CornerPoint = { x: number; y: number };
type DetectionConfidence = "high" | "medium" | "low" | null;

const COVERAGE_OPTIONS: { value: FieldCoverage; label: string; desc: string; rect: FieldRect }[] = [
  { value: "full", label: "Ganzes Feld", desc: "Alle 4 Ecken sichtbar", rect: { x: 0, y: 0, w: 1, h: 1 } },
  { value: "left_half", label: "Linke Hälfte", desc: "Bis zur Mittellinie", rect: { x: 0, y: 0, w: 0.5, h: 1 } },
  { value: "right_half", label: "Rechte Hälfte", desc: "Ab der Mittellinie", rect: { x: 0.5, y: 0, w: 0.5, h: 1 } },
  { value: "custom", label: "Eigener Bereich", desc: "Freier Ausschnitt", rect: { x: 0, y: 0, w: 1, h: 1 } },
];

type LayoutSuggestion = {
  fieldType: string | null;
  confidence: DetectionConfidence;
  detectedFeatures: string[];
  suggestedDimensions: { width: number; height: number } | null;
};

const FIELD_PRESETS = [
  { label: "Großfeld 105×68m", width: "105", height: "68" },
  { label: "Kleinfeld 68×50m", width: "68", height: "50" },
  { label: "Jugend 80×55m", width: "80", height: "55" },
  { label: "Futsal 40×20m", width: "40", height: "20" },
];

const EMPTY_LAYOUT_SUGGESTION: LayoutSuggestion = {
  fieldType: null,
  confidence: null,
  detectedFeatures: [],
  suggestedDimensions: null,
};

const confidenceCopy: Record<Exclude<DetectionConfidence, null>, { label: string; className: string }> = {
  high: {
    label: "Hohe Sicherheit",
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  medium: {
    label: "Mittlere Sicherheit",
    className: "border-accent/30 bg-accent/10 text-accent-foreground",
  },
  low: {
    label: "Niedrige Sicherheit",
    className: "border-muted-foreground/20 bg-muted text-muted-foreground",
  },
};

const featureLabels: Record<string, { label: string; icon: typeof Goal }> = {
  goal: { label: "Tor", icon: Goal },
  penalty_area: { label: "Strafraum", icon: Ruler },
  goal_area: { label: "Torraum", icon: CornerDownRight },
  center_circle: { label: "Mittelkreis", icon: CircleDot },
  halfway_line: { label: "Mittellinie", icon: LineChart },
  corner_flag: { label: "Eckfahne", icon: Crosshair },
  touchline: { label: "Seitenlinie", icon: Move },
  goal_line: { label: "Grundlinie", icon: Move },
};

export default function FieldCalibration() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: field, isLoading } = useField(id);
  const saveCalibration = useSaveCalibration();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [points, setPoints] = useState<CornerPoint[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [width, setWidth] = useState("105");
  const [height, setHeight] = useState("68");
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [layoutSuggestion, setLayoutSuggestion] = useState<LayoutSuggestion>(EMPTY_LAYOUT_SUGGESTION);
  const [coverage, setCoverage] = useState<FieldCoverage>("full");
  const [fieldRect, setFieldRect] = useState<FieldRect>({ x: 0, y: 0, w: 1, h: 1 });
  const cornerLabels = ["Links-Oben", "Rechts-Oben", "Rechts-Unten", "Links-Unten"];
  const canSave = points.length === 4;
  const returnTo = searchParams.get("returnTo");
  const fromSnapshot = searchParams.get("fromSnapshot") === "1";
  const backHref = returnTo || "/fields";
  const backLabel = returnTo ? "Zurück zum Tracking" : "Zurück zu Plätze";
  const saveLabel = returnTo ? "Speichern & weiter" : "Kalibrierung speichern";

  useEffect(() => {
    if (field) {
      setWidth(String(field.width_m));
      setHeight(String(field.height_m));
    }
  }, [field]);

  // Auto-load snapshot from live camera if available
  useEffect(() => {
    if (fromSnapshot) {
      const snapshot = sessionStorage.getItem("calibration_snapshot");
      if (snapshot) {
        sessionStorage.removeItem("calibration_snapshot");
        setImageUrl(snapshot);
        // Create a File object for auto-detect compatibility
        fetch(snapshot)
          .then((res) => res.blob())
          .then((blob) => setImageFile(new File([blob], "live-snapshot.jpg", { type: "image/jpeg" })));
        toast.success("Live-Kamerabild geladen – setze jetzt die 4 Eckpunkte.");
      }
    }
  }, [fromSnapshot]);

  const resetLayoutSuggestion = useCallback(() => {
    setLayoutSuggestion(EMPTY_LAYOUT_SUGGESTION);
  }, []);

  const applySuggestedDimensions = useCallback((suggestedDimensions: LayoutSuggestion["suggestedDimensions"]) => {
    if (!suggestedDimensions) return;
    setWidth(String(suggestedDimensions.width));
    setHeight(String(suggestedDimensions.height));
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setImageFile(file);
    setPoints([]);
    resetLayoutSuggestion();
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

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingIndex !== null) return;
    if ((e.target as HTMLElement).closest("[data-drag-handle]")) return;
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

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

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

      const nextSuggestion: LayoutSuggestion = {
        fieldType: data?.fieldType ?? null,
        confidence: data?.confidence ?? null,
        detectedFeatures: Array.isArray(data?.detectedFeatures) ? data.detectedFeatures : [],
        suggestedDimensions: data?.suggestedDimensions
          ? {
              width: Number(data.suggestedDimensions.width),
              height: Number(data.suggestedDimensions.height),
            }
          : null,
      };

      setLayoutSuggestion(nextSuggestion);

      if (data?.corners && data.corners.length === 4) {
        setPoints(data.corners);
        toast.success("4 Ecken automatisch erkannt! Passe sie bei Bedarf per Drag an.");
      } else {
        toast.error("Ecken konnten nicht erkannt werden. Bitte manuell setzen.");
      }

      if (nextSuggestion.suggestedDimensions) {
        applySuggestedDimensions(nextSuggestion.suggestedDimensions);
        toast.success(`Feldtyp erkannt: ${nextSuggestion.fieldType ?? "Standardfeld"}`);
      }
    } catch (err) {
      console.error("Auto-detect error:", err);
      toast.error("Automatische Erkennung fehlgeschlagen. Bitte manuell setzen.");
      resetLayoutSuggestion();
    } finally {
      setDetecting(false);
    }
  };

  const handlePresetChange = (value: string) => {
    const preset = FIELD_PRESETS.find((p) => p.label === value);
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
    navigate(backHref);
  };

  const confidenceMeta = layoutSuggestion.confidence ? confidenceCopy[layoutSuggestion.confidence] : null;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl">
          <SkeletonCard count={2} />
        </div>
      </AppLayout>
    );
  }

  if (!field) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl py-20 text-center text-muted-foreground">Platz nicht gefunden</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Link>

        <h1 className="font-display flex items-center gap-2 text-2xl font-bold">
          <Crosshair className="h-6 w-6 text-primary" /> Kalibrierung — {field.name}
        </h1>

        <div className="glass-card space-y-4 p-6">
          <div>
            <p className="text-sm text-muted-foreground">Lade ein Foto hoch und setze exakt 4 Ecken des Spielfelds.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Reihenfolge: {cornerLabels.map((label, i) => (
                <span key={label} className={i < points.length ? "font-medium text-primary" : ""}>
                  {i > 0 ? " → " : ""}
                  {label}
                </span>
              ))}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Move className="h-3 w-3" /> Punkte können per Drag verschoben werden
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
            <Button variant="heroOutline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" /> Foto hochladen
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
              <Camera className="mr-1 h-4 w-4" /> Kamera
            </Button>
            {imageFile && (
              <Button variant="hero" size="sm" onClick={handleAutoDetect} disabled={detecting}>
                {detecting ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Erkennung läuft...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1 h-4 w-4" /> Feld erkennen
                  </>
                )}
              </Button>
            )}
          </div>

          {layoutSuggestion.suggestedDimensions && (
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  <Ruler className="h-4 w-4 text-primary" />
                  Automatisch erkannt: {layoutSuggestion.fieldType ?? "Standardfeld"}
                </div>
                {confidenceMeta && (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${confidenceMeta.className}`}>
                    {confidenceMeta.label}
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-background/70 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Vorgeschlagene Maße</div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {layoutSuggestion.suggestedDimensions.width} × {layoutSuggestion.suggestedDimensions.height} m
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-background/70 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Erkannte Merkmale</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {layoutSuggestion.detectedFeatures.length > 0 ? (
                      layoutSuggestion.detectedFeatures.map((feature) => {
                        const meta = featureLabels[feature];
                        const Icon = meta?.icon ?? Crosshair;
                        return (
                          <span key={feature} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground">
                            <Icon className="h-3 w-3 text-primary" />
                            {meta?.label ?? feature}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-muted-foreground">Keine sicheren Referenzmerkmale erkannt</span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Die Maße wurden als Vorschlag eingetragen — bitte vor dem Speichern kurz prüfen.
              </p>
            </div>
          )}

          <div
            ref={containerRef}
            className="relative aspect-video cursor-crosshair overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/30 select-none"
            style={{ touchAction: "none" }}
            onPointerDown={handlePointerDown}
          >
            {imageUrl && <img src={imageUrl} alt="Spielfeld" className="pointer-events-none absolute inset-0 h-full w-full object-cover" draggable={false} />}

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {!imageUrl && (
                <span className="px-4 text-center text-sm text-muted-foreground/50">
                  Lade ein Bild hoch und klicke Ecke {Math.min(points.length + 1, 4)} von 4
                </span>
              )}
              {imageUrl && points.length < 4 && (
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-foreground backdrop-blur-sm">
                  Klicke: {cornerLabels[points.length]} (Ecke {points.length + 1}/4)
                </span>
              )}
            </div>

            {points.length >= 2 && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
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
                className="absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 border-primary-foreground bg-primary text-xs font-bold text-primary-foreground shadow-lg active:cursor-grabbing"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onPointerDown={(e) => startDrag(i, e)}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {canSave && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
              <Crosshair className="h-4 w-4" /> Kalibrierung bereit — alle 4 Ecken gesetzt.
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Spielfeld-Vorlage</label>
              <Select onValueChange={handlePresetChange}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Vorlage wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_PRESETS.map((p) => (
                    <SelectItem key={p.label} value={p.label}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-4">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Breite (m)</label>
                <Input type="number" value={width} onChange={(e) => setWidth(e.target.value)} className="w-24" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Länge (m)</label>
                <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="w-24" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {points.length > 0 && (
              <Button variant="ghost" size="sm" onClick={undoLastPoint} className="flex items-center gap-1">
                <Undo2 className="h-4 w-4" /> Letzte Ecke entfernen
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setPoints([]);
                resetLayoutSuggestion();
              }}
              className="flex items-center gap-1"
            >
              <RotateCcw className="h-4 w-4" /> Zurücksetzen
            </Button>
            {returnTo && (
              <Button variant="heroOutline" asChild>
                <Link to={backHref}>Später zurück</Link>
              </Button>
            )}
            <Button variant="hero" disabled={!canSave || saveCalibration.isPending} onClick={handleSave}>
              <Save className="mr-1 h-4 w-4" /> {saveLabel}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
