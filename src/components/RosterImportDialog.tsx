import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import { POSITIONS, POSITION_LABELS } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/lib/i18n";

type ParsedPlayer = { name: string; number: number | null; position: string | null };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNumbers: number[];
  onImport: (players: ParsedPlayer[]) => Promise<void>;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function compressImage(dataUrl: string, maxWidth = 1600, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
    img.src = dataUrl;
  });
}

function findInternalDuplicateNumbers(players: ParsedPlayer[]): number[] {
  const seen = new Map<number, number>();
  const dupes: number[] = [];
  for (const p of players) {
    if (p.number === null) continue;
    seen.set(p.number, (seen.get(p.number) ?? 0) + 1);
  }
  for (const [num, count] of seen) {
    if (count > 1) dupes.push(num);
  }
  return dupes;
}

export function RosterImportDialog({ open, onOpenChange, existingNumbers, onImport }: Props) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [preview, setPreview] = useState<string | null>(null);
  const [players, setPlayers] = useState<ParsedPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const reset = () => {
    setStep(1);
    setPreview(null);
    setPlayers([]);
    setError(null);
    setImporting(false);
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Bitte ein Bild auswählen (JPG, PNG, etc.)");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Datei zu groß (max. 20 MB). Bitte ein kleineres Bild verwenden.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!preview) return;
    setStep(2);
    setError(null);
    try {
      const compressed = await compressImage(preview);
      const base64 = compressed.split(",")[1];
      const { data, error: fnError } = await supabase.functions.invoke("parse-roster", {
        body: { image_base64: base64 },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      const parsed = data.players ?? [];
      if (parsed.length === 0) {
        setError("Keine Spieler erkannt — ist das Bild gut lesbar und zeigt eine Kaderliste?");
        setStep(1);
        return;
      }
      setPlayers(parsed);
      setStep(3);
    } catch (e: any) {
      setError(e.message || "Analyse fehlgeschlagen");
      setStep(1);
    }
  };

  const updatePlayer = (idx: number, field: keyof ParsedPlayer, value: any) => {
    setPlayers(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const removePlayer = (idx: number) => setPlayers(prev => prev.filter((_, i) => i !== idx));

  const addEmpty = () => setPlayers(prev => [...prev, { name: "", number: null, position: null }]);

  const handleImport = async () => {
    const valid = players.filter(p => p.name.trim());
    if (!valid.length) return;
    setImporting(true);
    try {
      await onImport(valid);
      onOpenChange(false);
      reset();
    } catch {
      setError("Import fehlgeschlagen");
    } finally {
      setImporting(false);
    }
  };

  const duplicateNumbers = players
    .map(p => p.number)
    .filter((n): n is number => n !== null && existingNumbers.includes(n));

  const internalDupes = findInternalDuplicateNumbers(players);

  const analyzing = step === 2;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (analyzing) return; if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={analyzing ? (e) => e.preventDefault() : undefined} onEscapeKeyDown={analyzing ? (e) => e.preventDefault() : undefined}>
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Spielerbogen importieren
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex items-center gap-1.5 ${step >= s ? "text-primary font-medium" : ""}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${step >= s ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{s}</span>
              {s === 1 ? "Foto" : s === 2 ? "Analyse" : "Korrektur"}
            </div>
          ))}
        </div>

        {/* Step 1: Photo */}
        {step === 1 && (
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            {preview ? (
              <div className="space-y-3">
                <img src={preview} alt="Vorschau" className="w-full max-h-64 object-contain rounded-lg border border-border" />
                <div className="flex gap-2">
                  <Button variant="heroOutline" size="sm" onClick={() => { setPreview(null); setError(null); }}>
                    Anderes Foto
                  </Button>
                  <Button variant="hero" size="sm" onClick={analyze} className="flex-1">
                    Spieler erkennen
                  </Button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Camera className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Spielerbogen fotografieren</p>
                  <p className="text-sm text-muted-foreground mt-1">Kaderliste, Aufstellungsbogen oder Mannschaftsliste</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
            )}
          </div>
        )}

        {/* Step 2: Analyzing */}
        {step === 2 && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-center">
              <p className="font-medium">Spielerbogen wird analysiert…</p>
              <p className="text-sm text-muted-foreground mt-1">KI erkennt Namen, Nummern und Positionen</p>
            </div>
          </div>
        )}

        {/* Step 3: Correction */}
        {step === 3 && (
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            {duplicateNumbers.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Trikotnummern bereits vergeben: {[...new Set(duplicateNumbers)].join(", ")}
              </div>
            )}

            {internalDupes.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Doppelte Nummern im Import: {internalDupes.join(", ")}
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              {players.length} Spieler erkannt — bitte überprüfen und korrigieren:
            </div>

            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {players.map((p, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_70px_120px_36px] gap-2 items-center">
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => updatePlayer(idx, "name", e.target.value)}
                    placeholder="Name"
                    className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground"
                  />
                  <input
                    type="number"
                    value={p.number ?? ""}
                    onChange={e => updatePlayer(idx, "number", e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="#"
                    className={`px-3 py-2 rounded-lg bg-muted border text-foreground text-sm placeholder:text-muted-foreground ${
                      p.number !== null && (existingNumbers.includes(p.number) || internalDupes.includes(p.number)) ? "border-warning" : "border-border"
                    }`}
                  />
                  <select
                    value={p.position ?? ""}
                    onChange={e => updatePlayer(idx, "position", e.target.value || null)}
                    className="px-2 py-2 rounded-lg bg-muted border border-border text-foreground text-sm"
                  >
                    <option value="">—</option>
                    {POSITIONS.map(pos => (
                      <option key={pos} value={pos}>{pos} — {POSITION_LABELS[pos]}</option>
                    ))}
                  </select>
                  <button onClick={() => removePlayer(idx)} className="p-2 rounded hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-4 w-4 text-destructive/70" />
                  </button>
                </div>
              ))}
            </div>

            <button onClick={addEmpty} className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors">
              <Plus className="h-4 w-4" /> Spieler hinzufügen
            </button>

            <div className="flex gap-2 pt-2">
              <Button variant="heroOutline" size="sm" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-1" /> Neues Foto
              </Button>
              <Button
                variant="hero"
                size="sm"
                className="flex-1"
                onClick={handleImport}
                disabled={importing || !players.some(p => p.name.trim())}
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                {players.filter(p => p.name.trim()).length} Spieler importieren
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
