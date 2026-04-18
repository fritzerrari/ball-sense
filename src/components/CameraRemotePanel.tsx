import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Camera, Play, Pause, Square, Loader2, Wifi, WifiOff, CloudUpload, ShieldCheck, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import WalkieTalkie from "@/components/WalkieTalkie";

interface CameraSession {
  id: string;
  match_id: string | null;
  camera_index: number | null;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  transfer_authorized: boolean;
  status_data: {
    phase?: string;
    frame_count?: number;
    synced_frames?: number;
    updated_at?: string;
    thumbnail?: string;
  } | null;
  command: string | null;
}

function formatJoinTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

interface Props {
  matchId: string;
}

const PHASE_LABELS: Record<string, string> = {
  ready: "Bereit",
  recording: "Aufnahme",
  halftime_pause: "Halbzeit-Pause",
  analyzing: "Wird analysiert",
  done: "Fertig",
  setup: "Wird eingerichtet",
  waiting_auth: "Wartet auf Freigabe",
};

export default function CameraRemotePanel({ matchId }: Props) {
  const [sessions, setSessions] = useState<CameraSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingCommand, setSendingCommand] = useState<string | null>(null);
  const [togglingAuth, setTogglingAuth] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("camera_access_sessions")
      .select("id, match_id, camera_index, created_at, last_used_at, expires_at, transfer_authorized, status_data, command")
      .eq("match_id", matchId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });

    setSessions((data as unknown as CameraSession[]) ?? []);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    loadSessions();

    const channel = supabase
      .channel(`camera-sessions-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "camera_access_sessions",
          filter: `match_id=eq.${matchId}`,
        },
        () => { loadSessions(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId, loadSessions]);

  const sendCommand = useCallback(async (sessionId: string, command: string) => {
    setSendingCommand(`${sessionId}-${command}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Nicht eingeloggt"); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "send-command", session_id: sessionId, command }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Befehl fehlgeschlagen");
      }

      toast.success(
        command === "start" ? "Start gesendet" :
        command === "halftime" ? "Halbzeit-Befehl gesendet" :
        "Stop-Befehl gesendet",
      );
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Senden");
    } finally {
      setSendingCommand(null);
    }
  }, []);

  const toggleTransferAuth = useCallback(async (sessionId: string, authorized: boolean) => {
    setTogglingAuth(sessionId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Nicht eingeloggt"); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "authorize-transfer", session_id: sessionId, authorized }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Freigabe fehlgeschlagen");
      }

      toast.success(authorized ? "Datenübertragung freigegeben" : "Datenübertragung gesperrt");
      loadSessions();
    } catch (err: any) {
      toast.error(err.message ?? "Fehler");
    } finally {
      setTogglingAuth(null);
    }
  }, [loadSessions]);

  if (loading) return null;
  if (sessions.length === 0) return null;

  return (
    <>
    <WalkieTalkie matchId={matchId} userId="trainer" userName="Trainer" />
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Kamera-Helfer</h3>
          <Badge variant="outline" className="text-[10px]">{sessions.length} aktiv</Badge>
        </div>

        {sessions.map((s) => {
          const statusData = s.status_data ?? {};
          const currentPhase = statusData.phase ?? "unknown";
          const frameCount = statusData.frame_count ?? 0;
          const syncedFrames = statusData.synced_frames ?? 0;
          const thumbnail = statusData.thumbnail as string | undefined;
          const lastSeen = s.last_used_at ? new Date(s.last_used_at) : null;
          const isOnline = lastSeen && (Date.now() - lastSeen.getTime()) < 30000;
          const isRecording = currentPhase === "recording";
          const isPaused = currentPhase === "halftime_pause";
          const isReady = currentPhase === "ready";
          const isAuthorized = s.transfer_authorized;

          return (
            <div key={s.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isOnline ? (
                    <Wifi className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">
                    Kamera {s.camera_index ?? 1}
                  </span>
                  <Badge
                    variant={isRecording ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {PHASE_LABELS[currentPhase] ?? currentPhase}
                  </Badge>
                </div>
              </div>

              {/* Transfer authorization toggle */}
              <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  {isAuthorized ? (
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ShieldOff className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="text-xs font-medium">
                    {isAuthorized ? "Datenübertragung aktiv" : "Datenübertragung gesperrt"}
                  </span>
                </div>
                <Switch
                  checked={isAuthorized}
                  disabled={togglingAuth === s.id}
                  onCheckedChange={(checked) => toggleTransferAuth(s.id, checked)}
                />
              </div>

              {/* Live thumbnail preview */}
              {thumbnail && isOnline && (
                <div className="rounded overflow-hidden border border-border">
                  <img
                    src={`data:image/jpeg;base64,${thumbnail}`}
                    alt="Live-Vorschau"
                    className="w-full h-auto"
                  />
                </div>
              )}

              {/* Sync progress — shown during recording */}
              {isRecording && frameCount > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <CloudUpload className="h-3 w-3" />
                      <span>{syncedFrames} / {frameCount} Frames sync</span>
                    </div>
                    <span>{Math.round((syncedFrames / Math.max(frameCount, 1)) * 100)}%</span>
                  </div>
                  <Progress 
                    value={(syncedFrames / Math.max(frameCount, 1)) * 100} 
                    className="h-1.5" 
                  />
                </div>
              )}

              <div className="flex gap-2">
                {(isReady || isPaused) && isAuthorized && (
                  <Button
                    size="sm"
                    className="gap-1.5 h-8 text-xs"
                    disabled={sendingCommand === `${s.id}-start`}
                    onClick={() => sendCommand(s.id, "start")}
                  >
                    {sendingCommand === `${s.id}-start` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    {isPaused ? "2. HZ starten" : "Start"}
                  </Button>
                )}
                {isRecording && isAuthorized && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5 h-8 text-xs"
                      disabled={sendingCommand === `${s.id}-halftime`}
                      onClick={() => sendCommand(s.id, "halftime")}
                    >
                      {sendingCommand === `${s.id}-halftime` ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Pause className="h-3 w-3" />
                      )}
                      Halbzeit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5 h-8 text-xs"
                      disabled={sendingCommand === `${s.id}-stop`}
                      onClick={() => sendCommand(s.id, "stop")}
                    >
                      {sendingCommand === `${s.id}-stop` ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Square className="h-3 w-3" />
                      )}
                      Stop
                    </Button>
                  </>
                )}
                {!isAuthorized && (isReady || isPaused) && (
                  <p className="text-[10px] text-muted-foreground italic">
                    Datenübertragung zuerst freigeben
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
    </>
  );
}
