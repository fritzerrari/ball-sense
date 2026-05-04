import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowRight, ArrowLeft, Trophy, Users, Video, CheckCircle2, Star, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const VIKTORIA_URL = "https://www.fussball.de/verein/sv-viktoria-aschaffenburg-bayern/-/id/00ES8GNLE000000MVV0AG08LVUPGND5I";

export function OnboardingWizard() {
  const { user, clubId, clubName } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [clubUrl, setClubUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [chosenTeamId, setChosenTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !clubId) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile?.onboarding_completed_at) {
        // pre-fill viktoria URL if club name matches
        if (clubName?.toLowerCase().includes("viktoria") && clubName?.toLowerCase().includes("aschaffenburg")) {
          setClubUrl(VIKTORIA_URL);
        }
        setOpen(true);
      }
    })();
  }, [user, clubId, clubName]);

  const finish = async () => {
    if (chosenTeamId) {
      await supabase.from("club_teams").update({ is_default: true }).eq("id", chosenTeamId);
    }
    await supabase.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("user_id", user!.id);
    setOpen(false);
    toast.success("Willkommen an Bord! 🎉");
    navigate("/dashboard");
  };

  const skip = async () => {
    await supabase.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("user_id", user!.id);
    setOpen(false);
  };

  const runImport = async () => {
    if (!clubUrl.trim()) { toast.error("Bitte fussball.de URL angeben"); return; }
    setImporting(true);
    const tid = toast.loading("Importiere Mannschaften, Spielplan & Statistiken…");
    try {
      const { data, error } = await supabase.functions.invoke("scrape-club-teams", {
        body: { club_url: clubUrl.trim(), club_id: clubId, scope: "all" },
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || "Fehler");
      toast.success(`${data.teams_imported} Mannschaften · ${data.fixtures_imported} Spiele · ${data.players_imported} Spieler`, { id: tid });
      const { data: t } = await supabase.from("club_teams").select("*").eq("club_id", clubId!).order("name");
      setTeams(t ?? []);
      // auto-pick U19 if present
      const u19 = (t ?? []).find((x: any) => /u-?19|a-jun/i.test(x.age_group || "") || /u-?19|a-jun/i.test(x.name));
      if (u19) setChosenTeamId(u19.id);
      setStep(3);
    } catch (e: any) {
      toast.error(e.message, { id: tid });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && skip()}>
      <DialogContent className="max-w-lg">
        {/* Progress */}
        <div className="flex gap-1 mb-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className={`h-1 flex-1 rounded-full transition ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="text-center py-4">
            <div className="text-5xl mb-3">👋</div>
            <h2 className="text-2xl font-bold">Willkommen, Trainer!</h2>
            <p className="text-muted-foreground mt-2">In 3 Minuten bist du startklar. Wir richten alles für dich ein – Kader, Spielplan und Tabelle holen wir uns automatisch.</p>
            <Button size="lg" className="mt-6" onClick={() => setStep(1)}>Los geht's <ArrowRight className="ml-2 h-4 w-4" /></Button>
            <button onClick={skip} className="block mx-auto mt-3 text-xs text-muted-foreground hover:underline">überspringen</button>
          </div>
        )}

        {step === 1 && (
          <div className="py-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Was du gleich kannst</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex gap-3"><Video className="h-5 w-5 text-primary shrink-0" /><span><b>Spiel aufnehmen</b> – einfach mit dem Handy filmen, wir analysieren automatisch.</span></li>
              <li className="flex gap-3"><Trophy className="h-5 w-5 text-primary shrink-0" /><span><b>Live-Tabelle & Spielplan</b> – immer aktuell von fussball.de.</span></li>
              <li className="flex gap-3"><Users className="h-5 w-5 text-primary shrink-0" /><span><b>Spielerstats automatisch</b> – Tore, Vorlagen, Karten – alles im Profil.</span></li>
            </ul>
            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft className="mr-2 h-4 w-4" /> Zurück</Button>
              <Button onClick={() => setStep(2)}>Weiter <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="py-4">
            <h2 className="text-xl font-bold">Wo finden wir deinen Verein?</h2>
            <p className="text-sm text-muted-foreground mt-1">Suche deinen Verein auf <a className="underline" href="https://www.fussball.de" target="_blank">fussball.de</a> und kopiere die URL der Vereinsseite.</p>
            <Input className="mt-4" value={clubUrl} onChange={e => setClubUrl(e.target.value)} placeholder="https://www.fussball.de/verein/..." disabled={importing} />
            <p className="text-xs text-muted-foreground mt-2">Wir laden dann automatisch alle Mannschaften (Herren, U19, U17 …) inkl. Spielplan, Tabelle & Spielerstatistiken.</p>
            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={importing}><ArrowLeft className="mr-2 h-4 w-4" /> Zurück</Button>
              <Button onClick={runImport} disabled={importing || !clubUrl.trim()}>
                {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lädt…</> : <>Importieren <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="py-4">
            <h2 className="text-xl font-bold">Welche Mannschaft trainierst du?</h2>
            <p className="text-sm text-muted-foreground mt-1">Wir merken sie als deine Standard-Mannschaft – beim Anlegen neuer Spiele wird alles vorausgefüllt.</p>
            <div className="mt-4 space-y-2 max-h-72 overflow-auto">
              {teams.map(t => (
                <button
                  key={t.id}
                  onClick={() => setChosenTeamId(t.id)}
                  className={`w-full text-left p-3 rounded-lg border transition flex items-center justify-between gap-2 ${chosenTeamId === t.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.name}</div>
                    {t.age_group && <Badge variant="outline" className="mt-1 text-xs">{t.age_group}</Badge>}
                  </div>
                  {chosenTeamId === t.id && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                </button>
              ))}
              {teams.length === 0 && <div className="text-sm text-muted-foreground">Keine Mannschaften gefunden – du kannst sie später in den Einstellungen importieren.</div>}
            </div>
            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="mr-2 h-4 w-4" /> Zurück</Button>
              <Button onClick={() => setStep(4)} disabled={!chosenTeamId && teams.length > 0}>
                Weiter <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center py-4">
            <CheckCircle2 className="h-14 w-14 text-primary mx-auto mb-3" />
            <h2 className="text-2xl font-bold">Du bist startklar!</h2>
            <p className="text-muted-foreground mt-2">Alles eingerichtet. Im Cockpit siehst du jetzt dein nächstes Spiel, deine Tabelle und kannst loslegen.</p>
            <div className="grid grid-cols-2 gap-2 mt-6 text-left">
              <div className="p-3 rounded-lg bg-muted/50"><div className="text-xs text-muted-foreground">Tipp</div><div className="text-sm">Klicke auf <b>Spiel aufnehmen</b> – einfacher geht's nicht.</div></div>
              <div className="p-3 rounded-lg bg-muted/50"><div className="text-xs text-muted-foreground">Tipp</div><div className="text-sm">(?)-Symbole erklären jeden Fachbegriff.</div></div>
            </div>
            <Button size="lg" className="mt-6" onClick={finish}>Ins Cockpit <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
