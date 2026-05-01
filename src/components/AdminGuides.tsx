import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import {
  Plus, Trash2, Save, Loader2, Sparkles, BookOpen, GripVertical,
  ChevronDown, ChevronUp, Image as ImageIcon,
} from "lucide-react";
import AdminHandbookDownload from "./AdminHandbookDownload";

interface GuideChapter {
  title: string;
  text: string;
  image_url?: string;
}

interface DeviceGuide {
  id: string;
  brand: string;
  model: string;
  guide_chapters: GuideChapter[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminGuides() {
  const qc = useQueryClient();
  const [editingGuide, setEditingGuide] = useState<DeviceGuide | null>(null);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [chapters, setChapters] = useState<GuideChapter[]>([]);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: guides = [], isLoading } = useQuery({
    queryKey: ["admin_guides"],
    queryFn: async () => {
      const { data } = await supabase
        .from("device_guides")
        .select("*")
        .order("brand");
      return (data ?? []) as unknown as DeviceGuide[];
    },
  });

  const resetForm = () => {
    setEditingGuide(null);
    setBrand("");
    setModel("");
    setChapters([]);
    setActive(true);
  };

  const startEdit = (guide: DeviceGuide) => {
    setEditingGuide(guide);
    setBrand(guide.brand);
    setModel(guide.model);
    setChapters(Array.isArray(guide.guide_chapters) ? guide.guide_chapters : []);
    setActive(guide.active);
  };

  const addChapter = () => {
    setChapters([...chapters, { title: "", text: "", image_url: "" }]);
  };

  const updateChapter = (idx: number, field: keyof GuideChapter, value: string) => {
    const updated = [...chapters];
    updated[idx] = { ...updated[idx], [field]: value };
    setChapters(updated);
  };

  const removeChapter = (idx: number) => {
    setChapters(chapters.filter((_, i) => i !== idx));
  };

  const moveChapter = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= chapters.length) return;
    const updated = [...chapters];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setChapters(updated);
  };

  const handleImageUpload = async (idx: number, file: File) => {
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("guide-images").upload(path, file);
    if (error) {
      toast.error("Bild-Upload fehlgeschlagen");
      return;
    }
    const { data: urlData } = supabase.storage.from("guide-images").getPublicUrl(path);
    updateChapter(idx, "image_url", urlData.publicUrl);
    toast.success("Bild hochgeladen");
  };

  const saveGuide = async () => {
    if (!brand.trim() || !model.trim()) {
      toast.error("Marke und Modell erforderlich");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        brand: brand.trim(),
        model: model.trim(),
        guide_chapters: chapters as any,
        active,
        updated_at: new Date().toISOString(),
      };

      if (editingGuide) {
        const { error } = await supabase
          .from("device_guides")
          .update(payload)
          .eq("id", editingGuide.id);
        if (error) throw error;
        toast.success("Anleitung aktualisiert");
      } else {
        const { error } = await supabase
          .from("device_guides")
          .insert(payload);
        if (error) throw error;
        toast.success("Anleitung erstellt");
      }
      qc.invalidateQueries({ queryKey: ["admin_guides"] });
      resetForm();
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const deleteGuide = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("device_guides").delete().eq("id", deleteId);
    if (error) {
      toast.error("Fehler beim Löschen");
    } else {
      toast.success("Anleitung gelöscht");
      qc.invalidateQueries({ queryKey: ["admin_guides"] });
      if (editingGuide?.id === deleteId) resetForm();
    }
    setDeleteId(null);
  };

  const generateGuide = async () => {
    if (!brand.trim() || !model.trim()) {
      toast.error("Bitte erst Marke und Modell eingeben");
      return;
    }
    setGenerating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.session?.access_token}`,
          },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: `Erstelle eine Installationsanleitung für FieldIQ auf einem ${brand} ${model}. 
Die Anleitung soll 5 Kapitel haben:
1. App installieren (PWA zum Homescreen)
2. Kamera-Zugriff erlauben
3. Smartphones positionieren
4. Tracking starten
5. Nach dem Spiel

Gib die Anleitung als JSON-Array zurück mit dem Format:
[{"title": "...", "text": "..."}, ...]

