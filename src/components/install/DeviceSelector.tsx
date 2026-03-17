import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone } from "lucide-react";

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
}

export function DeviceSelector() {
  const [guides, setGuides] = useState<DeviceGuide[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [activeChapters, setActiveChapters] = useState<GuideChapter[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("device_guides")
        .select("*")
        .eq("active", true)
        .order("brand");
      const typedData = (data ?? []) as unknown as DeviceGuide[];
      setGuides(typedData);
      setBrands([...new Set(typedData.map((g) => g.brand))].sort());
    })();
  }, []);

  useEffect(() => {
    if (selectedBrand) {
      setModels(guides.filter((g) => g.brand === selectedBrand).map((g) => g.model).sort());
      setSelectedModel("");
      setActiveChapters([]);
    } else {
      setModels([]);
      setSelectedModel("");
      setActiveChapters([]);
    }
  }, [selectedBrand, guides]);

  useEffect(() => {
    if (selectedBrand && selectedModel) {
      const guide = guides.find((g) => g.brand === selectedBrand && g.model === selectedModel);
      if (guide && Array.isArray(guide.guide_chapters) && guide.guide_chapters.length > 0) {
        setActiveChapters(guide.guide_chapters as GuideChapter[]);
      } else {
        setActiveChapters([]);
      }
    }
  }, [selectedModel, selectedBrand, guides]);

  if (brands.length === 0) return null;

  return (
    <div className="glass-card p-5 space-y-4">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-primary" />
        Gerätespezifische Tipps
      </h2>
      <p className="text-xs text-muted-foreground">
        Optional: Wähle dein Gerät für zusätzliche Hinweise.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Select value={selectedBrand} onValueChange={setSelectedBrand}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Marke wählen" />
          </SelectTrigger>
          <SelectContent>
            {brands.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedModel} onValueChange={setSelectedModel} disabled={!selectedBrand}>
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Modell wählen" />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeChapters.length > 0 && (
        <div className="space-y-3 pt-2">
          {activeChapters.map((ch, i) => (
            <div key={i} className="p-4 rounded-lg bg-muted/50 space-y-1">
              <h4 className="text-sm font-semibold">{ch.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{ch.text}</p>
              {ch.image_url && (
                <img src={ch.image_url} alt={ch.title} className="mt-2 rounded-lg border border-border max-w-full" loading="lazy" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
