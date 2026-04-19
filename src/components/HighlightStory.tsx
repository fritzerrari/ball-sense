import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Film, Loader2, Volume2, VolumeX, Sparkles, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Scene {
  timestamp_sec: number;
  title: string;
  narration: string;
  tag: string;
  minute?: number;
}
interface Story {
  headline: string;
  duration_sec: number;
  scenes: Scene[];
  cta: string;
}

interface Props {
  matchId: string;
}

const TONE_OPTIONS = [
  { value: "motivational", label: "Mitreißend" },
  { value: "analytical", label: "Analytisch" },
  { value: "calm", label: "Würdigend" },
];

export default function HighlightStory({ matchId }: Props) {
  const [tone, setTone] = useState<"motivational" | "analytical" | "calm">("analytical");
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeScene, setActiveScene] = useState<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setStory(null);
    try {
      const { data, error } = await supabase.functions.invoke("highlight-story", {
        body: { matchId, tone },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStory(data.story);
      toast.success("Story generiert.");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Generierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  const speak = (text: string, idx?: number) => {
    if (!("speechSynthesis" in window)) {
      toast.error("Sprachausgabe nicht unterstützt.");
      return;
    }
    window.speechSynthesis.cancel();
    if (idx !== undefined) setActiveScene(idx);
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "de-DE";
    utter.rate = 1.0;
    utter.onend = () => {
      setSpeaking(false);
      setActiveScene(null);
    };
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

  const speakAll = () => {
    if (!story) return;
    const full = `${story.headline}. ${story.scenes.map((s) => s.narration).join(" ")} ${story.cta}`;
    speak(full);
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setActiveScene(null);
  };

  const copyScript = async () => {
    if (!story) return;
    const txt = `${story.headline}\n\n${story.scenes
      .map((s, i) => `[${i + 1}] ${formatTs(s.timestamp_sec)} – ${s.title}\n${s.narration}`)
      .join("\n\n")}\n\nCTA: ${story.cta}`;
    await navigator.clipboard.writeText(txt);
    setCopied(true);
    toast.success("Skript kopiert.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Film className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold font-display text-sm">Auto-Highlight-Story</h3>
              <p className="text-xs text-muted-foreground">90-Sek-Voice-Over-Skript für dein Reel.</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] self-start">
            <Sparkles className="h-3 w-3 mr-1" />KI
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TONE_OPTIONS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTone(t.value as any)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                tone === t.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 bg-card/40 text-muted-foreground hover:border-primary/40"
              }`}
            >
              {t.label}
            </button>
          ))}
          <Button onClick={generate} disabled={loading} size="sm" className="ml-auto">
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
            {story ? "Neu generieren" : "Story erzeugen"}
          </Button>
        </div>

        {story && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-primary">Reel-Titel</p>
                <p className="font-display font-semibold text-sm">{story.headline}</p>
              </div>
              <div className="flex gap-1">
                <Button onClick={speaking ? stop : speakAll} size="sm" variant="outline">
                  {speaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                </Button>
                <Button onClick={copyScript} size="sm" variant="outline">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            <div className="relative pl-6 space-y-3">
              <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-primary via-accent to-primary/40" />
              {story.scenes.map((scene, i) => (
                <div
                  key={i}
                  className={`relative rounded-xl border p-3 transition-colors ${
                    activeScene === i
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-card/60 hover:border-primary/40"
                  }`}
                >
                  <div className="absolute -left-[1.1rem] top-3 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {formatTs(scene.timestamp_sec)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">{scene.tag}</Badge>
                      {scene.minute !== undefined && (
                        <span className="text-[10px] text-muted-foreground">Min {scene.minute}'</span>
                      )}
                    </div>
                    <Button
                      onClick={() => speak(scene.narration, i)}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                    >
                      <Volume2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs font-semibold mb-1">{scene.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{scene.narration}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
              <p className="text-[10px] uppercase tracking-widest text-accent-foreground/80">Call-to-Action</p>
              <p className="text-xs mt-1">{story.cta}</p>
            </div>
          </div>
        )}

        {!story && !loading && (
          <p className="text-xs text-muted-foreground text-center py-6">
            Wähle eine Tonalität und generiere die Story für dein Highlight-Video.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function formatTs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
