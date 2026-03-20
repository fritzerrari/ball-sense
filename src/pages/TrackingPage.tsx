import { useParams, useSearchParams, Link } from "react-router-dom";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Camera, Pause, Play, Users, RefreshCw, Flag, Timer, Loader2, Upload, AlertTriangle, Check, Wifi, WifiOff, Sparkles, ShieldAlert } from "lucide-react";
import { LiveEventTicker } from "@/components/LiveEventTicker";
import { useMatch, useMatchEvents, useMatchLineups, useUpdateMatch } from "@/hooks/use-matches";
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
  const queryClient = useQueryClient();

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
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardMinute, setCardMinute] = useState("");
  const [cardPlayer, setCardPlayer] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<string>("compress");
  const [uploadDone, setUploadDone] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [half, setHalf] = useState(1);
  const [showHalftimeUpload, setShowHalftimeUpload] = useState(false);
  const [halftimeUploading, setHalftimeUploading] = useState(false);
  const [halftimeUploadProgress, setHalftimeUploadProgress] = useState(0);
  const [halftimeUploadDone, setHalftimeUploadDone] = useState(false);

  const trackerRef = useRef<FootballTracker | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackingVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { data: matchEvents } = useMatchEvents(id);
  const homePlayers = (lineups ?? []).filter(l => l.team === "home");
  const currentMinute = Math.floor(elapsedSec / 60);

  const getPlayerStartMinute = useCallback((player: any) => {
    return player.subbed_in_min ?? (player.starting ? 0 : null);
  }, []);

  const getPlayerExitMinute = useCallback((player: any, fallbackMinute: number) => {
    const eventMinute = (matchEvents ?? [])
      .filter((event: any) => event.player_id && player.player_id && event.player_id === player.player_id)
      .filter((event: any) => ["red_card", "yellow_red_card", "player_deactivated"].includes(event.event_type))
      .map((event: any) => event.minute)
      .sort((a: number, b: number) => a - b)[0];

    const candidates = [player.subbed_out_min, eventMinute, fallbackMinute].filter(
      (value): value is number => typeof value === "number",
    );

    return candidates.length > 0 ? Math.min(...candidates) : fallbackMinute;
  }, [matchEvents]);

  const activeHomePlayers = useMemo(() => {
    return homePlayers.filter((player: any) => {
      const startMinute = getPlayerStartMinute(player);
      if (startMinute === null) return false;
      return startMinute <= currentMinute && getPlayerExitMinute(player, currentMinute + 1) > currentMinute;
    });
  }, [currentMinute, getPlayerExitMinute, getPlayerStartMinute, homePlayers]);

  const reviewSummary = useMemo(() => {
    const finishedMinute = Math.max(1, Math.floor(elapsedSec / 60));
    const substitutions = (matchEvents ?? []).filter((event: any) => event.event_type === "substitution").length;
    const dismissals = (matchEvents ?? []).filter((event: any) => ["red_card", "yellow_red_card", "player_deactivated"].includes(event.event_type)).length;

    const players = homePlayers.map((player: any) => {
      const startMinute = getPlayerStartMinute(player);
      const endMinute = getPlayerExitMinute(player, finishedMinute);
      const activeMinutes = startMinute === null ? 0 : Math.max(0, endMinute - startMinute);
      const sentOff = (matchEvents ?? []).some(
        (event: any) =>
          event.player_id &&
          player.player_id &&
          event.player_id === player.player_id &&
          ["red_card", "yellow_red_card", "player_deactivated"].includes(event.event_type),
      );

      const tags = [
        player.starting ? "Startelf" : player.subbed_in_min != null ? `ab ${player.subbed_in_min}'` : "Bank",
        player.subbed_out_min != null ? `bis ${player.subbed_out_min}'` : null,
        sentOff ? "Karte / raus" : null,
      ].filter(Boolean) as string[];

      return {
        ...player,
        startMinute,
        endMinute,
        activeMinutes,
        sentOff,
        tags,
      };
    });

    const autoAssigned = players.filter((player) => player.activeMinutes > 0);
    const issues: string[] = [];

    if (Math.abs(detections - autoAssigned.length) >= 3) {
      issues.push(`Es wurden ${detections} Tracks erkannt, aber laut Aufstellung waren ${autoAssigned.length} Heimspieler aktiv.`);
    }

    players
      .filter((player) => player.subbed_in_min != null || player.subbed_out_min != null || player.sentOff)
      .slice(0, 3)
      .forEach((player) => {
        issues.push(`${player.player_name} hat ein Sonderereignis und sollte kurz geprüft werden.`);
      });

    if (issues.length === 0) {
      issues.push("Keine Auffälligkeiten — die gespeicherte Aufstellung kann direkt übernommen werden.");
    }

    return { autoAssigned, dismissals, issues, players, substitutions };
  }, [detections, elapsedSec, getPlayerExitMinute, getPlayerStartMinute, homePlayers, matchEvents]);

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
      // Save stream reference for re-attachment after phase changes
      if (videoRef.current.srcObject) {
        streamRef.current = videoRef.current.srcObject as MediaStream;
      }
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
    setShowHalftimeUpload(true);
    toast.success("Halbzeit! Du kannst jetzt die erste Hälfte hochladen.");
  };

  const handleEnd = () => {
    trackerRef.current?.stopTracking();
    // Also stop the stream from our ref
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setPhase("ended");
  };

  const handleHalftimeUpload = async () => {
    if (!trackerRef.current || !id) return;
    setHalftimeUploading(true);
    setHalftimeUploadProgress(0);
    try {
      setHalftimeUploadProgress(15);
      const result = await trackerRef.current.uploadMatch(
        id, cam,
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      );
      setHalftimeUploadProgress(60);

      await supabase.from("tracking_uploads").insert({
        match_id: id,
        camera_index: cam,
        file_path: result.filePath,
        status: "uploaded",
        frames_count: result.framesCount,
        duration_sec: result.durationSec,
      });
      setHalftimeUploadProgress(100);
      setHalftimeUploadDone(true);
      toast.success("1. Halbzeit hochgeladen! Starte die 2. Halbzeit wenn es losgeht.");
    } catch {
      toast.error("Upload fehlgeschlagen — wird nach Spielende erneut versucht");
      setHalftimeUploadProgress(0);
    } finally {
      setHalftimeUploading(false);
    }
  };

  const handleResumeSecondHalf = () => {
    setShowHalftimeUpload(false);
    trackerRef.current?.resumeTracking();
    setPaused(false);
  };

  const uploadStages = [
    { key: "compress", label: "Daten komprimieren", weight: 10 },
    { key: "upload", label: "Upload zum Server", weight: 50 },
    { key: "register", label: "Daten registrieren", weight: 20 },
    { key: "status", label: "Verarbeitung starten", weight: 20 },
  ];

  const getOverallProgress = (stage: string, stagePct: number) => {
    let total = 0;
    for (const s of uploadStages) {
      if (s.key === stage) {
        total += (stagePct / 100) * s.weight;
        break;
      }
      total += s.weight;
    }
    return Math.round(total);
  };

  const handleUpload = async () => {
    if (!trackerRef.current || !id) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadStage("compress");
    try {
      const result = await trackerRef.current.uploadMatch(
        id, cam,
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        (stage, pct) => {
          setUploadStage(stage);
          setUploadProgress(getOverallProgress(stage, pct));
        },
      );

      // Register in DB (with retry)
      setUploadStage("register");
      setUploadProgress(getOverallProgress("register", 20));
      let registered = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { error } = await supabase.from("tracking_uploads").insert({
          match_id: id,
          camera_index: cam,
          file_path: result.filePath,
          status: "uploaded",
          frames_count: result.framesCount,
          duration_sec: result.durationSec,
        });
        if (!error) { registered = true; break; }
        console.warn(`[Upload] DB-Registrierung Versuch ${attempt}/3:`, error.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1000));
      }
      if (!registered) {
        toast.error("Datei hochgeladen, aber Registrierung fehlgeschlagen. Bitte Support kontaktieren.");
      }
      setUploadProgress(getOverallProgress("register", 100));

      // Update match status to processing
      setUploadStage("status");
      setUploadProgress(getOverallProgress("status", 20));
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await updateMatch.mutateAsync({ id, status: "processing" });
          break;
        } catch {
          if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1000));
        }
      }
      setUploadProgress(getOverallProgress("status", 50));

      // Trigger backend processing
      try {
        const { error: procErr } = await supabase.functions.invoke("process-tracking", {
          body: { matchId: id },
        });
        if (procErr) {
          console.warn("[Upload] Verarbeitung fehlgeschlagen:", procErr);
          toast.error("Upload erfolgreich, Verarbeitung wird im Hintergrund fortgesetzt.");
        } else {
          toast.success("Tracking-Daten verarbeitet! Statistiken sind bereit.");
        }
      } catch (procEx) {
        console.warn("[Upload] Processing invocation error:", procEx);
        toast.error("Upload erfolgreich, Verarbeitung wird im Hintergrund fortgesetzt.");
      }

      setUploadProgress(100);
      setUploadDone(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unbekannter Fehler";
      console.error("[Upload] Fehler:", errorMsg);
      toast.error(`Upload fehlgeschlagen: ${errorMsg}. Daten wurden lokal gesichert.`);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleSub = async () => {
    if (!subOut || !subIn || !id) return;
    const minute = parseInt(subMinute) || Math.floor(elapsedSec / 60);

    const outPlayer = homePlayers.find((p: any) => p.player_name === subOut);
    const inPlayer = homePlayers.find((p: any) => p.player_name === subIn);

    try {
      if (outPlayer) {
        await supabase.from("match_lineups").update({ subbed_out_min: minute }).eq("id", outPlayer.id);
      }
      if (inPlayer) {
        await supabase.from("match_lineups").update({ subbed_in_min: minute }).eq("id", inPlayer.id);
      }
      await supabase.from("match_events").insert({
        match_id: id,
        team: "home",
        minute,
        event_type: "substitution",
        player_id: outPlayer?.player_id ?? null,
        related_player_id: inPlayer?.player_id ?? null,
        player_name: outPlayer?.player_name ?? null,
        related_player_name: inPlayer?.player_name ?? null,
      });
      toast.success(`Wechsel: ${subOut} raus, ${subIn} rein (${minute}. Minute)`);
      queryClient.invalidateQueries({ queryKey: ["match_lineups", id] });
      queryClient.invalidateQueries({ queryKey: ["match_events", id] });
    } catch {
      toast.error("Wechsel konnte nicht gespeichert werden");
    }

    setSubModalOpen(false);
    setSubOut("");
    setSubIn("");
    setSubMinute("");
  };

  const handleRedCard = async () => {
    if (!cardPlayer || !id) return;
    const minute = parseInt(cardMinute) || Math.floor(elapsedSec / 60);
    const player = homePlayers.find((entry: any) => entry.player_name === cardPlayer);

    try {
      await supabase.from("match_events").insert({
        match_id: id,
        team: "home",
        minute,
        event_type: "red_card",
        player_id: player?.player_id ?? null,
        player_name: player?.player_name ?? cardPlayer,
      });
      toast.success(`Rote Karte für ${cardPlayer} (${minute}. Minute)`);
      queryClient.invalidateQueries({ queryKey: ["match_events", id] });
    } catch {
      toast.error("Rote Karte konnte nicht gespeichert werden");
    }

    setCardModalOpen(false);
    setCardPlayer("");
    setCardMinute("");
  };

  // Attach stream to tracking video when phase changes
  useEffect(() => {
    if (phase === "tracking" && trackingVideoRef.current && streamRef.current) {
      trackingVideoRef.current.srcObject = streamRef.current;
      trackingVideoRef.current.play().catch(() => {});
    }
  }, [phase]);

  // No longer needed — single persistent video element handles this

  useEffect(() => {
    if (phase === "loading") handleLoadModel();
  }, []);

  const isCalibrated = field?.calibration != null;

  return (
    <div className="min-h-screen bg-background flex flex-col landscape:min-h-[100dvh]">
      {/* Landscape hint for portrait mode */}
      <div className="portrait:flex landscape:hidden items-center justify-center p-3 bg-primary/10 border-b border-primary/20 text-sm text-primary gap-2 md:hidden">
        <Camera className="h-4 w-4" />
        <span>Drehe dein Gerät ins Querformat für optimales Tracking</span>
      </div>
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

      {/* Persistent video element — stays in DOM across all phases */}
      <video
        ref={videoRef}
        className={`${phase === "tracking" ? "hidden" : "hidden"}`}
        playsInline
        muted
        autoPlay
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        {/* Stepper */}
        {(phase === "loading" || phase === "camera" || phase === "calibration") && (
          <div className="w-full max-w-sm mb-6">
            <div className="flex items-center gap-2">
              {[
                { key: "loading", label: "KI laden" },
                { key: "camera", label: "Kamera" },
                { key: "calibration", label: "Kalibrierung" },
              ].map((step, i, arr) => {
                const steps = arr.map(s => s.key);
                const currentIdx = steps.indexOf(phase);
                const stepIdx = i;
                const isDone = stepIdx < currentIdx;
                const isActive = stepIdx === currentIdx;
                return (
                  <div key={step.key} className="flex items-center gap-2 flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                      isDone ? "bg-primary text-primary-foreground" : isActive ? "bg-primary/20 text-primary border-2 border-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium hidden sm:inline ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
                    {i < arr.length - 1 && <div className={`flex-1 h-0.5 rounded ${isDone ? "bg-primary" : "bg-muted"}`} />}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Schritt {["loading", "camera", "calibration"].indexOf(phase) + 1} von 3
            </p>
          </div>
        )}

        {/* Phase: Loading */}
        {phase === "loading" && (
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center animate-glow-pulse">
              <Camera className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display mb-2">KI-Modell wird geladen...</h2>
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
            <h2 className="text-xl font-bold font-display">Kamera aktivieren</h2>
            <p className="text-sm text-muted-foreground">Erlaube den Kamerazugriff, um mit dem Tracking zu beginnen.</p>
            {/* Camera preview shown inline */}
            <div className="w-full aspect-video rounded-xl bg-muted/30 border border-border overflow-hidden" />
            <Button variant="hero" size="xl" onClick={handleStartCamera} className="w-full min-h-[56px]">
              Kamera starten
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
              <video ref={trackingVideoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />
              {!streamRef.current && (
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
                onClick={() => setCardModalOpen(true)}
                className="min-h-[60px] text-base font-bold bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl"
              >
                <ShieldAlert className="h-6 w-6 mr-2" /> ROTE KARTE
              </Button>
              <LiveEventTicker
                matchId={id!}
                elapsedSec={elapsedSec}
                homePlayers={homePlayers as any}
                awayPlayers={awayPlayers as any}
                trackOpponent={match?.track_opponent}
                onEventAdded={() => queryClient.invalidateQueries({ queryKey: ["match_events", id] })}
              />
              <Button
                onClick={handleEnd}
                className="min-h-[60px] text-base font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl col-span-2"
              >
                <Flag className="h-6 w-6 mr-2" /> ENDE
              </Button>
            </div>

            {/* Halftime Upload Overlay */}
            {showHalftimeUpload && (
              <div className="glass-card p-5 space-y-4 border-primary/30">
                <div className="text-center">
                  <Timer className="h-8 w-8 text-primary mx-auto mb-2" />
                  <h3 className="font-bold font-display text-lg">Halbzeitpause</h3>
                  <p className="text-sm text-muted-foreground">Lade die Daten der 1. Halbzeit jetzt hoch für eine erste Analyse.</p>
                </div>

                {(halftimeUploading || halftimeUploadDone) && (
                  <div className="space-y-2">
                    <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${halftimeUploadDone ? "bg-primary" : "bg-primary/70"}`}
                        style={{ width: `${halftimeUploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {halftimeUploadDone ? "✓ 1. Halbzeit hochgeladen" : `${halftimeUploadProgress}% — Upload läuft...`}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  {!halftimeUploadDone && (
                    <Button
                      variant="hero"
                      className="flex-1 min-h-[50px]"
                      onClick={handleHalftimeUpload}
                      disabled={halftimeUploading}
                    >
                      {halftimeUploading ? (
                        <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Wird hochgeladen...</>
                      ) : (
                        <><Upload className="h-5 w-5 mr-2" /> 1. HZ hochladen</>
                      )}
                    </Button>
                  )}
                  <Button
                    variant={halftimeUploadDone ? "hero" : "heroOutline"}
                    className="flex-1 min-h-[50px]"
                    onClick={handleResumeSecondHalf}
                    disabled={halftimeUploading}
                  >
                    <Play className="h-5 w-5 mr-2" /> 2. HZ starten
                  </Button>
                </div>

                {!halftimeUploadDone && !halftimeUploading && (
                  <button
                    onClick={handleResumeSecondHalf}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors block mx-auto"
                  >
                    Überspringen — nach dem Spiel alles hochladen
                  </button>
                )}
              </div>
            )}
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

            <div className="text-left space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold font-display flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Aufstellung übernommen
                </h3>
                <span className="text-xs text-muted-foreground">
                  {reviewSummary.autoAssigned.length} automatisch aktiv
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="glass-card p-3 text-center">
                  <p className="text-xs text-muted-foreground">Aktive Spieler</p>
                  <p className="text-xl font-bold font-display text-foreground">{reviewSummary.autoAssigned.length}</p>
                </div>
                <div className="glass-card p-3 text-center">
                  <p className="text-xs text-muted-foreground">Wechsel</p>
                  <p className="text-xl font-bold font-display text-foreground">{reviewSummary.substitutions}</p>
                </div>
                <div className="glass-card p-3 text-center">
                  <p className="text-xs text-muted-foreground">Karten / raus</p>
                  <p className="text-xl font-bold font-display text-foreground">{reviewSummary.dismissals}</p>
                </div>
              </div>

              <div className="glass-card p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Review nur bei Ausnahmen
                </p>
                <div className="space-y-2">
                  {reviewSummary.issues.map((issue, index) => (
                    <div key={index} className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                      {issue}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {reviewSummary.players.map((player) => (
                  <div key={player.id} className="glass-card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{player.player_name || "Unbekannter Spieler"}</p>
                        <p className="text-xs text-muted-foreground">
                          #{player.shirt_number ?? "–"} · {player.activeMinutes} Min aktiv
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {player.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground border border-border">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upload Progress */}
            {(uploading || uploadDone) && (
              <div className="space-y-4">
                {/* Stage steps */}
                <div className="space-y-2">
                  {uploadStages.map((s, i) => {
                    const stageIdx = uploadStages.findIndex(st => st.key === uploadStage);
                    const isDone = i < stageIdx || uploadDone;
                    const isActive = i === stageIdx && !uploadDone;
                    return (
                      <div key={s.key} className="flex items-center gap-3 text-sm">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                          isDone ? "bg-primary text-primary-foreground" : isActive ? "bg-primary/20 border-2 border-primary" : "bg-muted"
                        }`}>
                          {isDone ? <Check className="h-3.5 w-3.5" /> : isActive ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <span className="text-xs text-muted-foreground">{i + 1}</span>}
                        </div>
                        <span className={isDone ? "text-foreground" : isActive ? "text-foreground font-medium" : "text-muted-foreground"}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Overall progress bar */}
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${uploadDone ? "bg-primary" : "bg-primary/80"}`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {uploadDone ? "✓ Alle Schritte abgeschlossen" : `${uploadProgress}%`}
                </p>
              </div>
            )}

            {uploadDone ? (
              <div className="space-y-3">
                <div className="glass-card p-4 text-center border-emerald-500/30">
                  <Check className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="font-semibold font-display">Upload erfolgreich!</p>
                  <p className="text-sm text-muted-foreground">Die Daten werden jetzt verarbeitet.</p>
                </div>
                {id && (
                  <Button variant="hero" size="xl" className="w-full min-h-[56px]" asChild>
                    <Link to={`/matches/${id}`}>Zum Match-Report</Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Button variant="hero" size="xl" className="w-full min-h-[56px]" onClick={handleUpload} disabled={uploading}>
                  {uploading ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Wird hochgeladen...</> : <><Upload className="h-5 w-5 mr-2" /> Hochladen & Report erstellen</>}
                </Button>
                {id && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/matches/${id}`}>Zum Match-Report</Link>
                  </Button>
                )}
              </>
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
                {activeHomePlayers.map((p: any) => (
                  <option key={p.id} value={p.player_name}>{p.player_name} (#{p.shirt_number})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Spieler rein</label>
              <select value={subIn} onChange={e => setSubIn(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm">
                <option value="">Wählen...</option>
                {homePlayers.filter((p: any) => !activeHomePlayers.some((active: any) => active.id === p.id)).map((p: any) => (
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

      <Dialog open={cardModalOpen} onOpenChange={setCardModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Rote Karte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Minute</label>
              <input type="number" value={cardMinute} onChange={e => setCardMinute(e.target.value)} placeholder={String(Math.floor(elapsedSec / 60))} className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Spieler</label>
              <select value={cardPlayer} onChange={e => setCardPlayer(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm">
                <option value="">Wählen...</option>
                {activeHomePlayers.map((p: any) => (
                  <option key={p.id} value={p.player_name}>{p.player_name} (#{p.shirt_number})</option>
                ))}
              </select>
            </div>
            <Button variant="hero" className="w-full" onClick={handleRedCard} disabled={!cardPlayer}>
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
