import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Film, Loader2, Sparkles, Square, Smartphone, Monitor, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Scene {
  type: "intro" | "scene" | "outro";
  duration_sec: number;
  minute?: number;
  team?: string;
  caption?: string;
  headline?: string;
  subline?: string;
  cta?: string;
  player_name?: string;
  clip_url?: string | null;
  event_type?: string;
}
interface Storyboard {
  meta: {
    score: string;
    opponent: string;
    date: string;
    club_logo: string | null;
    club_name: string;
    duration_sec: number;
    format: string;
  };
  intro: Scene;
  scenes: Scene[];
  outro: Scene;
}

const FORMATS = [
  { value: "square", label: "1:1 Square", icon: Square, w: 240, h: 240 },
  { value: "portrait", label: "9:16 Reels/Story", icon: Smartphone, w: 180, h: 320 },
  { value: "landscape", label: "16:9 YouTube", icon: Monitor, w: 320, h: 180 },
] as const;

interface Props {
  matchId: string;
}

export default function HighlightReelGenerator({ matchId }: Props) {
  const [format, setFormat] = useState<"square" | "portrait" | "landscape">("square");
  const [duration, setDuration] = useState(60);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setStoryboard(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-highlight-reel", {
        body: { match_id: matchId, format, duration_sec: duration },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStoryboard(data.storyboard);
      setActiveIdx(0);
      toast.success("Reel-Storyboard erstellt!");
    } catch (e: any) {
      toast.error(e?.message ?? "Generierung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const allScenes: Scene[] = storyboard
    ? [storyboard.intro, ...storyboard.scenes, storyboard.outro]
    : [];
  const active = allScenes[activeIdx];
  const fmt = FORMATS.find((f) => f.value === format)!;

  const copyCaptions = async () => {
    if (!storyboard) return;
    const text = [
      `🎬 ${storyboard.meta.club_name} ${storyboard.meta.score} ${storyboard.meta.opponent}`,
      "",
      ...storyboard.scenes.map((s) => `${s.minute}' — ${s.caption}`),
      "",
      storyboard.outro.cta ?? "",
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("In Zwischenablage kopiert");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-primary" />
            <h3 className="font-semibold font-display text-sm">Auto-Highlight-Reel</h3>
          </div>
          <Badge variant="outline" className="text-[10px]">Branded</Badge>
        </div>

        {/* Settings */}
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setFormat(value)}
                className={`rounded-lg border p-2 text-xs transition-all ${
                  format === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted hover:border-primary/40"
                }`}
              >
                <Icon className="h-4 w-4 mx-auto mb-1" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Länge:</label>
            <input
              type="range" min={20} max={90} step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs font-mono w-10 text-right">{duration}s</span>
          </div>
          <Button onClick={generate} disabled={loading} className="w-full gap-2 h-10">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Reel generieren
          </Button>
        </div>

        {/* Preview */}
        {storyboard && active && (
          <div className="space-y-3">
            <div className="flex justify-center">
              <motion.div
                key={activeIdx}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative overflow-hidden rounded-xl border-2 border-primary/30 bg-gradient-to-br from-emerald-950 to-teal-950"
                style={{ width: fmt.w, height: fmt.h }}
              >
                {storyboard.meta.club_logo && (
                  <img
                    src={storyboard.meta.club_logo}
                    alt=""
                    className="absolute top-2 right-2 h-8 w-8 object-contain opacity-90"
                  />
                )}
                {active.type === "intro" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3">
                    <p className="font-display font-bold text-white text-base leading-tight">{active.headline}</p>
                    <p className="text-[10px] text-emerald-300/80 mt-2">{active.subline}</p>
                  </div>
                )}
                {active.type === "scene" && (
                  <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                    <p className="font-display font-bold text-white text-sm leading-tight">{active.caption}</p>
                    {active.player_name && (
                      <p className="text-[10px] text-emerald-300 mt-1">{active.player_name}</p>
                    )}
                  </div>
                )}
                {active.type === "outro" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3">
                    <p className="font-display font-bold text-white text-sm">{active.cta}</p>
                  </div>
                )}
                <div className="absolute bottom-1 left-1 text-[9px] font-mono text-white/70">
                  {storyboard.meta.club_name}
                </div>
              </motion.div>
            </div>

            {/* Timeline */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {allScenes.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={`shrink-0 rounded-md border px-2 py-1 text-[10px] transition-all ${
                    i === activeIdx ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted"
                  }`}
                >
                  {s.type === "intro" ? "Intro" : s.type === "outro" ? "Outro" : `${s.minute}'`}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={copyCaptions} size="sm" variant="outline" className="gap-1 flex-1">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                Captions kopieren
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              Speichere Reel-Daten direkt — Video-Render erfolgt clientseitig oder via Drittanbieter (z.B. Remotion).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
