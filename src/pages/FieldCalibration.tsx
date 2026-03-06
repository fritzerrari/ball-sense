import AppLayout from "@/components/AppLayout";
import { useParams } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Crosshair, Save } from "lucide-react";

export default function FieldCalibration() {
  const { id } = useParams();
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [width, setWidth] = useState("105");
  const [height, setHeight] = useState("68");

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (points.length >= 4) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPoints([...points, { x, y }]);
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <Crosshair className="h-6 w-6 text-primary" /> Kalibrierung
        </h1>

        <div className="glass-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Mache ein Foto vom Spielfeld oder nutze die Live-Kamera. Klicke dann die 4 Ecken des Spielfelds an.
          </p>
          <p className="text-xs text-muted-foreground">
            Reihenfolge: Links-Oben → Rechts-Oben → Rechts-Unten → Links-Unten
          </p>

          <div className="flex gap-2">
            <Button variant="heroOutline" size="sm"><Upload className="h-4 w-4 mr-1" /> Foto hochladen</Button>
            <Button variant="heroOutline" size="sm"><Camera className="h-4 w-4 mr-1" /> Live-Kamera</Button>
          </div>

          {/* Calibration area */}
          <div
            className="aspect-video bg-muted/50 rounded-lg border-2 border-dashed border-border relative cursor-crosshair overflow-hidden"
            onClick={handleImageClick}
          >
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30 text-sm">
              {points.length < 4 ? `Klicke Ecke ${points.length + 1} von 4` : "Kalibrierung abgeschlossen"}
            </div>
            {/* Points */}
            {points.map((p, i) => (
              <div
                key={i}
                className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive border-2 border-destructive-foreground flex items-center justify-center text-[10px] font-bold text-destructive-foreground"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                {i + 1}
              </div>
            ))}
            {/* Lines between points */}
            {points.length >= 2 && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {points.map((p, i) => {
                  if (i === 0) return null;
                  const prev = points[i - 1];
                  return (
                    <line
                      key={i}
                      x1={`${prev.x}%`} y1={`${prev.y}%`}
                      x2={`${p.x}%`} y2={`${p.y}%`}
                      stroke="hsl(190 100% 50%)" strokeWidth="2" strokeDasharray="4"
                    />
                  );
                })}
                {points.length === 4 && (
                  <line
                    x1={`${points[3].x}%`} y1={`${points[3].y}%`}
                    x2={`${points[0].x}%`} y2={`${points[0].y}%`}
                    stroke="hsl(190 100% 50%)" strokeWidth="2" strokeDasharray="4"
                  />
                )}
              </svg>
            )}
          </div>

          {points.length === 4 && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary">
              ✓ Kalibrierung sieht gut aus
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

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPoints([])}>Zurücksetzen</Button>
            <Button variant="hero" disabled={points.length < 4}>
              <Save className="h-4 w-4 mr-1" /> Kalibrierung speichern
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
