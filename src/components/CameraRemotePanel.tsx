import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Play, Pause, Square, Loader2, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CameraSession {
  id: string;
  match_id: string | null;
  camera_index: number | null;
  last_used_at: string | null;
  expires_at: string;
  status_data: {
    phase?: string;
    frame_count?: number;
    updated_at?: string;
    thumbnail?: string;
  } | null;
  command: string | null;
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
};

export default function CameraRemotePanel({ matchId }: Props) {
  const [sessions, setSessions] = useState<CameraSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingCommand, setSendingCommand] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("camera_access_sessions")
      .select("id, match_id, camera_index, last_used_at, expires_at, status_data, command")
      .eq("match_id", matchId)
      .gt("expires_at", new Date().toISOString());

    setSessions((data as unknown as CameraSession[]) ?? []);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    loadSessions();

    // Subscribe to realtime changes
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
        () => {
          loadSessions();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, loadSessions]);

  const sendCommand = useCallback(async (sessionId: string, command: string) => {
    setSendingCommand(`${sessionId}-${command}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Nicht eingeloggt");
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: "send-command",
            session_id: sessionId,
            command,
          }),
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

  if (loading) return null;
  if (sessions.length === 0) return null;

  return (
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
          const thumbnail = statusData.thumbnail as string | undefined;
          const lastSeen = s.last_used_at ? new Date(s.last_used_at) : null;
          const isOnline = lastSeen && (Date.now() - lastSeen.getTime()) < 60000;
          const isRecording = currentPhase === "recording";
          const isPaused = currentPhase === "halftime_pause";
          const isReady = currentPhase === "ready";

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
                {isRecording && (
                  <span className="text-xs text-muted-foreground">{frameCount} Frames</span>
                )}
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

              <div className="flex gap-2">
                {(isReady || isPaused) && (
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
                {isRecording && (
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
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
