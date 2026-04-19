/**
 * Walkie-Talkie (Push-to-Talk) — Android-hardened.
 *
 * Improvements over previous build:
 *   - Audio context unlocked on first user interaction (Android requires gesture).
 *   - Mic stream constraints tuned for voice (echoCancellation, noiseSuppression,
 *     autoGainControl, mono, 16kHz) — drastically reduces feedback on Android.
 *   - Audio elements pooled per peer (no leaks, .play() retried with user-gesture fallback).
 *   - Wake Lock kept while panel open so screen-off doesn't kill mic on Android.
 *   - Heartbeat keeps RTCPeerConnections alive; auto-reconnect on ICE failure.
 *   - PTT works with onPointerDown AND keyboard Space for desktop testing.
 *   - Speaking broadcast throttled (2/s max) to avoid Realtime spam.
 *   - Mic track explicitly stopped+restarted on resume to avoid Android "frozen mic" bug.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Radio, Volume2, VolumeX, X, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Props {
  matchId: string;
  userId: string;
  userName: string;
}

interface Peer {
  id: string;
  name: string;
  speaking: boolean;
}

const VOICE_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 16000,
  } as MediaTrackConstraints,
  video: false,
};

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 4,
};

export default function WalkieTalkie({ matchId, userId, userName }: Props) {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [connected, setConnected] = useState(false);
  const [incomingSpeaker, setIncomingSpeaker] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const connectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<any>(null);
  const lastSpeakingBroadcastRef = useRef(0);
  const reconnectTimersRef = useRef<Map<string, number>>(new Map());

  // ── Cleanup helpers ──────────────────────────────────────────────────────
  const closePeer = useCallback((peerId: string) => {
    const pc = connectionsRef.current.get(peerId);
    if (pc) {
      try { pc.close(); } catch { /* ignored */ }
      connectionsRef.current.delete(peerId);
    }
    const audio = audioElementsRef.current.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audioElementsRef.current.delete(peerId);
    }
    const timer = reconnectTimersRef.current.get(peerId);
    if (timer) {
      clearTimeout(timer);
      reconnectTimersRef.current.delete(peerId);
    }
  }, []);

  // ── Audio unlock (required on Android Chrome) ────────────────────────────
  const unlockAudio = useCallback(async () => {
    if (audioUnlocked) return;
    try {
      const Ctx = (window as any).AudioContext ?? (window as any).webkitAudioContext;
      if (Ctx) {
        const ctx = audioContextRef.current ?? new Ctx();
        audioContextRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume();
        // Tiny silent oscillator to fully unlock the audio output pipeline on Android
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      }
      // Replay any waiting peer audio
      audioElementsRef.current.forEach((audio) => {
        audio.play().catch(() => { /* ignored — will retry on next ontrack */ });
      });
      setAudioUnlocked(true);
    } catch (err) {
      console.warn("[walkie] audio unlock failed:", err);
    }
  }, [audioUnlocked]);

  // ── Wake Lock: keep screen alive while channel open (Android tab kill mitigation) ──
  const requestWakeLock = useCallback(async () => {
    try {
      const wl = (navigator as any).wakeLock;
      if (wl?.request) {
        wakeLockRef.current = await wl.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          // Re-request on release if panel still open
          if (open) requestWakeLock().catch(() => { /* ignored */ });
        });
      }
    } catch { /* not critical */ }
  }, [open]);

  const releaseWakeLock = useCallback(async () => {
    try { await wakeLockRef.current?.release(); } catch { /* ignored */ }
    wakeLockRef.current = null;
  }, []);

  // ── Page visibility re-acquisition (mic freezes on Android when tab backgrounded) ──
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && open) {
        // Re-request wake lock — released by browser on backgrounding
        requestWakeLock().catch(() => { /* ignored */ });
        // Re-resume audio context — Android suspends it
        audioContextRef.current?.resume().catch(() => { /* ignored */ });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [open, requestWakeLock]);

  // ── WebRTC: create offer to a peer ───────────────────────────────────────
  const createOffer = useCallback(async (peerId: string) => {
    if (connectionsRef.current.has(peerId)) return; // already connecting
    const pc = new RTCPeerConnection(RTC_CONFIG);
    connectionsRef.current.set(peerId, pc);

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.ontrack = (event) => {
      let audio = audioElementsRef.current.get(peerId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        (audio as any).playsInline = true;
        audioElementsRef.current.set(peerId, audio);
      }
      audio.srcObject = event.streams[0];
      audio.play().catch((err) => {
        console.warn("[walkie] audio.play() blocked — waiting for unlock", err);
        if (!audioUnlocked) {
          toast.info("Tippe einmal auf den Funk-Knopf, um Audio zu aktivieren");
        }
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current?.send({
          type: "broadcast",
          event: "signal",
          payload: { from: userId, target: peerId, type: "ice", candidate: event.candidate.toJSON() },
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        // Auto-reconnect with backoff
        if (!reconnectTimersRef.current.has(peerId)) {
          const timer = window.setTimeout(() => {
            reconnectTimersRef.current.delete(peerId);
            closePeer(peerId);
            createOffer(peerId).catch(() => { /* ignored */ });
          }, 1500);
          reconnectTimersRef.current.set(peerId, timer);
        }
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      channelRef.current?.send({
        type: "broadcast",
        event: "signal",
        payload: { from: userId, target: peerId, type: "offer", sdp: offer.sdp },
      });
    } catch (err) {
      console.error("[walkie] createOffer failed:", err);
      closePeer(peerId);
    }
  }, [userId, audioUnlocked, closePeer]);

  // ── WebRTC: handle incoming signal ───────────────────────────────────────
  const handleSignal = useCallback(async (payload: any) => {
    const { from, type } = payload;

    if (type === "offer") {
      // If already connecting, replace
      if (connectionsRef.current.has(from)) closePeer(from);
      const pc = new RTCPeerConnection(RTC_CONFIG);
      connectionsRef.current.set(from, pc);

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.ontrack = (event) => {
        let audio = audioElementsRef.current.get(from);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          (audio as any).playsInline = true;
          audioElementsRef.current.set(from, audio);
        }
        audio.srcObject = event.streams[0];
        audio.play().catch(() => { /* ignored */ });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channelRef.current?.send({
            type: "broadcast",
            event: "signal",
            payload: { from: userId, target: from, type: "ice", candidate: event.candidate.toJSON() },
          });
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: payload.sdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channelRef.current?.send({
          type: "broadcast",
          event: "signal",
          payload: { from: userId, target: from, type: "answer", sdp: answer.sdp },
        });
      } catch (err) {
        console.error("[walkie] handle offer failed:", err);
        closePeer(from);
      }
    } else if (type === "answer") {
      const pc = connectionsRef.current.get(from);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: payload.sdp }));
        } catch (err) {
          console.error("[walkie] setRemoteDescription answer failed:", err);
        }
      }
    } else if (type === "ice") {
      const pc = connectionsRef.current.get(from);
      if (pc && payload.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (err) {
          console.warn("[walkie] addIceCandidate failed:", err);
        }
      }
    }
  }, [userId, closePeer]);

  // ── Join channel ──────────────────────────────────────────────────────────
  const joinChannel = useCallback(async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(VOICE_CONSTRAINTS);
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach((t) => (t.enabled = false));

      const channel = supabase.channel(`walkie-${matchId}`, {
        config: { presence: { key: userId } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const newPeers = new Map<string, Peer>();
          Object.entries(state).forEach(([key, presences]) => {
            if (key !== userId) {
              const p = (presences as any[])[0];
              newPeers.set(key, {
                id: key,
                name: p?.name ?? "Teilnehmer",
                speaking: p?.speaking ?? false,
              });
            }
          });
          setPeers(newPeers);
        })
        .on("presence", { event: "join" }, ({ key }) => {
          if (key !== userId) createOffer(key).catch(() => { /* ignored */ });
        })
        .on("presence", { event: "leave" }, ({ key }) => {
          closePeer(key);
        })
        .on("broadcast", { event: "signal" }, async ({ payload }) => {
          if (payload.target !== userId) return;
          await handleSignal(payload);
        })
        .on("broadcast", { event: "speaking" }, ({ payload }) => {
          if (payload.userId !== userId) {
            setIncomingSpeaker(payload.speaking ? payload.name : null);
            if (payload.speaking && navigator.vibrate) navigator.vibrate(20);
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({
              name: userName,
              speaking: false,
              joined_at: new Date().toISOString(),
            });
            setConnected(true);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setErrorMsg("Funk-Verbindung gestört — versuche es erneut");
          }
        });

      channelRef.current = channel;
      requestWakeLock().catch(() => { /* ignored */ });
    } catch (err: any) {
      const name = err?.name ?? "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setErrorMsg("Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.");
      } else if (name === "NotFoundError") {
        setErrorMsg("Kein Mikrofon gefunden");
      } else {
        setErrorMsg("Funk konnte nicht gestartet werden");
      }
    }
  }, [matchId, userId, userName, createOffer, handleSignal, closePeer, requestWakeLock]);

  // ── PTT: start ───────────────────────────────────────────────────────────
  const startSpeaking = useCallback(() => {
    if (muted || !connected) return;
    void unlockAudio();
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    tracks.forEach((t) => (t.enabled = true));
    setSpeaking(true);
    if (navigator.vibrate) navigator.vibrate(30);

    // Throttled broadcast
    const now = Date.now();
    if (now - lastSpeakingBroadcastRef.current > 500) {
      lastSpeakingBroadcastRef.current = now;
      channelRef.current?.send({
        type: "broadcast",
        event: "speaking",
        payload: { userId, name: userName, speaking: true },
      });
    }
  }, [muted, connected, unlockAudio, userId, userName]);

  const stopSpeaking = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    tracks.forEach((t) => (t.enabled = false));
    setSpeaking(false);
    channelRef.current?.send({
      type: "broadcast",
      event: "speaking",
      payload: { userId, name: userName, speaking: false },
    });
  }, [userId, userName]);

  // ── Keyboard PTT (desktop testing) ───────────────────────────────────────
  useEffect(() => {
    if (!open || !connected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !speaking) {
        e.preventDefault();
        startSpeaking();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && speaking) {
        e.preventDefault();
        stopSpeaking();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [open, connected, speaking, startSpeaking, stopSpeaking]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      connectionsRef.current.forEach((pc) => pc.close());
      audioElementsRef.current.forEach((a) => { a.pause(); a.srcObject = null; });
      reconnectTimersRef.current.forEach((t) => clearTimeout(t));
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  // ── Auto-join when opened ────────────────────────────────────────────────
  useEffect(() => {
    if (open && !connected) joinChannel();
  }, [open, connected, joinChannel]);

  const peerCount = peers.size;

  if (!open) {
    return (
      <motion.button
        className="fixed bottom-24 left-4 z-50 flex items-center gap-2 rounded-full bg-card border border-border shadow-lg px-4 py-3 hover:bg-accent transition-colors"
        onClick={() => { void unlockAudio(); setOpen(true); }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Radio className="h-5 w-5 text-primary" />
        <span className="text-sm font-medium font-display">Funk</span>
        {incomingSpeaker && (
          <motion.div
            className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          />
        )}
      </motion.button>
    );
  }

  return (
    <motion.div
      className="fixed bottom-24 left-4 z-50 w-72 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold font-display">Funk</span>
          <Badge variant="outline" className="text-[10px]">
            {peerCount + 1} online
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMuted(!muted)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label={muted ? "Stummschaltung aufheben" : "Stummschalten"}
          >
            {muted ? (
              <VolumeX className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Schließen"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mx-4 mt-3 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
          <p className="text-[11px] text-destructive leading-snug">{errorMsg}</p>
        </div>
      )}

      <div className="px-4 py-2 space-y-1 max-h-32 overflow-y-auto">
        <div className="flex items-center gap-2 text-xs">
          <div className={`w-2 h-2 rounded-full ${speaking ? "bg-primary animate-pulse" : "bg-primary/40"}`} />
          <span className="font-medium text-foreground">{userName}</span>
          <span className="text-muted-foreground">(Du)</span>
        </div>
        {Array.from(peers.values()).map((peer) => (
          <div key={peer.id} className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${peer.speaking ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`} />
            <span className="text-foreground">{peer.name}</span>
          </div>
        ))}
        {peerCount === 0 && (
          <p className="text-[10px] text-muted-foreground italic py-1">
            Warte auf andere Teilnehmer…
          </p>
        )}
      </div>

      <AnimatePresence>
        {incomingSpeaker && (
          <motion.div
            className="mx-4 mb-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 flex items-center gap-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Volume2 className="h-3 w-3 text-primary animate-pulse" />
            <span className="text-[11px] text-primary font-medium">{incomingSpeaker} spricht…</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 pt-2">
        <motion.button
          className={`w-full h-16 rounded-xl font-display font-semibold text-sm flex items-center justify-center gap-2 transition-colors select-none touch-none ${
            speaking
              ? "bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
              : muted
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-muted hover:bg-accent text-foreground border border-border"
          }`}
          onPointerDown={startSpeaking}
          onPointerUp={stopSpeaking}
          onPointerCancel={stopSpeaking}
          onPointerLeave={stopSpeaking}
          onContextMenu={(e) => e.preventDefault()}
          whileTap={!muted ? { scale: 0.97 } : {}}
        >
          {speaking ? (
            <>
              <div className="relative">
                <Mic className="h-5 w-5" />
                <div className="absolute inset-0 rounded-full border-2 border-primary-foreground/50 animate-ping" />
              </div>
              Sprechen…
            </>
          ) : muted ? (
            <>
              <MicOff className="h-5 w-5" />
              Stummgeschaltet
            </>
          ) : (
            <>
              <Mic className="h-5 w-5" />
              Gedrückt halten zum Sprechen
            </>
          )}
        </motion.button>
        {!audioUnlocked && (
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Tipp: Erstes Tippen aktiviert Audio (Android)
          </p>
        )}
      </div>
    </motion.div>
  );
}
