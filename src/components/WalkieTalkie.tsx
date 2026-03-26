import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Radio, Volume2, VolumeX, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  matchId: string;
  userId: string;
  userName: string;
}

interface Peer {
  id: string;
  name: string;
  speaking: boolean;
  connection?: RTCPeerConnection;
}

export default function WalkieTalkie({ matchId, userId, userName }: Props) {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [connected, setConnected] = useState(false);
  const [incomingSpeaker, setIncomingSpeaker] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const connectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);

  const rtcConfig: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  // Join channel and announce presence
  const joinChannel = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      // Mute by default — only transmit on PTT
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
        .on("presence", { event: "join" }, ({ key, newPresences }) => {
          if (key !== userId) {
            // New peer joined — initiate WebRTC connection
            createOffer(key);
          }
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
          }
        });

      channelRef.current = channel;
    } catch {
      // Mic access denied
    }
  }, [matchId, userId, userName]);

  // Create WebRTC offer for a peer
  const createOffer = useCallback(async (peerId: string) => {
    const pc = new RTCPeerConnection(rtcConfig);
    connectionsRef.current.set(peerId, pc);

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.ontrack = (event) => {
      const audio = new Audio();
      audio.srcObject = event.streams[0];
      audio.play().catch(() => {});
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current?.send({
          type: "broadcast",
          event: "signal",
          payload: {
            from: userId,
            target: peerId,
            type: "ice",
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    channelRef.current?.send({
      type: "broadcast",
      event: "signal",
      payload: {
        from: userId,
        target: peerId,
        type: "offer",
        sdp: offer.sdp,
      },
    });
  }, [userId]);

  // Handle incoming WebRTC signals
  const handleSignal = useCallback(async (payload: any) => {
    const { from, type } = payload;

    if (type === "offer") {
      const pc = new RTCPeerConnection(rtcConfig);
      connectionsRef.current.set(from, pc);

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.ontrack = (event) => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play().catch(() => {});
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channelRef.current?.send({
            type: "broadcast",
            event: "signal",
            payload: {
              from: userId,
              target: from,
              type: "ice",
              candidate: event.candidate.toJSON(),
            },
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: payload.sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      channelRef.current?.send({
        type: "broadcast",
        event: "signal",
        payload: {
          from: userId,
          target: from,
          type: "answer",
          sdp: answer.sdp,
        },
      });
    } else if (type === "answer") {
      const pc = connectionsRef.current.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: payload.sdp }));
      }
    } else if (type === "ice") {
      const pc = connectionsRef.current.get(from);
      if (pc && payload.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    }
  }, [userId]);

  // Push-to-Talk: hold to speak
  const startSpeaking = useCallback(() => {
    if (muted) return;
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = true));
    setSpeaking(true);
    if (navigator.vibrate) navigator.vibrate(30);
    channelRef.current?.send({
      type: "broadcast",
      event: "speaking",
      payload: { userId, name: userName, speaking: true },
    });
  }, [muted, userId, userName]);

  const stopSpeaking = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
    setSpeaking(false);
    channelRef.current?.send({
      type: "broadcast",
      event: "speaking",
      payload: { userId, name: userName, speaking: false },
    });
  }, [userId, userName]);

  // Cleanup
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      connectionsRef.current.forEach((pc) => pc.close());
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  // Auto-join when opened
  useEffect(() => {
    if (open && !connected) {
      joinChannel();
    }
  }, [open, connected, joinChannel]);

  const peerCount = peers.size;

  // Floating trigger button
  if (!open) {
    return (
      <motion.button
        className="fixed bottom-24 left-4 z-50 flex items-center gap-2 rounded-full bg-card border border-border shadow-lg px-4 py-3 hover:bg-accent transition-colors"
        onClick={() => setOpen(true)}
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
      {/* Header */}
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
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Participants */}
      <div className="px-4 py-2 space-y-1 max-h-32 overflow-y-auto">
        {/* Self */}
        <div className="flex items-center gap-2 text-xs">
          <div className={`w-2 h-2 rounded-full ${speaking ? "bg-primary animate-pulse" : "bg-primary/40"}`} />
          <span className="font-medium text-foreground">{userName}</span>
          <span className="text-muted-foreground">(Du)</span>
        </div>
        {/* Peers */}
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

      {/* Incoming speaker indicator */}
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

      {/* Push-to-Talk button */}
      <div className="p-4 pt-2">
        <motion.button
          className={`w-full h-16 rounded-xl font-display font-semibold text-sm flex items-center justify-center gap-2 transition-colors select-none ${
            speaking
              ? "bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
              : muted
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-muted hover:bg-accent text-foreground border border-border"
          }`}
          onPointerDown={startSpeaking}
          onPointerUp={stopSpeaking}
          onPointerLeave={stopSpeaking}
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
      </div>
    </motion.div>
  );
}
