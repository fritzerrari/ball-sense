import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Calendar, MapPin, Users, Camera, QrCode } from "lucide-react";
import { Link } from "react-router-dom";

const formationOptions = ["4-4-2", "4-3-3", "3-5-2", "4-2-3-1", "3-4-3", "5-3-2", "5-4-1"];

export default function NewMatch() {
  const [step, setStep] = useState(1);
  const [cameras, setCameras] = useState(3);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/matches" className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold font-display">Neues Spiel</h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {["Details", "Aufstellung Heim", "Aufstellung Gast", "Kameras"].map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-display shrink-0 transition-colors ${
                i + 1 === step ? "bg-primary text-primary-foreground" :
                i + 1 < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {i + 1}
              </div>
              {i < 3 && <div className={`h-px flex-1 ${i + 1 < step ? "bg-primary/30" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="glass-card p-6 space-y-5">
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" /> Spiel-Details
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Datum</label>
                  <input type="date" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Anstoß</label>
                  <input type="time" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Platz</label>
                <select className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
                  <option>Hauptplatz</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Gegner</label>
                <input type="text" placeholder="Vereinsname eingeben..." className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Formation Heim</label>
                  <select className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
                    {formationOptions.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Formation Gast</label>
                  <select className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
                    {formationOptions.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Aufstellung Heim
              </h2>
              <p className="text-sm text-muted-foreground">Wähle die Startelf und Auswechselspieler aus deinem Kader.</p>
              <div className="glass-card p-8 text-center">
                <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Lege zuerst Spieler im <Link to="/players" className="text-primary hover:underline">Kader</Link> an.</p>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Aufstellung Gast
              </h2>
              <p className="text-sm text-muted-foreground">Gib die Spieler des Gegners ein (min. 11).</p>
              <div className="space-y-2">
                {Array.from({ length: 11 }).map((_, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="number" placeholder="#" className="w-16 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm text-center" />
                    <input type="text" placeholder={`Spieler ${i + 1}`} className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" />
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" /> Kamera-Setup
              </h2>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Anzahl Kameras</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCameras(n)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        cameras === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {n} Kamera{n > 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
              </div>
              <div className="glass-card p-4 text-sm text-muted-foreground flex items-start gap-2">
                <Camera className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Empfehlung: 3 Kameras für vollständige Abdeckung des gesamten Spielfelds.</span>
              </div>
              {/* Camera zone preview */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="aspect-[105/68] border-2 border-primary/30 rounded relative">
                  <div className="absolute inset-0 flex">
                    {Array.from({ length: cameras }).map((_, i) => (
                      <div key={i} className={`flex-1 border-r last:border-r-0 border-primary/20 flex items-center justify-center`}>
                        <div className="text-center">
                          <QrCode className="h-6 w-6 text-primary mx-auto mb-1" />
                          <span className="text-xs text-muted-foreground">Kamera {i + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                {Array.from({ length: cameras }).map((_, i) => (
                  <div key={i} className="glass-card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <QrCode className="h-8 w-8 text-primary" />
                      <div>
                        <div className="text-sm font-medium">Kamera {i + 1}</div>
                        <div className="text-xs text-muted-foreground">/matches/new/track?cam={i}</div>
                      </div>
                    </div>
                    <Button variant="heroOutline" size="sm">QR anzeigen</Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
          </Button>
          {step < 4 ? (
            <Button variant="hero" onClick={() => setStep(step + 1)}>
              Weiter <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button variant="hero">
              Spiel erstellen & QR-Codes anzeigen
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
