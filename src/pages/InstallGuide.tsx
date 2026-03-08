import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Smartphone, ChevronRight, Download, BookOpen } from "lucide-react";

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

const genericGuide: GuideChapter[] = [
  {
    title: "App installieren",
    text: 'FieldIQ ist eine Web-App (PWA). Oeffne den Browser auf deinem Smartphone und navigiere zur FieldIQ-Adresse. Tippe auf "Zum Startbildschirm hinzufuegen" (iOS: Teilen-Button > "Zum Home-Bildschirm"; Android: Drei-Punkte-Menu > "Zum Startbildschirm hinzufuegen"). Die App erscheint jetzt wie eine normale App auf deinem Geraet.',
  },
  {
    title: "Kamera-Zugriff erlauben",
    text: 'Beim ersten Start fragt FieldIQ nach dem Zugriff auf deine Kamera. Tippe auf "Erlauben". Falls du versehentlich auf "Ablehnen" gedrueckt hast: Gehe in die Einstellungen deines Browsers > Website-Einstellungen > Kamera > Erlauben.',
  },
  {
    title: "Smartphones positionieren",
    text: "Platziere 2-3 Smartphones entlang der Seitenlinie, moeglichst erhoeht (ca. 1,5-2m). Du kannst sie an Absperrzaeune lehnen, auf Stative setzen oder Halterungen nutzen. Achte darauf, dass das gesamte Spielfeld von den Kameras abgedeckt wird. Tipp: Ein Smartphone in der Mitte und je eines an den 16-Meter-Linien ergibt die beste Abdeckung.",
  },
  {
    title: "Tracking starten",
    text: 'Oeffne FieldIQ auf jedem Smartphone und navigiere zum aktuellen Spiel. Tippe auf "Tracking starten". Die KI beginnt automatisch, alle Spieler auf dem Feld zu erkennen und ihre Bewegungen aufzuzeichnen. Du siehst einen gruenen Indikator, wenn die Erkennung laeuft.',
  },
  {
    title: "Nach dem Spiel",
    text: 'Tippe auf "Tracking beenden". Die Positionsdaten werden automatisch an FieldIQ uebertragen und analysiert. Nach wenigen Sekunden stehen dir Heatmaps, Laufdistanzen, Sprints und Topspeed fuer jeden Spieler zur Verfuegung. Tipp: Stelle sicher, dass dein Smartphone eine Internetverbindung hat (WLAN oder Mobilfunk).',
  },
];

export default function InstallGuide() {
  const [guides, setGuides] = useState<DeviceGuide[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [models, setModels] = useState<string[]>([]);
  const [activeGuide, setActiveGuide] = useState<GuideChapter[]>(genericGuide);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("device_guides")
        .select("*")
        .eq("active", true)
        .order("brand");
      const typedData = (data ?? []) as unknown as DeviceGuide[];
      setGuides(typedData);
      const uniqueBrands = [...new Set(typedData.map((g) => g.brand))].sort();
      setBrands(uniqueBrands);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (selectedBrand) {
      const brandModels = guides
        .filter((g) => g.brand === selectedBrand)
        .map((g) => g.model)
        .sort();
      setModels(brandModels);
      setSelectedModel("");
      setActiveGuide(genericGuide);
    } else {
      setModels([]);
      setSelectedModel("");
      setActiveGuide(genericGuide);
    }
  }, [selectedBrand, guides]);

  useEffect(() => {
    if (selectedBrand && selectedModel) {
      const guide = guides.find(
        (g) => g.brand === selectedBrand && g.model === selectedModel
      );
      if (guide && Array.isArray(guide.guide_chapters) && guide.guide_chapters.length > 0) {
        setActiveGuide(guide.guide_chapters as GuideChapter[]);
      } else {
        setActiveGuide(genericGuide);
      }
    }
  }, [selectedModel, selectedBrand, guides]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="font-display text-xl font-bold tracking-tight flex items-center gap-1.5">
            <span className="w-7 h-7 rounded bg-primary flex items-center justify-center text-primary-foreground text-sm font-black">F</span>
            <span className="text-foreground">Field</span>
            <span className="gradient-text">IQ</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="hero" size="sm" asChild>
              <Link to="/login">Kostenlos testen</Link>
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 pt-28 pb-20 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Zurück zur Startseite
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display">Installationsanleitung</h1>
            <p className="text-sm text-muted-foreground">Schritt für Schritt zum Tracking</p>
          </div>
        </div>

        {/* Device selector */}
        {brands.length > 0 && (
          <div className="glass-card p-5 mb-8 space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              Gerätespezifische Anleitung
            </h2>
            <p className="text-xs text-muted-foreground">
              Wähle dein Gerät für eine maßgeschneiderte Anleitung. Ohne Auswahl wird die allgemeine Anleitung angezeigt.
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
          </div>
        )}

        {/* Guide chapters */}
        <div className="space-y-6">
          {activeGuide.map((chapter, i) => (
            <div key={i} className="glass-card p-6 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-primary">{i + 1}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold font-display">{chapter.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2 whitespace-pre-line">{chapter.text}</p>
                  {chapter.image_url && (
                    <img
                      src={chapter.image_url}
                      alt={chapter.title}
                      className="mt-4 rounded-lg border border-border max-w-full"
                      loading="lazy"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm mb-4">
            Alles bereit? Starte jetzt mit deinem Verein.
          </p>
          <Button variant="hero" size="xl" asChild>
            <Link to="/login">
              Kostenlos loslegen
              <ChevronRight className="ml-1 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
