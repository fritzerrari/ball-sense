import { useParams, useSearchParams, Link } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Pause, Play, Users, RefreshCw, Flag, Timer, Loader2, Upload, AlertTriangle, Check, ArrowLeft, Wifi, WifiOff } from "lucide-react";
import { useMatch, useMatchLineups, useUpdateMatch } from "@/hooks/use-matches";
import { useField } from "@/hooks/use-fields";
import { FootballTracker } from "@/lib/football-tracker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Phase = "loading" | "camera" | "calibration" | "tracking" | "ended";

export default function TrackingPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const cam = parseInt(searchParams.get("cam") ?? "0");

  const { data: match } = useMatch(id);
  const { data: lineups } = useMatchLineups(id);
  const fieldId = match?.field_id;
  const { data: field } = useField(fieldId);
  const updateMatch = useUpdateMatch();

  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [detections, setDetections] = useState(0);
  const [quality, setQuality] = useState<"Gut" | "Mittel" | "Schlecht">("Gut");
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subMinute, setSubMinute] = useState("");
  const [subOut, setSubOut] = useState("");
  const [subIn, setSubIn] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDone, setUploadDone] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [half, setHalf] = useState(1);

  const trackerRef = useRef<FootballTracker | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);

  const homePlayers = (lineups ?? []).filter(l => l.team === "home");

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Timer
  useEffect(() => {
    if (phase === "tracking" && !paused) {
      timerRef.current = window.setInterval(() => setElapsedSec(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, paused]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleLoadModel = async () => {
    const tracker = new FootballTracker();
    trackerRef.current = tracker;
    try {
      await tracker.loadModel((pct) => setProgress(pct));
      setPhase("camera");
    } catch {
      toast.error("Modell konnte nicht geladen werden");
    }
  };

  const handleStartCamera = async () => {
    if (!trackerRef.current || !videoRef.current) return;
    try {
      await trackerRef.current.startCamera(videoRef.current, cam);
      setPhase("calibration");
    } catch {
      toast.error("Kamera nicht verfügbar");
      setPhase("calibration");
    }
  };

  const handleStartTracking = () => {
    if (!trackerRef.current) return;
    trackerRef.current.startTracking(null, id ?? "", (frame) => {
      setDetections(frame.detections.length);
      setQuality(frame.detections.length >= 15 ? "Gut" : frame.detections.length >= 8 ? "Mittel" : "Schlecht");
    });
    setPhase("tracking");
    if (id) updateMatch.mutate({ id, status: "live" });
  };

  const handlePause = () => {
    if (!trackerRef.current) return;
    if (paused) {
      trackerRef.current.resumeTracking();
      setPaused(false);
    } else {
      trackerRef.current.pauseTracking();
      setPaused(true);
    }
  };

  const handleHalf = () => {
    trackerRef.current?.pauseTracking();
    setPaused(true);
    setHalf(2);
    toast.success("Halbzeit! Drücke Weiter wenn es losgeht.");
  };

  const handleEnd = () => {
    trackerRef.current?.stopTracking();
    setPhase("ended");
  };

  const handleUpload = async () => {
    if (!trackerRef.current || !id) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      // Simulate progress stages
      setUploadProgress(10);
      const result = await trackerRef.current.uploadMatch(
        id, cam,
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      );
      setUploadProgress(60);

      // Create tracking_uploads entry
      await supabase.from("tracking_uploads").insert({
        match_id: id,
        camera_index: cam,
        file_path: result.filePath,
        status: "uploaded",
        frames_count: result.framesCount,
        duration_sec: result.durationSec,
      });
      setUploadProgress(90);

      // Update match status
      await updateMatch.mutateAsync({ id, status: "processing" });
      setUploadProgress(100);
      setUploadDone(true);
      toast.success("Tracking-Daten erfolgreich hochgeladen!");
    } catch (err) {
      toast.error("Upload fehlgeschlagen — Daten lokal gespeichert");
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleSub = () => {
    if (!subOut || !subIn) return;
    toast.success(`Wechsel: ${subOut} raus, ${subIn} rein (${subMinute}. Minute)`);
    setSubModalOpen(false);
    setSubOut("");
    setSubIn("");
    setSubMinute("");
  };

  useEffect(() => {
    if (phase === "loading") handleLoadModel();
  }, []);

  const isCalibrated = field?.calibration != null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="font-display font-bold text-sm">
          <span className="gradient-text">Field</span>IQ
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? <Wifi className="h-3.5 w-3.5 text-primary" /> : <WifiOff className="h-3.5 w-3.5 text-destructive" />}
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            Kamera {cam + 1}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        {/* Phase: Loading */}
        {phase === "loading" && (
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center animate-glow-pulse">
              <Camera className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display mb-2">KI wird geladen...</h2>
              <p className="text-sm text-muted-foreground">Einmalig ~20 MB. Danach offline verfügbar.</p>
            </div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {/* Phase: Camera */}
        {phase === "camera" && (
          <div className="w-full max-w-sm space-y-6 text-center">
            <Camera className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-xl font-bold font-display">Kamera starten</h2>
            <p className="text-sm text-muted-foreground">Bitte erlaube den Kamerazugriff.</p>
            <video ref={videoRef} className="w-full aspect-video rounded-xl bg-muted/30 border border-border" playsInline muted />
            <Button variant="hero" size="xl" onClick={handleStartCamera} className="w-full min-h-[56px]">
              Kamera aktivieren
            </Button>
          </div>
        )}

        {/* Phase: Calibration check */}
        {phase === "calibration" && (
          <div className="w-full max-w-sm space-y-6 text-center">
            {isCalibrated ? (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold font-display">Platz ist kalibriert</h2>
                <p className="text-sm text-muted-foreground">{field?.name} — {field?.width_m}×{field?.height_m}m</p>
                <div className="flex gap-3">
                  <Button variant="hero" size="xl" onClick={handleStartTracking} className="flex-1 min-h-[56px]">
                    Verwenden & Starten
                  </Button>
                  <Button variant="heroOutline" size="xl" asChild className="min-h-[56px]">
                    <Link to={`/fields/${fieldId}/calibrate`}>Neu kalibrieren</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-16 w-16 text-yellow-400 mx-auto" />
                <h2 className="text-xl font-bold font-display">Platz nicht kalibriert</h2>
                <p className="text-sm text-muted-foreground">Bitte kalibriere den Platz zuerst für genaue Tracking-Daten.</p>
                <div className="flex flex-col gap-3">
                  {fieldId && (
                    <Button variant="hero" size="xl" asChild className="min-h-[56px]">
                      <Link to={`/fields/${fieldId}/calibrate`}>Jetzt kalibrieren</Link>
                    </Button>
                  )}
                  <Button variant="heroOutline" size="xl" onClick={handleStartTracking} className="min-h-[56px]">
                    Trotzdem starten
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Phase: Tracking */}
        {phase === "tracking" && (
          <div className="w-full max-w-lg space-y-4 sm:space-y-6">
            {/* Timer */}
            <div className="text-center">
              <div className="text-5xl sm:text-6xl font-bold font-display tracking-tight gradient-text">{formatTime(elapsedSec)}</div>
              <div className="text-sm text-muted-foreground mt-1">{half}. Halbzeit · {paused ? "Pausiert" : "Läuft"}</div>
            </div>

            {/* Camera preview */}
            <div className="aspect-video bg-muted/30 rounded-xl border border-border relative overflow-hidden">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
              {!videoRef.current?.srcObject && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
                  <Camera className="h-12 w-12" />
                </div>
              )}
              <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium">{detections} erkannt</span>
              </div>
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-card/80 backdrop-blur-sm border border-border text-xs">
                <div className={`w-2 h-2 rounded-full ${quality === "Gut" ? "bg-emerald-400" : quality === "Mittel" ? "bg-yellow-400" : "bg-destructive"}`} />
                <span className="text-muted-foreground">{quality}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handlePause}
                className="min-h-[60px] text-base font-bold bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl"
              >
                {paused ? <Play className="h-6 w-6 mr-2" /> : <Pause className="h-6 w-6 mr-2" />}
                {paused ? "WEITER" : "PAUSE"}
              </Button>
              <Button
                onClick={handleHalf}
                className="min-h-[60px] text-base font-bold bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl"
              >
                <Timer className="h-6 w-6 mr-2" /> HALBZEIT
              </Button>
              <Button
                onClick={() => setSubModalOpen(true)}
                className="min-h-[60px] text-base font-bold bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl"
              >
                <RefreshCw className="h-6 w-6 mr-2" /> WECHSEL
              </Button>
              <Button
                onClick={handleEnd}
                className="min-h-[60px] text-base font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl"
              >
                <Flag className="h-6 w-6 mr-2" /> ENDE
              </Button>
            </div>
          </div>
        )}

        {/* Phase: Ended */}
        {phase === "ended" && (
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <Flag className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display mb-2">Spiel beendet — {formatTime(elapsedSec)}</h2>
              <p className="text-sm text-muted-foreground">
                {trackerRef.current?.getFrameCount() ?? 0} Frames · {detections} Spieler erkannt
              </p>
            </div>

            {/* Player mapping placeholder */}
            <div className="text-left space-y-3">
              <h3 className="text-sm font-semibold font-display">Spieler zuordnen</h3>
              <div className="flex gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">Heim</span>
                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">Auswärts</span>
              </div>
              {Array.from({ length: Math.min(detections, 8) }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 glass-card p-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground font-mono">
                    T{i + 1}
                  </div>
                  <select className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
                    <option>Nicht zugeordnet</option>
                    {homePlayers.map((p: any) => (
                      <option key={p.id} value={p.player_id}>{p.player_name} (#{p.shirt_number})</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <Button variant="hero" size="xl" className="w-full min-h-[56px]" onClick={handleUpload} disabled={uploading}>
              {uploading ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Wird hochgeladen...</> : <><Upload className="h-5 w-5 mr-2" /> Hochladen & Report erstellen</>}
            </Button>

            {id && (
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/matches/${id}`}>Zum Match-Report</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Substitution Modal */}
      <Dialog open={subModalOpen} onOpenChange={setSubModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Auswechslung</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Minute</label>
              <input type="number" value={subMinute} onChange={e => setSubMinute(e.target.value)} placeholder={String(Math.floor(elapsedSec / 60))} className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Spieler raus</label>
              <select value={subOut} onChange={e => setSubOut(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm">
                <option value="">Wählen...</option>
                {homePlayers.filter((p: any) => p.starting).map((p: any) => (
                  <option key={p.id} value={p.player_name}>{p.player_name} (#{p.shirt_number})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Spieler rein</label>
              <select value={subIn} onChange={e => setSubIn(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm">
                <option value="">Wählen...</option>
                {homePlayers.filter((p: any) => !p.starting).map((p: any) => (
                  <option key={p.id} value={p.player_name}>{p.player_name} (#{p.shirt_number})</option>
                ))}
              </select>
            </div>
            <Button variant="hero" className="w-full" onClick={handleSub} disabled={!subOut || !subIn}>
              Bestätigen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
