import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Send, Loader2, Sparkles, Zap, Target, Users, BarChart3, Trash2, Route, Flame, Clock, Radio, Pause, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import PitchVisualization, { getPlayerColor } from "@/components/PitchVisualization";
import PlayerRosterPanel from "@/components/PlayerRosterPanel";
import { usePlayers } from "@/hooks/use-players";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useQuery } from "@tanstack/react-query";
import { useMatches } from "@/hooks/use-matches";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

const quickActions = [
  { label: "Letztes Spiel analysieren", icon: BarChart3, message: "Analysiere unser letztes Spiel. Was lief gut, was können wir verbessern?" },
  { label: "Aufstellung empfehlen", icon: Users, message: "Basierend auf unserem Kader und den letzten Spielen: Welche Aufstellung empfiehlst du für das nächste Spiel?" },
  { label: "Taktische Empfehlung", icon: Target, message: "Gib mir eine taktische Empfehlung basierend auf unseren Stärken und Schwächen." },
  { label: "Kaderstärken", icon: Sparkles, message: "Analysiere die Stärken und Schwächen unseres Kaders. Wo sollten wir verstärken?" },
];

// Generate realistic mock movement trails for a player based on position
function generateMockTrail(position: string | null, seed: number): { x: number; y: number }[] {
  const rng = (i: number) => {
    const s = Math.sin(seed * 9301 + i * 49297) * 49297;
    return s - Math.floor(s);
  };

  // Define base zones by position
  const zones: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
    TW:  { cx: 0.06, cy: 0.5,  rx: 0.04, ry: 0.15 },
    IV:  { cx: 0.18, cy: 0.5,  rx: 0.08, ry: 0.2  },
    LIV: { cx: 0.18, cy: 0.35, rx: 0.08, ry: 0.15 },
    RIV: { cx: 0.18, cy: 0.65, rx: 0.08, ry: 0.15 },
    LV:  { cx: 0.15, cy: 0.15, rx: 0.12, ry: 0.12 },
    RV:  { cx: 0.15, cy: 0.85, rx: 0.12, ry: 0.12 },
    ZDM: { cx: 0.35, cy: 0.5,  rx: 0.1,  ry: 0.2  },
    ZM:  { cx: 0.45, cy: 0.5,  rx: 0.15, ry: 0.25 },
    LM:  { cx: 0.4,  cy: 0.2,  rx: 0.15, ry: 0.15 },
    RM:  { cx: 0.4,  cy: 0.8,  rx: 0.15, ry: 0.15 },
    ZOM: { cx: 0.6,  cy: 0.5,  rx: 0.12, ry: 0.2  },
    LA:  { cx: 0.65, cy: 0.15, rx: 0.18, ry: 0.12 },
    RA:  { cx: 0.65, cy: 0.85, rx: 0.18, ry: 0.12 },
    ST:  { cx: 0.78, cy: 0.5,  rx: 0.12, ry: 0.2  },
    HS:  { cx: 0.7,  cy: 0.5,  rx: 0.15, ry: 0.25 },
  };

  const zone = zones[position ?? "ZM"] ?? zones.ZM;
  const points: { x: number; y: number }[] = [];
  const count = 12 + Math.floor(rng(0) * 8);

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rng(i * 3) * 1.5;
    const dist = 0.3 + rng(i * 7) * 0.7;
    const x = Math.max(0.02, Math.min(0.98, zone.cx + Math.cos(angle) * zone.rx * dist));
    const y = Math.max(0.02, Math.min(0.98, zone.cy + Math.sin(angle) * zone.ry * dist));
    points.push({ x, y });
  }

  return points;
}

