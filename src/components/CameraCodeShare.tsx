import { useState, useCallback } from "react";
import { Copy, Check, MessageCircle, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

interface CameraCodeShareProps {
  matchId: string;
  onDone: () => void;
}

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateCode(): string {
  const arr = new Uint8Array(3);
  crypto.getRandomValues(arr);
  return String(arr[0] * 10000 + arr[1] * 100 + arr[2]).padStart(6, "0").slice(-6);
}

export default function CameraCodeShare({ matchId, onDone }: CameraCodeShareProps) {
  const { clubId, session } = useAuth();
  const [codes, setCodes] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const generateNewCode = useCallback(async () => {
    if (!clubId || !session?.user?.id) return;
    if (codes.length >= 3) {
      toast.error("Maximal 3 Kameras gleichzeitig");
      return;
    }

    setGenerating(true);
    try {
      const code = generateCode();
      const codeHash = await sha256Hex(code);

      // If club already has 3 active codes, deactivate the oldest
      const { data: existing } = await supabase
        .from("camera_access_codes")
        .select("id")
        .eq("club_id", clubId)
        .eq("active", true)
        .order("created_at", { ascending: true });

      if (existing && existing.length >= 3) {
        await supabase
          .from("camera_access_codes")
          .update({ active: false })
          .eq("id", existing[0].id);
      }

      const { error } = await supabase.from("camera_access_codes").insert({
        club_id: clubId,
        code_hash: codeHash,
        created_by_user_id: session.user.id,
        label: `Kamera ${codes.length + 1} — Spiel`,
        active: true,
      });

      if (error) throw error;

      setCodes(prev => [...prev, code]);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      toast.success(`Code für Kamera ${codes.length + 1} erstellt!`);
    } catch (err: any) {
      toast.error(err.message ?? "Code konnte nicht erstellt werden");
    } finally {
      setGenerating(false);
    }
  }, [clubId, session, codes.length]);

  // Auto-generate first code on mount
  useState(() => {
    generateNewCode();
  });

  const copyCode = useCallback(async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      if (navigator.vibrate) navigator.vibrate(20);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  }, []);

  const shareWhatsApp = useCallback((code: string) => {
    const text = `🎥 FieldIQ Kamera-Code: ${code}\n\nÖffne die FieldIQ App und gib diesen Code ein, um die Kamera zu starten.\n\nhttps://ball-sense.lovable.app/camera`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }, []);

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-bold font-display">Kamera-Code</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sende den Code an deinen Helfer
        </p>
      </div>

      {codes.map((code, i) => (
        <div key={i} className="glass-card p-5 space-y-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Kamera {i + 1}</p>
            <p className="text-4xl font-black font-mono tracking-[0.3em] text-primary">
              {code.slice(0, 3)} {code.slice(3)}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => copyCode(code, i)}
              variant="outline"
              className="flex-1 h-12 gap-2"
            >
              {copiedIndex === i ? (
                <><Check className="h-4 w-4 text-primary" /> Kopiert!</>
              ) : (
                <><Copy className="h-4 w-4" /> Kopieren</>
              )}
            </Button>
            <Button
              onClick={() => shareWhatsApp(code)}
              variant="outline"
              className="flex-1 h-12 gap-2"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
          </div>
        </div>
      ))}

      {/* Instructions */}
      <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
        <p className="text-sm font-medium mb-2">So geht's für deinen Helfer:</p>
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>FieldIQ im Browser öffnen (ball-sense.lovable.app/camera)</li>
          <li>Den 6-stelligen Code eingeben</li>
          <li>Kamera-Tipps lesen und Aufnahme starten</li>
        </ol>
      </div>

      {/* Add more cameras */}
      {codes.length < 3 && (
        <Button
          onClick={generateNewCode}
          variant="outline"
          disabled={generating}
          className="w-full h-12 gap-2"
        >
          <Plus className="h-4 w-4" />
          Weiteren Code erzeugen (Kamera {codes.length + 1})
        </Button>
      )}

      <Button onClick={onDone} size="lg" className="w-full h-14 text-base gap-2">
        <ArrowRight className="h-5 w-5" /> Fertig
      </Button>
    </div>
  );
}
