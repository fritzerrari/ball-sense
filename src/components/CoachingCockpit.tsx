import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mic, Target, Shield, Zap, Heart, Brain, Volume2, Square,
  Sparkles, Loader2, RefreshCw, ClipboardCopy, Flame, Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface CoachingCockpitProps {
  matchId: string;
  defaultMoment?: "halftime" | "fulltime";
}

interface KeyMessage {
  icon: "target" | "shield" | "zap" | "heart" | "brain";
  title: string;
  detail: string;
}
interface PlayerCallout {
  player_name: string;
  type: "praise" | "challenge" | "tactical" | "rest";
  message: string;
}
interface AddressData {
  headline: string;
  mood: "fired_up" | "focused" | "concerned" | "celebratory" | "regroup";
  key_messages: KeyMessage[];
  player_callouts: PlayerCallout[];
  tactical_adjustment: { title: string; why: string };
  speech_script: string;
}

const ICONS = { target: Target, shield: Shield, zap: Zap, heart: Heart, brain: Brain } as const;

const MOOD_STYLES: Record<AddressData["mood"], { label: string; bg: string; text: string; icon: typeof Flame }> = {
  fired_up: { label: "Feuer entfachen", bg: "bg-orange-500/15 border-orange-500/30", text: "text-orange-400", icon: Flame },
  focused: { label: "Fokus halten", bg: "bg-primary/15 border-primary/30", text: "text-primary", icon: Target },
  concerned: { label: "Wachrütteln", bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400", icon: Activity },
  celebratory: { label: "Feiern & wachhalten", bg: "bg-emerald-500/15 border-emerald-500/30", text: "text-emerald-400", icon: Sparkles },
  regroup: { label: "Neu sammeln", bg: "bg-blue-500/15 border-blue-500/30", text: "text-blue-400", icon: Brain },
};

const CALLOUT_STYLES: Record<PlayerCallout["type"], { label: string; cls: string }> = {
  praise: { label: "Lob", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  challenge: { label: "Forderung", cls: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  tactical: { label: "Taktisch", cls: "bg-primary/10 text-primary border-primary/30" },
  rest: { label: "Schonen", cls: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
};

export default function CoachingCockpit({ matchId, defaultMoment = "halftime" }: CoachingCockpitProps) {
  const [moment, setMoment] = useState<"halftime" | "fulltime">(defaultMoment);
  const [tone, setTone] = useState<"motivational" | "analytical" | "calm">("motivational");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AddressData | null>(null);
  const [score, setScore] = useState<{ home: number; away: number; opponent: string } | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const generate = async () => {
    setLoading(true);
    setData(null);
    try {
      const { data: resp, error } = await supabase.functions.invoke("coaching-cockpit", {
        body: { match_id: matchId, moment, tone },
      });
      if (error) throw error;
      if (resp?.error) throw new Error(resp.error);
      setData(resp.address);
      setScore(resp.score);
      toast.success("Ansprache erstellt");
    } catch (e: any) {
      toast.error(e.message ?? "Fehler beim Generieren");
    } finally {
      setLoading(false);
    }
  };

  const speak = () => {
    if (!data?.speech_script) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(data.speech_script);
    u.lang = "de-DE";
    u.rate = 0.95;
    u.pitch = 1.0;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };

  const copy = async () => {
    if (!data) return;
    const text = `${data.headline}\n\n${data.speech_script}\n\n— Kernbotschaften —\n${data.key_messages
      .map((m, i) => `${i + 1}. ${m.title}: ${m.detail}`)
      .join("\n")}\n\nTaktik: ${data.tactical_adjustment.title} – ${data.tactical_adjustment.why}`;
    await navigator.clipboard.writeText(text);
    toast.success("In Zwischenablage kopiert");
  };

  const MoodIcon = data ? MOOD_STYLES[data.mood].icon : Mic;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
            <Mic className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold font-display leading-tight">Coaching-Cockpit</h2>
            <p className="text-[10px] text-muted-foreground">KI-Kabinen-Ansprache</p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5">
          <Sparkles className="h-3 w-3" /> KI-generiert
        </Badge>
      </div>

      {/* Controls */}
      <Card className="p-3 space-y-3 bg-gradient-to-br from-card to-card/50 border-border/60">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Zeitpunkt</label>
            <Tabs value={moment} onValueChange={(v) => setMoment(v as any)}>
              <TabsList className="grid grid-cols-2 w-full h-8">
                <TabsTrigger value="halftime" className="text-xs">Halbzeit</TabsTrigger>
                <TabsTrigger value="fulltime" className="text-xs">Vollzeit</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Tonalität</label>
            <Tabs value={tone} onValueChange={(v) => setTone(v as any)}>
              <TabsList className="grid grid-cols-3 w-full h-8">
                <TabsTrigger value="motivational" className="text-[11px]">🔥 Motivierend</TabsTrigger>
                <TabsTrigger value="analytical" className="text-[11px]">🧠 Analytisch</TabsTrigger>
                <TabsTrigger value="calm" className="text-[11px]">🌊 Ruhig</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <Button onClick={generate} disabled={loading} className="w-full gap-2" size="sm">
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> KI denkt nach…</>
          ) : data ? (
            <><RefreshCw className="h-4 w-4" /> Neu generieren</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Ansprache erstellen</>
          )}
        </Button>
      </Card>

      {/* Empty state */}
      {!data && !loading && (
        <Card className="p-6 text-center border-dashed border-border/60">
          <Mic className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Wähle Zeitpunkt & Tonalität und lass die KI eine maßgeschneiderte Kabinen-Ansprache erstellen.
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-2">
            Basierend auf realen Spielereignissen, Spieler-Performance und Spielstand.
          </p>
        </Card>
      )}

      {/* Result */}
      <AnimatePresence mode="wait">
        {data && (
          <motion.div
            key={data.headline}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {/* Headline + mood */}
            <Card className={`p-4 border ${MOOD_STYLES[data.mood].bg} backdrop-blur-sm`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold ${MOOD_STYLES[data.mood].text} mb-1`}>
                    <MoodIcon className="h-3 w-3" />
                    {MOOD_STYLES[data.mood].label}
                  </div>
                  <h3 className="font-display font-bold text-lg leading-tight">{data.headline}</h3>
                  {score && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Stand: <span className="font-semibold text-foreground">{score.home}:{score.away}</span> gegen {score.opponent}
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Speech script + actions */}
            <Card className="p-4 bg-card/80 border-border/60">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  <Volume2 className="h-3 w-3" /> Vorlese-Skript
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copy}>
                    <ClipboardCopy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant={speaking ? "destructive" : "default"}
                    className="h-7 gap-1"
                    onClick={speak}
                  >
                    {speaking ? (<><Square className="h-3.5 w-3.5" /> Stop</>) : (<><Volume2 className="h-3.5 w-3.5" /> Vorlesen</>)}
                  </Button>
                </div>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
                {data.speech_script}
              </p>
            </Card>

            {/* Key messages */}
            <div className="grid sm:grid-cols-3 gap-2">
              {data.key_messages.map((m, i) => {
                const Icon = ICONS[m.icon] ?? Target;
                return (
                  <Card key={i} className="p-3 bg-card/60 border-border/50 hover:border-primary/30 transition-colors">
                    <div className="flex items-start gap-2">
                      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                          Botschaft {i + 1}
                        </div>
                        <h4 className="font-semibold text-sm leading-tight mt-0.5">{m.title}</h4>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{m.detail}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Tactical adjustment */}
            <Card className="p-3 bg-primary/5 border-primary/20">
              <div className="flex items-start gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Brain className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-primary font-semibold">Taktische Anpassung</div>
                  <div className="font-semibold text-sm mt-0.5">{data.tactical_adjustment.title}</div>
                  <p className="text-[11px] text-muted-foreground mt-1">{data.tactical_adjustment.why}</p>
                </div>
              </div>
            </Card>

            {/* Player callouts */}
            {data.player_callouts.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-1">
                  Direkte Spieler-Ansprachen
                </div>
                <div className="space-y-1.5">
                  {data.player_callouts.map((p, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${CALLOUT_STYLES[p.type].cls}`}
                    >
                      <Badge variant="outline" className="shrink-0 text-[9px] uppercase font-bold border-current">
                        {CALLOUT_STYLES[p.type].label}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-xs">{p.player_name}</div>
                        <p className="text-[11px] opacity-90 mt-0.5">{p.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