// Mock stats generator
function generateMockStats(position: string | null, seed: number) {
  const rng = (offset: number) => {
    const s = Math.sin(seed * 1301 + offset * 7927) * 49297;
    return s - Math.floor(s);
  };

  const isGK = position === "TW";
  const isDefender = ["IV", "LV", "RV", "LIV", "RIV"].includes(position ?? "");
  const isAttacker = ["ST", "HS", "LA", "RA"].includes(position ?? "");

  return {
    distance_km: isGK ? 4.5 + rng(1) * 2 : isDefender ? 8 + rng(2) * 3 : isAttacker ? 9 + rng(3) * 3.5 : 9.5 + rng(4) * 3,
    top_speed_kmh: isGK ? 18 + rng(5) * 8 : 25 + rng(6) * 10,
    avg_speed_kmh: isGK ? 3 + rng(7) * 2 : 6 + rng(8) * 3,
    sprint_count: isGK ? Math.floor(rng(9) * 5) : Math.floor(10 + rng(10) * 30),
    minutes_played: Math.floor(70 + rng(11) * 25),
    sprint_distance_m: isGK ? Math.floor(rng(12) * 100) : Math.floor(200 + rng(13) * 600),
  };
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [pitchMode, setPitchMode] = useState<"trails" | "heatmap">("trails");
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 1]);
  const [liveMode, setLiveMode] = useState(false);
  const [liveCountdown, setLiveCountdown] = useState(60);
  const [liveSoundEnabled, setLiveSoundEnabled] = useState(true);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveSendingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: playersRaw = [] } = usePlayers();
  const { clubId } = useAuth();
  const { data: matchesData } = useMatches();

  // Find currently live match (status = "live" or "tracking")
  const liveMatch = useMemo(() => {
    return matchesData?.find(m => m.status === "live" || m.status === "tracking") ?? null;
  }, [matchesData]);

  // Get latest match stats for players
  const { data: latestStats } = useQuery({
    queryKey: ["latest_player_stats", clubId],
    queryFn: async () => {
      if (!clubId) return {};
      // Get latest done match
      const { data: latestMatch } = await supabase
        .from("matches")
        .select("id")
        .eq("home_club_id", clubId)
        .eq("status", "done")
        .order("date", { ascending: false })
        .limit(1)
        .single();

      if (!latestMatch) return {};

      const { data: stats } = await supabase
        .from("player_match_stats")
        .select("player_id, distance_km, top_speed_kmh, avg_speed_kmh, sprint_count, sprint_distance_m, minutes_played, positions_raw")
        .eq("match_id", latestMatch.id);

      const map: Record<string, any> = {};
      stats?.forEach(s => {
        if (s.player_id) map[s.player_id] = s;
      });
      return map;
    },
    enabled: !!clubId,
  });

  // Build enriched player list
  const players = useMemo(() => {
    return playersRaw.map((p, i) => {
      const realStats = latestStats?.[p.id];
      return {
        id: p.id,
        name: p.name,
        number: p.number,
        position: p.position,
        active: p.active,
        stats: realStats ? {
          distance_km: realStats.distance_km,
          top_speed_kmh: realStats.top_speed_kmh,
          avg_speed_kmh: realStats.avg_speed_kmh,
          sprint_count: realStats.sprint_count,
          sprint_distance_m: realStats.sprint_distance_m,
          minutes_played: realStats.minutes_played,
        } : generateMockStats(p.position, i + 1),
        positionsRaw: realStats?.positions_raw ?? null,
      };
    });
  }, [playersRaw, latestStats]);

  // Color mapping for selected players
  const colorMap = useMemo(() => {
    const map = new Map<string, { color: string; index: number }>();
    let idx = 0;
    players.forEach(p => {
      if (selectedPlayerIds.has(p.id)) {
        map.set(p.id, { color: getPlayerColor(idx), index: idx });
        idx++;
      }
    });
    return map;
  }, [players, selectedPlayerIds]);

  // Build pitch data for selected players
  const pitchPlayers = useMemo(() => {
    return players
      .filter(p => selectedPlayerIds.has(p.id))
      .map((p, _i) => {
        const cm = colorMap.get(p.id);
        // Use real positions if available, else mock
        const positions = p.positionsRaw
          ? (p.positionsRaw as { x: number; y: number }[]).map(pt => ({ x: pt.x, y: pt.y }))
          : generateMockTrail(p.position, players.indexOf(p) + 1);

        return {
          id: p.id,
          name: p.name,
          number: p.number,
          color: cm?.color ?? "hsl(150, 10%, 45%)",
          positions,
          currentPos: positions[positions.length - 1],
        };
      });
  }, [players, selectedPlayerIds, colorMap]);

  // Handlers
  const togglePlayer = useCallback((id: string) => {
    setSelectedPlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedPlayerIds(new Set(players.filter(p => p.active).map(p => p.id)));
  }, [players]);

  const deselectAll = useCallback(() => {
    setSelectedPlayerIds(new Set());
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Live Mode: auto-send tactical update every 60 seconds
  useEffect(() => {
    if (!liveMode || !liveMatch) {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
      setLiveCountdown(60);
      return;
    }

    // Send initial live analysis
    if (!liveSendingRef.current) {
      sendLiveUpdate();
    }

    let count = 60;
    setLiveCountdown(60);
    liveIntervalRef.current = setInterval(() => {
      count--;
      setLiveCountdown(count);
      if (count <= 0) {
        count = 60;
        setLiveCountdown(60);
        sendLiveUpdate();
      }
    }, 1000);

    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMode, liveMatch?.id]);

  const playNotificationSound = useCallback(() => {
    if (!liveSoundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;

      // Two-tone chime
      [520, 780].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.3);
      });
    } catch { /* audio not supported */ }
  }, [liveSoundEnabled]);

  const sendLiveUpdate = async () => {
    if (liveSendingRef.current || isLoading) return;
    liveSendingRef.current = true;
    const autoMsg = `[Live-Modus] Gib eine kurze taktische Analyse und Handlungsempfehlung basierend auf den aktuellen Spielerdaten dieses laufenden Spiels. Fokussiere dich auf: Positionierung, Laufverhalten, Ermüdungszeichen und taktische Anpassungen. Maximal 4-5 Sätze.`;
    await sendMessage(autoMsg, true);
    playNotificationSound();
    liveSendingRef.current = false;
  };

  const sendMessage = async (text: string, isLiveAuto = false) => {
    if (!text.trim() || (isLoading && !isLiveAuto)) return;
    const displayContent = isLiveAuto ? `⚡ Live-Analyse (${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })})` : text.trim();
    const userMsg: Msg = { role: "user", content: displayContent };
    setMessages(prev => [...prev, userMsg]);
    if (!isLiveAuto) setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const allMessages = [...messages, userMsg];

    // Build selected players context
    const selectedContext = pitchPlayers.length > 0
      ? pitchPlayers.map(p => {
          const full = players.find(pl => pl.id === p.id);
          const s = full?.stats;
          return `- #${p.number ?? "?"} ${p.name} (${full?.position ?? "?"}): ${s?.distance_km?.toFixed(1) ?? "?"}km, Top ${s?.top_speed_kmh?.toFixed(1) ?? "?"}km/h, Ø ${s?.avg_speed_kmh?.toFixed(1) ?? "?"}km/h, ${s?.sprint_count ?? 0} Sprints, ${s?.sprint_distance_m?.toFixed(0) ?? "?"}m Sprintdistanz, ${s?.minutes_played ?? "?"}min`;
        }).join("\n")
      : null;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: text.trim() }],
          includeContext: true,
          selectedPlayersContext: selectedContext,
          liveMode: isLiveAuto,
          liveMatchId: liveMatch?.id,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Fehler" }));
        toast.error(err.error || "KI-Fehler");
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No stream body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Verbindungsfehler zum KI-Dienst");
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col xl:flex-row gap-4 h-[calc(100vh-8rem)]">

        {/* LEFT — Chat */}
        <div className="flex-1 min-w-0 flex flex-col xl:max-w-[480px] 2xl:max-w-[540px]">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <BrainCircuit className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold font-display flex items-center gap-2">
                KI Co-Trainer
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-normal whitespace-nowrap">
                  Add-on · €79/Mo
                </span>
              </h1>
            </div>
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              {/* Live Mode Toggle */}
              <button
                onClick={() => {
                  if (!liveMatch && !liveMode) {
                    toast.error("Kein laufendes Spiel gefunden. Starte zuerst ein Spiel mit Status \"live\".");
                    return;
                  }
                  setLiveMode(prev => !prev);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                  liveMode
                    ? "bg-destructive/15 text-destructive border border-destructive/30 animate-pulse"
                    : liveMatch
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 hover:bg-emerald-500/20"
                      : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                }`}
              >
                {liveMode ? <Pause className="h-3 w-3" /> : <Radio className="h-3 w-3" />}
                {liveMode ? `Live (${liveCountdown}s)` : "Live-Modus"}
              </button>
              {liveMode && (
                <button
                  onClick={() => setLiveSoundEnabled(prev => !prev)}
                  className={`p-1.5 rounded-lg text-[10px] transition-all border ${
                    liveSoundEnabled
                      ? "bg-primary/10 text-primary border-primary/25"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                  title={liveSoundEnabled ? "Sound aus" : "Sound an"}
                >
                  {liveSoundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                </button>
              )}
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => { setMessages([]); setLiveMode(false); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-5 py-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <BrainCircuit className="h-7 w-7 text-primary" />
                </div>
                <div className="text-center max-w-sm">
                  <h2 className="text-base font-semibold font-display mb-1.5">Dein KI Co-Trainer</h2>
                  <p className="text-xs text-muted-foreground">
                    Analysiere Spiele, erhalte Aufstellungsempfehlungen. Wähle rechts Spieler aus, um Laufwege und Statistiken zu sehen.
                  </p>
                </div>
                {liveMatch && (
                  <div className="w-full max-w-sm p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-center">
                    <p className="text-xs font-semibold text-emerald-600 flex items-center justify-center gap-1.5">
                      <Radio className="h-3.5 w-3.5 animate-pulse" />
                      Live-Spiel erkannt: vs {liveMatch.away_club_name || "Gegner"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Aktiviere den Live-Modus oben für automatische taktische Hinweise alle 60 Sekunden.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => sendMessage(action.message)}
                      className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all text-left group"
                    >
                      <action.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      <span className="text-xs font-medium">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-xs leading-relaxed">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-xs">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))
            )}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-card border border-border rounded-2xl px-3.5 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="mt-3 border-t border-border pt-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Frage deinen Co-Trainer..."
                className="flex-1 resize-none px-3.5 py-2.5 rounded-xl bg-muted border border-border text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                style={{ minHeight: "40px", maxHeight: "100px" }}
              />
              <Button
                variant="hero"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT — Pitch + Roster */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Pitch */}
          <div className="glass-card p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Spielfeld — {pitchMode === "trails" ? "Laufwege" : "Heatmap"}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPitchMode("trails")}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                    pitchMode === "trails"
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Route className="h-3 w-3" />
                  Laufwege
                </button>
                <button
                  onClick={() => setPitchMode("heatmap")}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                    pitchMode === "heatmap"
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Flame className="h-3 w-3" />
                  Heatmap
                </button>
                {selectedPlayerIds.size > 0 && (
                  <span className="text-[10px] text-muted-foreground ml-1">
                    {selectedPlayerIds.size} aktiv
                  </span>
                )}
              </div>
            </div>
            <PitchVisualization players={pitchPlayers} mode={pitchMode} timeRange={timeRange[0] === 0 && timeRange[1] === 1 ? undefined : timeRange} className="rounded-lg overflow-hidden" />
            
            {/* Time Range Slider */}
            {pitchMode === "heatmap" && selectedPlayerIds.size > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-medium">Spielphase</span>
                  <span className="text-[10px] text-primary font-semibold ml-auto">
                    {Math.round(timeRange[0] * 90)}' – {Math.round(timeRange[1] * 90)}'
                  </span>
                </div>
                <Slider
                  value={[timeRange[0] * 100, timeRange[1] * 100]}
                  onValueChange={(val) => setTimeRange([val[0] / 100, val[1] / 100])}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <div className="flex gap-1">
                  {[
                    { label: "Gesamt", range: [0, 1] as [number, number] },
                    { label: "1. HZ", range: [0, 0.5] as [number, number] },
                    { label: "2. HZ", range: [0.5, 1] as [number, number] },
                    { label: "Letzte 15'", range: [0.833, 1] as [number, number] },
                  ].map(preset => {
                    const active = timeRange[0] === preset.range[0] && timeRange[1] === preset.range[1];
                    return (
                      <button
                        key={preset.label}
                        onClick={() => setTimeRange(preset.range)}
                        className={`flex-1 text-[10px] font-medium py-1 rounded-md transition-all ${
                          active
                            ? "bg-primary/15 text-primary border border-primary/25"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Roster */}
          <div className="glass-card flex-1 min-h-0 overflow-hidden flex flex-col">
            <PlayerRosterPanel
              players={players}
              selectedIds={selectedPlayerIds}
              onToggle={togglePlayer}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
              colorMap={colorMap}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
