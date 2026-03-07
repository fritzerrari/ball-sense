import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/AuthProvider";
import { useCreatePlayer } from "@/hooks/use-players";
import { useCreateField } from "@/hooks/use-fields";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Building2, Users, Map, Download, CheckCircle2,
  Plus, Trash2, ChevronRight, ChevronLeft, Loader2, Smartphone,
} from "lucide-react";

const POSITIONS = ["TW", "IV", "LV", "RV", "ZM", "ZDM", "ZOM", "LA", "RA", "ST"];

interface PlayerEntry {
  name: string;
  number: string;
  position: string;
}

const STEPS = [
  { label: "Verein", icon: Building2 },
  { label: "Kader", icon: Users },
  { label: "Spielfeld", icon: Map },
  { label: "App installieren", icon: Download },
  { label: "Fertig", icon: CheckCircle2 },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { clubId, clubName } = useAuth();
  const createPlayer = useCreatePlayer();
  const createField = useCreateField();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1 — club
  const [city, setCity] = useState("");
  const [league, setLeague] = useState("");

  // Step 2 — players
  const [players, setPlayers] = useState<PlayerEntry[]>([
    { name: "", number: "", position: "" },
  ]);

  // Step 3 — field
  const [fieldName, setFieldName] = useState("Hauptplatz");
  const [fieldWidth, setFieldWidth] = useState("105");
  const [fieldHeight, setFieldHeight] = useState("68");

  // Step 4 — PWA
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Listen for install prompt
  useState(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler as any);
    return () => window.removeEventListener("beforeinstallprompt", handler as any);
  });

  const progress = ((step + 1) / STEPS.length) * 100;

  const addPlayer = () => setPlayers([...players, { name: "", number: "", position: "" }]);
  const removePlayer = (i: number) => setPlayers(players.filter((_, idx) => idx !== i));
  const updatePlayer = (i: number, field: keyof PlayerEntry, value: string) => {
    const updated = [...players];
    updated[i] = { ...updated[i], [field]: value };
    setPlayers(updated);
  };

  const saveClubDetails = async () => {
    if (!clubId) return;
    const updates: any = {};
    if (city.trim()) updates.city = city.trim();
    if (league.trim()) updates.league = league.trim();
    if (Object.keys(updates).length > 0) {
      await supabase.from("clubs").update(updates).eq("id", clubId);
    }
  };

  const savePlayers = async () => {
    const valid = players.filter((p) => p.name.trim());
    for (const p of valid) {
      await createPlayer.mutateAsync({
        name: p.name.trim(),
        number: p.number ? parseInt(p.number) : null,
        position: p.position || null,
      });
    }
  };

  const saveField = async () => {
    if (!fieldName.trim()) return;
    await createField.mutateAsync({
      name: fieldName.trim(),
      width_m: parseFloat(fieldWidth) || 105,
      height_m: parseFloat(fieldHeight) || 68,
    });
  };

  const handleNext = async () => {
    setSaving(true);
    try {
      if (step === 0) await saveClubDetails();
      if (step === 1) await savePlayers();
      if (step === 2) await saveField();
      setStep(step + 1);
    } catch {
      toast.error("Fehler beim Speichern. Bitte versuche es erneut.");
    } finally {
      setSaving(false);
    }
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
  };

  const canProceed = () => {
    if (step === 1) return players.some((p) => p.name.trim());
    if (step === 2) return fieldName.trim().length > 0;
    return true;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded bg-primary flex items-center justify-center text-primary-foreground text-sm font-black">F</span>
            <span className="font-display font-bold text-foreground">Field</span>
            <span className="font-display font-bold text-primary">IQ</span>
            <span className="ml-auto text-xs text-muted-foreground">
              Schritt {step + 1} von {STEPS.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2">
            {STEPS.map((s, i) => (
              <div
                key={s.label}
                className={`flex flex-col items-center gap-1 ${
                  i <= step ? "text-primary" : "text-muted-foreground/40"
                }`}
              >
                <s.icon className="h-4 w-4" />
                <span className="text-[10px] hidden sm:block">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-lg space-y-6">
          {/* Step 0 — Club */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold font-display">Vereinsdaten bestätigen</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Ergänze optional Stadt und Liga.
                </p>
              </div>
              <div className="glass-card p-5 space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Vereinsname</label>
                  <div className="px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm">
                    {clubName || "—"}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Stadt</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="z.B. München"
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Liga / Spielklasse</label>
                  <input
                    value={league}
                    onChange={(e) => setLeague(e.target.value)}
                    placeholder="z.B. Kreisliga A"
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — Players */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold font-display">Kader anlegen</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Füge deine Spieler hinzu. Du kannst später jederzeit weitere ergänzen.
                </p>
              </div>
              <div className="space-y-3">
                {players.map((p, i) => (
                  <div key={i} className="glass-card p-4 flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                      <input
                        value={p.name}
                        onChange={(e) => updatePlayer(i, "name", e.target.value)}
                        placeholder="Name"
                        className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground"
                      />
                      <div className="flex gap-2">
                        <input
                          value={p.number}
                          onChange={(e) => updatePlayer(i, "number", e.target.value)}
                          placeholder="Nr."
                          type="number"
                          className="w-20 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground"
                        />
                        <select
                          value={p.position}
                          onChange={(e) => updatePlayer(i, "position", e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm"
                        >
                          <option value="">Position</option>
                          {POSITIONS.map((pos) => (
                            <option key={pos} value={pos}>{pos}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {players.length > 1 && (
                      <button
                        onClick={() => removePlayer(i)}
                        className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={addPlayer} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Weiteren Spieler hinzufügen
              </Button>
            </div>
          )}

          {/* Step 2 — Field */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold font-display">Spielfeld erstellen</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Erstelle dein Spielfeld. Standard-Maße sind vorausgefüllt.
                </p>
              </div>
              <div className="glass-card p-5 space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Feldname</label>
                  <input
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    placeholder="z.B. Hauptplatz"
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">Länge (m)</label>
                    <input
                      value={fieldWidth}
                      onChange={(e) => setFieldWidth(e.target.value)}
                      type="number"
                      className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">Breite (m)</label>
                    <input
                      value={fieldHeight}
                      onChange={(e) => setFieldHeight(e.target.value)}
                      type="number"
                      className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — PWA Install */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold font-display">App installieren</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Installiere FieldIQ auf deinem Homescreen für den schnellsten Zugang.
                </p>
              </div>
              <div className="glass-card p-6 space-y-6">
                {deferredPrompt ? (
                  <Button variant="hero" className="w-full text-lg py-6" onClick={handleInstall}>
                    <Download className="h-5 w-5 mr-2" /> Jetzt installieren
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-muted">
                      <Smartphone className="h-6 w-6 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">iPhone / Safari</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Tippe auf das <strong>Teilen</strong>-Symbol (□↑) und wähle <strong>„Zum Home-Bildschirm"</strong>.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-muted">
                      <Smartphone className="h-6 w-6 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Android / Chrome</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Tippe auf das <strong>Menü</strong> (⋮) und wähle <strong>„App installieren"</strong> oder <strong>„Zum Startbildschirm hinzufügen"</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <p className="text-xs text-center text-muted-foreground">
                  Du kannst diesen Schritt auch später nachholen.
                </p>
              </div>
            </div>
          )}

          {/* Step 4 — Done */}
          {step === 4 && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-display">Alles eingerichtet!</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {clubName} ist bereit für das erste Tracking. Erstelle jetzt dein erstes Spiel oder erkunde das Dashboard.
                </p>
              </div>
              <div className="glass-card p-5 text-left space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm">Verein eingerichtet</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm">
                    {players.filter((p) => p.name.trim()).length} Spieler hinzugefügt
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm">Spielfeld erstellt</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="heroOutline" className="flex-1" onClick={() => navigate("/matches/new")}>
                  Erstes Spiel anlegen
                </Button>
                <Button variant="hero" className="flex-1" onClick={() => navigate("/dashboard")}>
                  Zum Dashboard
                </Button>
              </div>
            </div>
          )}

          {/* Navigation */}
          {step < 4 && (
            <div className="flex gap-3 pt-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
                </Button>
              )}
              {step === 3 ? (
                <Button variant="hero" onClick={() => setStep(4)} className="flex-1">
                  {step === 0 && !city && !league ? "Überspringen" : "Weiter"} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  variant="hero"
                  onClick={handleNext}
                  disabled={saving || !canProceed()}
                  className="flex-1"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Weiter <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          )}

          {/* Skip link */}
          {step < 4 && (
            <button
              onClick={() => navigate("/dashboard")}
              className="block mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Einrichtung überspringen →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
