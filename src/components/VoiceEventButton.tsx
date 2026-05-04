// VoiceEventButton — drücken & sprechen, Audio an voice-event-parse, Vorschau zur Bestätigung.
import { useCallback, useRef, useState } from "react";
import { Mic, Square, Loader2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  matchId: string;
  sessionToken: string;
  recordingStartTime: number;
  halfNumber: number;
  homeTeamName: string;
  awayTeamName: string;
}

interface ParsedEvent {
  transcript: string;
  event_type: string;
  team: "home" | "away";
  minute: number;
  player_name?: string;
  shirt_number?: number;
  confidence: number;
  notes?: string;
}

export default function VoiceEventButton({
  matchId, sessionToken, recordingStartTime, halfNumber, homeTeamName, awayTeamName,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [proposal, setProposal] = useState<ParsedEvent | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    recRef.current?.state === "recording" && recRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 800) { toast.warning("Aufnahme zu kurz"); return; }
        setParsing(true);
        try {
          const buf = await blob.arrayBuffer();
          let bin = ""; const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          const b64 = btoa(bin);
          const elapsedMin = Math.max(1, Math.round((Date.now() - recordingStartTime) / 60000));
          const minute = halfNumber === 2 ? 45 + elapsedMin : elapsedMin;
          const { data, error } = await supabase.functions.invoke("voice-event-parse", {
            body: { audio_base64: b64, mime_type: mime, match_id: matchId, current_minute: minute, home_team: homeTeamName, away_team: awayTeamName },
          });
          if (error) throw error;
          if (data?.event) setProposal(data.event);
          else toast.error("Keine Erkennung");
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : "Sprach-Erkennung fehlgeschlagen");
        } finally { setParsing(false); }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      if (navigator.vibrate) navigator.vibrate(20);
      // Auto-stop nach 8s
      stopTimerRef.current = window.setTimeout(() => stop(), 8000);
    } catch (e) {
      toast.error("Mikrofon nicht verfügbar");
      console.error(e);
    }
  }, [matchId, recordingStartTime, halfNumber, homeTeamName, awayTeamName, stop]);

  const confirm = useCallback(async () => {
    if (!proposal) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/camera-ops`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({
            action: "log-event", session_token: sessionToken, match_id: matchId,
            event_type: proposal.event_type, minute: proposal.minute, team: proposal.team,
            player_name: proposal.player_name, notes: proposal.notes,
          }),
        },
      );
      if (!res.ok) throw new Error("Speichern fehlgeschlagen");
      toast.success(`✓ ${proposal.event_type} (Min. ${proposal.minute})`);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      setProposal(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }, [proposal, matchId, sessionToken]);

  return (
    <div className="space-y-2">
      <button
        onMouseDown={start} onMouseUp={stop} onTouchStart={start} onTouchEnd={stop}
        disabled={parsing}
        className={`w-full rounded-xl px-4 py-4 flex items-center justify-center gap-2 font-bold transition-all min-h-[64px] shadow-md select-none ${
          recording ? "bg-destructive text-destructive-foreground animate-pulse"
          : parsing ? "bg-muted text-muted-foreground"
          : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
        }`}
      >
        {parsing ? <><Loader2 className="h-5 w-5 animate-spin" /> Erkenne…</>
          : recording ? <><Square className="h-5 w-5" /> Loslassen zum Senden</>
          : <><Mic className="h-5 w-5" /> Halten & Sprechen</>}
      </button>
      <p className="text-[10px] text-center text-muted-foreground">
        z.B. „Tor für uns Minute 23 von Müller" — KI füllt Event automatisch aus
      </p>

      {proposal && (
        <div className="border border-primary/40 bg-primary/5 rounded-lg p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">KI-Vorschlag · Konfidenz {Math.round(proposal.confidence * 100)}%</p>
          <p className="text-xs italic text-muted-foreground">"{proposal.transcript}"</p>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="rounded bg-background px-2 py-0.5 font-mono">{proposal.minute}'</span>
            <span className={`rounded px-2 py-0.5 ${proposal.team === "home" ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>
              {proposal.team === "home" ? homeTeamName : awayTeamName}
            </span>
            <span className="rounded bg-foreground/10 px-2 py-0.5 font-semibold">{proposal.event_type}</span>
            {proposal.player_name && <span className="rounded bg-background px-2 py-0.5">{proposal.player_name}</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={confirm} className="flex-1 rounded-md bg-primary text-primary-foreground py-2 text-sm font-semibold flex items-center justify-center gap-1">
              <Check className="h-4 w-4" /> Bestätigen
            </button>
            <button onClick={() => setProposal(null)} className="rounded-md bg-muted px-3 py-2 text-sm">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