Schreibe die Anleitung spezifisch für das Gerät ${brand} ${model}. Nutze gerätespezifische Menüpfade und Screenshots-Beschreibungen.
Antworte NUR mit dem JSON-Array, kein anderer Text.`,
              },
            ],
            includeContext: false,
          }),
        }
      );

      if (!response.ok) throw new Error("AI request failed");

      // Read streamed response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
            try {
              const parsed = JSON.parse(line.slice(6));
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullText += content;
            } catch {}
          }
        }
      }

      // Extract JSON array from response
      const jsonMatch = fullText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as GuideChapter[];
        setChapters(parsed);
        toast.success("Anleitung generiert!");
      } else {
        toast.error("KI-Antwort konnte nicht verarbeitet werden");
      }
    } catch {
      toast.error("Fehler bei der KI-Generierung");
    } finally {
      setGenerating(false);
    }
  };

  const toggleActive = async (guide: DeviceGuide) => {
    const { error } = await supabase
      .from("device_guides")
      .update({ active: !guide.active })
      .eq("id", guide.id);
    if (error) {
      toast.error("Fehler beim Aktualisieren");
    } else {
      qc.invalidateQueries({ queryKey: ["admin_guides"] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Guide list */}
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Marke</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Modell</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Kapitel</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Aktiv</th>
              <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {guides.map((g) => (
              <tr key={g.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="py-3 px-4 font-medium">{g.brand}</td>
                <td className="py-3 px-4 text-muted-foreground">{g.model}</td>
                <td className="py-3 px-4">
                  <Badge variant="secondary" className="text-[10px]">
                    {Array.isArray(g.guide_chapters) ? g.guide_chapters.length : 0} Kapitel
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <Switch checked={g.active} onCheckedChange={() => toggleActive(g)} />
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(g)} className="text-xs h-7">
                      Bearbeiten
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(g.id)} className="text-xs h-7 text-destructive hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {guides.length === 0 && !isLoading && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Noch keine Anleitungen erstellt
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="glass-card p-6 space-y-5">
        <h3 className="text-sm font-semibold font-display flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          {editingGuide ? "Anleitung bearbeiten" : "Neue Anleitung"}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Marke</label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="z.B. Samsung" className="text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Modell</label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="z.B. Galaxy S24" className="text-sm" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <span className="text-xs text-muted-foreground">Aktiv (öffentlich sichtbar)</span>
          </div>
          <Button variant="outline" size="sm" onClick={generateGuide} disabled={generating} className="text-xs">
            {generating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Anleitung generieren
          </Button>
        </div>

        {/* Chapters */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Kapitel ({chapters.length})</span>
            <Button variant="outline" size="sm" onClick={addChapter} className="text-xs h-7">
              <Plus className="h-3 w-3 mr-1" /> Kapitel hinzufügen
            </Button>
          </div>

          {chapters.map((ch, i) => (
            <div key={i} className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Kapitel {i + 1}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => moveChapter(i, -1)} disabled={i === 0} className="h-6 w-6 p-0">
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => moveChapter(i, 1)} disabled={i === chapters.length - 1} className="h-6 w-6 p-0">
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeChapter(i)} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <Input
                value={ch.title}
                onChange={(e) => updateChapter(i, "title", e.target.value)}
                placeholder="Kapiteltitel"
                className="text-sm"
              />
              <Textarea
                value={ch.text}
                onChange={(e) => updateChapter(i, "text", e.target.value)}
                placeholder="Kapiteltext..."
                rows={4}
                className="text-sm"
              />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Bild hochladen
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(i, file);
                    }}
                  />
                </label>
                {ch.image_url && (
                  <div className="flex items-center gap-2">
                    <img src={ch.image_url} alt="" className="h-8 w-8 rounded object-cover border border-border" />
                    <button
                      onClick={() => updateChapter(i, "image_url", "")}
                      className="text-[10px] text-destructive hover:underline"
                    >
                      Entfernen
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button variant="hero" size="sm" onClick={saveGuide} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
            {editingGuide ? "Aktualisieren" : "Erstellen"}
          </Button>
          {editingGuide && (
            <Button variant="outline" size="sm" onClick={resetForm}>
              Abbrechen
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Anleitung löschen?"
        description="Diese Anleitung wird dauerhaft gelöscht."
        onConfirm={deleteGuide}
      />
    </div>
  );
}
