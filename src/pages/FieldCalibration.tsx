import AppLayout from "@/components/AppLayout";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Crosshair, Save, ArrowLeft, RotateCcw } from "lucide-react";
import { useField, useSaveCalibration } from "@/hooks/use-fields";
import { SkeletonCard } from "@/components/SkeletonCard";
import { toast } from "sonner";

export default function FieldCalibration() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: field, isLoading } = useField(id);
  const saveCalibration = useSaveCalibration();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [width, setWidth] = useState("105");
  const [height, setHeight] = useState("68");

  // Load existing calibration
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

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (points.length >= 4) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setPoints([...points, { x, y }]);
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const handleSave = async () => {
    if (!id || points.length < 4) return;
    const calibration = {
      points,
      width_m: parseFloat(width) || 105,
      height_m: parseFloat(height) || 68,
      calibrated_at: new Date().toISOString(),
    };
    await saveCalibration.mutateAsync({ fieldId: id, calibration });
    navigate("/fields");
  };

  const cornerLabels = ["Links-Oben", "Rechts-Oben", "Rechts-Unten", "Links-Unten"];

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
          <div>
            <p className="text-sm text-muted-foreground">
              Lade ein Foto vom Spielfeld hoch und klicke die 4 Ecken des Spielfelds an.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Reihenfolge: {cornerLabels.map((l, i) => (
                <span key={l} className={i < points.length ? "text-primary font-medium" : ""}>
                  {i > 0 ? " → " : ""}{l}
                </span>
              ))}
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
            className="aspect-video bg-muted/30 rounded-lg border-2 border-dashed border-border relative cursor-crosshair overflow-hidden"
            onClick={handleImageClick}
          >
            {imageUrl && (
              <img src={imageUrl} alt="Spielfeld" className="absolute inset-0 w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              {!imageUrl && (
                <span className="text-muted-foreground/50 text-sm">
                  {points.length < 4 ? `Lade ein Bild hoch und klicke Ecke ${points.length + 1} von 4` : "Kalibrierung abgeschlossen"}
                </span>
              )}
              {imageUrl && points.length < 4 && (
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-card/80 backdrop-blur-sm rounded-full text-xs text-foreground border border-border">
                  Klicke: {cornerLabels[points.length]} (Ecke {points.length + 1}/4)
                </span>
              )}
            </div>
            {/* Points */}
            {points.map((p, i) => (
              <div
                key={i}
                className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive border-2 border-destructive-foreground flex items-center justify-center text-[10px] font-bold text-destructive-foreground shadow-lg"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                {i + 1}
              </div>
            ))}
            {/* Lines */}
            {points.length >= 2 && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {points.map((p, i) => {
                  if (i === 0) return null;
                  const prev = points[i - 1];
                  return <line key={i} x1={`${prev.x}%`} y1={`${prev.y}%`} x2={`${p.x}%`} y2={`${p.y}%`} stroke="hsl(190 100% 50%)" strokeWidth="2" strokeDasharray="6" />;
                })}
                {points.length === 4 && (
                  <line x1={`${points[3].x}%`} y1={`${points[3].y}%`} x2={`${points[0].x}%`} y2={`${points[0].y}%`} stroke="hsl(190 100% 50%)" strokeWidth="2" strokeDasharray="6" />
                )}
              </svg>
            )}
          </div>

          {/* Calibration status */}
          {points.length === 4 && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 flex items-center gap-2">
              <Crosshair className="h-4 w-4" /> Kalibrierung sieht plausibel aus — alle 4 Ecken gesetzt.
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

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPoints([])} className="flex items-center gap-1">
              <RotateCcw className="h-4 w-4" /> Zurücksetzen
            </Button>
            <Button variant="hero" disabled={points.length < 4 || saveCalibration.isPending} onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" /> Kalibrierung speichern
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
