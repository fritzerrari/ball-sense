import { Link } from "react-router-dom";
import { 
  Camera, Users, Map, ClipboardList, Play, BarChart3, FileText, 
  Brain, BrainCircuit, Swords, Video, Shield, ArrowRight, CheckCircle2,
  Smartphone, Sun, Mountain, Undo2, Trophy, Target, Dumbbell,
  BookOpen, ChevronRight
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/landing/Footer";

/* ─── tiny visual mockup components ─── */
function MockScreen({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-destructive/60" />
        <span className="h-2 w-2 rounded-full bg-yellow-400/60" />
        <span className="h-2 w-2 rounded-full bg-primary/60" />
        <span className="ml-2 text-[10px] font-medium text-muted-foreground">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function FormationMock() {
  return (
    <div className="relative h-32 w-full rounded-lg bg-primary/10 border border-primary/20">
      <div className="absolute inset-0 flex flex-col items-center justify-between py-3">
        <div className="flex gap-6"><span className="h-4 w-4 rounded-full bg-primary/80 text-[8px] text-primary-foreground flex items-center justify-center font-bold">9</span></div>
        <div className="flex gap-3">{[10,8,6].map(n=><span key={n} className="h-4 w-4 rounded-full bg-primary/60 text-[8px] text-primary-foreground flex items-center justify-center font-bold">{n}</span>)}</div>
        <div className="flex gap-3">{[2,4,5,3].map(n=><span key={n} className="h-4 w-4 rounded-full bg-primary/50 text-[8px] text-primary-foreground flex items-center justify-center font-bold">{n}</span>)}</div>
        <div><span className="h-5 w-5 rounded-full bg-accent text-[8px] text-accent-foreground flex items-center justify-center font-bold">1</span></div>
      </div>
      <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-primary/20" />
    </div>
  );
}

/* ─── Step card ─── */
function StepCard({ step, title, desc, icon: Icon, children }: { step: number; title: string; desc: string; icon: any; children?: React.ReactNode }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -right-4 -top-4 text-[80px] font-black text-primary/5 leading-none select-none">{step}</div>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold">{title}</h3>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/* ─── Feature highlight card ─── */
function FeatureCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <Card className="group hover:border-primary/40 transition-colors">
      <CardContent className="p-5 space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-sm font-bold">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
      </CardContent>
    </Card>
  );
}

export default function TutorialPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-1.5 font-display text-lg font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-black text-primary-foreground">F</span>
            <span>Field<span className="gradient-text">IQ</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Anmelden</Button>
            </Link>
            <Link to="/login">
              <Button size="sm">Loslegen</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
            <BookOpen className="h-3.5 w-3.5" /> Tutorial & Anleitung
          </div>
          <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
            So funktioniert <span className="gradient-text">FieldIQ</span>
          </h1>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Vom ersten Login bis zum fertigen Spielbericht — in 3 Phasen zur vollautomatischen Spielanalyse. Kein technisches Wissen nötig.
          </p>
          {/* Workflow indicator */}
          <div className="mx-auto flex max-w-lg items-center justify-center gap-2 pt-4">
            {["Vor dem Spiel", "Während des Spiels", "Nach dem Spiel"].map((phase, i) => (
              <div key={phase} className="flex items-center gap-2">
                <div className={`flex h-8 items-center gap-1.5 rounded-full px-4 text-xs font-semibold ${
                  i === 0 ? "bg-primary text-primary-foreground" : i === 1 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  <span>{i + 1}</span>
                  <span className="hidden sm:inline">{phase}</span>
                </div>
                {i < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PHASE 1: VOR DEM SPIEL ═══ */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4 space-y-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-sm font-black text-primary-foreground">1</span>
            <div>
              <h2 className="text-xl font-display font-bold">Vor dem Spiel</h2>
              <p className="text-sm text-muted-foreground">Einmalige Einrichtung + Spielvorbereitung</p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <StepCard step={1} title="Verein & Kader anlegen" desc="Vereinsname und Spieler mit Rückennummern und Positionen eintragen." icon={Users}>
              <MockScreen title="Kader">
                <div className="space-y-1.5">
                  {[{n:1,name:"L. Müller",pos:"TW"},{n:4,name:"T. Schmidt",pos:"IV"},{n:10,name:"M. Weber",pos:"ZM"}].map(p=>(
                    <div key={p.n} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1.5 text-[10px]">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 text-[9px] font-bold text-primary">{p.n}</span>
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-auto text-muted-foreground">{p.pos}</span>
                    </div>
                  ))}
                </div>
              </MockScreen>
            </StepCard>

            <StepCard step={2} title="Spielfeld einrichten" desc="Platz anlegen mit Maßen (Standard: 105×68m). Kalibrierung erfolgt automatisch." icon={Map}>
              <MockScreen title="Spielfeld">
                <div className="flex items-center justify-center">
                  <div className="h-20 w-36 rounded border-2 border-primary/40 relative">
                    <div className="absolute inset-x-0 top-1/2 border-t border-primary/30" />
                    <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/30" />
                    <span className="absolute bottom-1 right-1 text-[8px] text-muted-foreground">105 × 68m</span>
                  </div>
                </div>
              </MockScreen>
            </StepCard>

            <StepCard step={3} title="Spiel anlegen & Aufstellung" desc="Gegner, Datum, Anstoß und Startelf wählen." icon={ClipboardList}>
              <MockScreen title="Aufstellung">
                <FormationMock />
              </MockScreen>
            </StepCard>

            <StepCard step={4} title="Kamera positionieren" desc="Smartphone auf Stativ, erhöht an der Mittellinie. Ganzes Feld im Bild." icon={Camera}>
              <div className="rounded-xl bg-accent/10 border border-accent/20 p-3 space-y-2">
                <div className="flex items-center gap-2 text-[11px]"><Mountain className="h-4 w-4 text-accent-foreground" /><span className="font-medium">Höhe: 3–5 Meter (Tribüne ideal)</span></div>
                <div className="flex items-center gap-2 text-[11px]"><Sun className="h-4 w-4 text-yellow-500" /><span className="font-medium">Sonne im Rücken, nicht ins Objektiv</span></div>
                <div className="flex items-center gap-2 text-[11px]"><Smartphone className="h-4 w-4 text-primary" /><span className="font-medium">Querformat, ganzes Spielfeld sichtbar</span></div>
              </div>
            </StepCard>
          </div>
        </div>
      </section>

      {/* ═══ PHASE 2: WÄHREND DES SPIELS ═══ */}
      <section className="py-12">
        <div className="container mx-auto px-4 space-y-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-sm font-black text-accent-foreground">2</span>
            <div>
              <h2 className="text-xl font-display font-bold">Während des Spiels</h2>
              <p className="text-sm text-muted-foreground">Events loggen & Live-Score verfolgen</p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <StepCard step={5} title="Aufnahme starten & Events loggen" desc="Mit einem Tap Tore, Chancen, Fouls und Karten für beide Teams erfassen." icon={Play}>
              <MockScreen title="Live-Tracking">
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                    <span className="text-xs font-bold">FC Muster</span>
                    <span className="text-lg font-black text-primary">2 : 1</span>
                    <span className="text-xs font-bold">SV Gegner</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["⚽ Tor","🎯 Chance","🟨 Karte"].map(e=>(
                      <div key={e} className="flex items-center justify-center rounded-lg bg-muted py-2 text-[10px] font-medium">{e}</div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Undo2 className="h-3 w-3" /> Letzte Events rückgängig machen
                  </div>
                </div>
              </MockScreen>
            </StepCard>

            <StepCard step={6} title="Team-Toggle & Undo" desc="Zwischen Heim und Gegner wechseln. Fehleingaben sofort löschen." icon={Undo2}>
              <div className="space-y-2">
                <div className="rounded-xl bg-muted/50 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px]"><CheckCircle2 className="h-4 w-4 text-primary" /><span>Team-Toggle: Heim ↔ Gegner mit einem Tap</span></div>
                  <div className="flex items-center gap-2 text-[11px]"><CheckCircle2 className="h-4 w-4 text-primary" /><span>3-Sekunden-Cooldown gegen Doppelklicks</span></div>
                  <div className="flex items-center gap-2 text-[11px]"><CheckCircle2 className="h-4 w-4 text-primary" /><span>Letzte 3 Events als Chips — Tap zum Löschen</span></div>
                  <div className="flex items-center gap-2 text-[11px]"><CheckCircle2 className="h-4 w-4 text-primary" /><span>Live-Spielstand aktualisiert sich automatisch</span></div>
                </div>
              </div>
            </StepCard>
          </div>
        </div>
      </section>

      {/* ═══ PHASE 3: NACH DEM SPIEL ═══ */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4 space-y-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-sm font-black text-muted-foreground">3</span>
            <div>
              <h2 className="text-xl font-display font-bold">Nach dem Spiel</h2>
              <p className="text-sm text-muted-foreground">KI-Analyse, Report & Trainingsplan</p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <StepCard step={7} title="KI-Analyse wird gestartet" desc="FieldIQ analysiert alle Events und erstellt automatisch den Report." icon={Brain}>
              <MockScreen title="Analyse">
                <div className="space-y-1.5">
                  {["Taktische Bewertung","Momentum-Verlauf","Spieler-Ratings","Gegner-DNA"].map((s,i)=>(
                    <div key={s} className="flex items-center gap-2 text-[10px]">
                      <div className={`h-1.5 rounded-full ${i<3?"bg-primary":"bg-primary/40"}`} style={{width:`${80-i*15}%`}} />
                      <span className="text-muted-foreground whitespace-nowrap">{s}</span>
                    </div>
                  ))}
                </div>
              </MockScreen>
            </StepCard>

            <StepCard step={8} title="Report lesen & verstehen" desc="Match-Rating, taktische Noten, Coaching-Insights und Risiko-Matrix." icon={BarChart3}>
              <MockScreen title="Match Report">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-medium">Match-Rating</span>
                    <span className="font-bold text-primary">7.2 / 10</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full w-[72%] rounded-full bg-primary" /></div>
                  <div className="grid grid-cols-3 gap-1 pt-1">
                    {[{l:"Pressing",g:"B+"},{l:"Aufbau",g:"A-"},{l:"Defensive",g:"C+"}].map(g=>(
                      <div key={g.l} className="text-center rounded bg-muted/50 py-1">
                        <div className="text-[8px] text-muted-foreground">{g.l}</div>
                        <div className="text-[11px] font-bold text-primary">{g.g}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </MockScreen>
            </StepCard>

            <StepCard step={9} title="PDF exportieren & Ergebnis korrigieren" desc="4 Report-Typen als druckfertiges PDF. Ergebnis nachträglich anpassen." icon={FileText}>
              <div className="grid grid-cols-2 gap-1.5">
                {["Vollständiger Bericht","Trainingsplan","Spielvorbereitung","Halbzeit-Taktik"].map(r=>(
                  <div key={r} className="flex items-center gap-1 rounded-lg bg-muted/50 px-2 py-1.5 text-[10px] font-medium">
                    <FileText className="h-3 w-3 text-primary" />{r}
                  </div>
                ))}
              </div>
            </StepCard>
          </div>
        </div>
      </section>

      {/* ═══ FEATURE HIGHLIGHTS ═══ */}
      <section className="py-16">
        <div className="container mx-auto px-4 space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-3xl font-display font-bold">
              Feature-<span className="gradient-text">Highlights</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Alles, was FieldIQ für dein Team leistet — von der Aufnahme bis zum Trainingsplan.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard icon={Brain} title="KI-Coaching-Report" desc="Match-Rating, Taktische Noten (A–F), Momentum-Verlauf und priorisierte Coaching-Insights mit Impact-Score — vollautomatisch generiert." />
            <FeatureCard icon={Video} title="Taktik-Replay" desc="Animierte 2D-Spielzug-Rekonstruktion mit Spielerpositionen, Laufwegen und Formationsänderungen im Zeitverlauf." />
            <FeatureCard icon={Target} title="Gegner-DNA & Scouting" desc="Automatische Gegner-Profile aus vergangenen Spielen: Spielstil-Fingerabdruck, Stärken/Schwächen und Do/Don't-Listen." />
            <FeatureCard icon={Dumbbell} title="Trainings-Mikrozyklus" desc="3 aufeinander abgestimmte Trainingseinheiten basierend auf den erkannten Schwächen des letzten Spiels." />
            <FeatureCard icon={FileText} title="4 PDF-Report-Typen" desc="Vollbericht, Trainingsplan, Spielvorbereitung und Halbzeit-Taktik — professionell formatiert für Druck oder Digital." />
            <FeatureCard icon={Camera} title="Multi-Kamera-Support" desc="Bis zu 3 Kamera-Zugangscodes für verschiedene Geräte. Fernsteuerung per QR-Code ohne Login." />
            <FeatureCard icon={Swords} title="Spielvorbereitung" desc="KI-gestützte Gegner-Briefings mit empfohlener Formation, taktischen Schwerpunkten und Standard-Situationen." />
            <FeatureCard icon={BrainCircuit} title="KI-Assistent" desc="Frag den Assistenten alles über dein Team: 'Wie hat Spieler X in den letzten 3 Spielen performed?'" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center space-y-6">
          <h2 className="text-2xl font-display font-bold">Bereit loszulegen?</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Erstelle deinen Account und starte in wenigen Minuten mit der ersten Spielanalyse.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/login">
              <Button size="lg" className="gap-2">
                Jetzt starten <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/install">
              <Button variant="outline" size="lg">Installations-Guide</Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
