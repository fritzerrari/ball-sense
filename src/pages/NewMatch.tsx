import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Calendar, Users, Camera, QrCode, Loader2, Check, Dumbbell, Swords } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { usePlayers } from "@/hooks/use-players";
import { useFields } from "@/hooks/use-fields";
import { useCreateMatch } from "@/hooks/use-matches";
import { useAuth } from "@/components/AuthProvider";
import { FORMATIONS } from "@/lib/constants";
import { toast } from "sonner";

interface GuestPlayer {
  name: string;
  number: string;
  position: string;
}

export default function NewMatch() {
  const navigate = useNavigate();
  const { clubName, clubId } = useAuth();
  const { data: players } = usePlayers();
  const { data: fields } = useFields();
  const createMatch = useCreateMatch();

  const [matchType, setMatchType] = useState<"match" | "training">("match");
  const [step, setStep] = useState(0); // 0 = type selection

  // Step 1 state
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [kickoff, setKickoff] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [awayName, setAwayName] = useState("");
  const [homeFormation, setHomeFormation] = useState("4-4-2");
  const [awayFormation, setAwayFormation] = useState("4-4-2");

  // Step 2 state
  const [homeStarters, setHomeStarters] = useState<Set<string>>(new Set());
  const [homeBench, setHomeBench] = useState<Set<string>>(new Set());
  const [shirtNumbers, setShirtNumbers] = useState<Record<string, number>>({});

  // Training mode: selected players (1-unlimited)
  const [trainingPlayers, setTrainingPlayers] = useState<Set<string>>(new Set());

  // Step 3 state
  const [guestPlayers, setGuestPlayers] = useState<GuestPlayer[]>(
    Array.from({ length: 11 }, (_, i) => ({ name: "", number: String(i + 1), position: "" }))
  );

  // Step 4 state
  const [cameras, setCameras] = useState(3);

  const activePlayers = (players ?? []).filter(p => p.active);

  const getShirtNumber = (playerId: string) => {
    if (shirtNumbers[playerId] !== undefined) return shirtNumbers[playerId];
    const p = activePlayers.find(pl => pl.id === playerId);
    return p?.number ?? 0;
  };

  const toggleStarter = (id: string) => {
    const next = new Set(homeStarters);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= 11) { toast.error("Maximal 11 Startspieler"); return; }
      next.add(id);
      const b = new Set(homeBench);
      b.delete(id);
      setHomeBench(b);
    }
    setHomeStarters(next);
  };

  const toggleBench = (id: string) => {
    const next = new Set(homeBench);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= 7) { toast.error("Maximal 7 Auswechselspieler"); return; }
      next.add(id);
      const s = new Set(homeStarters);
      s.delete(id);
      setHomeStarters(s);
    }
    setHomeBench(next);
  };

  const toggleTrainingPlayer = (id: string) => {
    const next = new Set(trainingPlayers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTrainingPlayers(next);
  };

  const updateGuestPlayer = (index: number, field: keyof GuestPlayer, value: string) => {
    const next = [...guestPlayers];
    next[index] = { ...next[index], [field]: value };
    setGuestPlayers(next);
  };

  const addGuestRow = () => {
    setGuestPlayers([...guestPlayers, { name: "", number: String(guestPlayers.length + 1), position: "" }]);
  };

  // Steps config based on mode
  const isTraining = matchType === "training";
  const steps = isTraining
    ? [
        { label: "Typ", icon: Dumbbell },
        { label: "Details", icon: Calendar },
        { label: "Spieler", icon: Users },
        { label: "Kameras", icon: Camera },
      ]
    : [
        { label: "Typ", icon: Swords },
        { label: "Details", icon: Calendar },
        { label: "Heim", icon: Users },
        { label: "Gast", icon: Users },
        { label: "Kameras", icon: Camera },
      ];

  const totalSteps = steps.length - 1; // step 0 is type selection
  const lastStep = totalSteps;

  const canProceed = () => {
    if (step === 0) return true;
    if (step === 1) return date && fieldId;
    if (isTraining && step === 2) return trainingPlayers.size >= 1;
    return true;
  };

  const handleCreate = async () => {
    if (!fieldId) { toast.error("Bitte wähle einen Platz"); return; }

    const lineups: any[] = [];

    if (isTraining) {
      // Training: selected players as "home" starters
      trainingPlayers.forEach(id => {
        lineups.push({
          player_id: id,
          team: "home",
          starting: true,
          shirt_number: getShirtNumber(id),
          player_name: activePlayers.find(p => p.id === id)?.name ?? null,
        });
      });
    } else {
      // Match: home starters
      homeStarters.forEach(id => {
        lineups.push({
          player_id: id,
          team: "home",
          starting: true,
          shirt_number: getShirtNumber(id),
          player_name: activePlayers.find(p => p.id === id)?.name ?? null,
        });
      });
      // Home bench
      homeBench.forEach(id => {
        lineups.push({
          player_id: id,
          team: "home",
          starting: false,
          shirt_number: getShirtNumber(id),
          player_name: activePlayers.find(p => p.id === id)?.name ?? null,
        });
      });
      // Away players
      guestPlayers.filter(p => p.name.trim()).forEach(p => {
        lineups.push({
          player_id: null,
          team: "away",
          starting: true,
          shirt_number: p.number ? parseInt(p.number) : null,
          player_name: p.name.trim(),
        });
      });
    }

    const newMatch = await createMatch.mutateAsync({
      date,
      kickoff: kickoff || undefined,
      field_id: fieldId,
      away_club_name: isTraining ? undefined : (awayName || undefined),
      home_formation: isTraining ? undefined : homeFormation,
      away_formation: isTraining ? undefined : awayFormation,
      match_type: matchType,
      lineups,
    });

    navigate(`/matches/${newMatch.id}`);
  };

  useEffect(() => {
    if (fields && fields.length > 0 && !fieldId) {
      setFieldId(fields[0].id);
    }
  }, [fields, fieldId]);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/matches" className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold font-display">
            {isTraining && step > 0 ? "Neues Training" : "Neues Spiel / Training"}
          </h1>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 sm:gap-2">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-1 sm:gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-display shrink-0 transition-colors ${
                i === step ? "bg-primary text-primary-foreground" :
                i < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4 sm:hidden" />}
              </div>
              <span className="text-xs text-muted-foreground hidden sm:block">{s.label}</span>
              {i < steps.length - 1 && <div className={`h-px flex-1 ${i < step ? "bg-primary/30" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="glass-card p-6 space-y-5">
          {/* Step 0: Type Selection */}
          {step === 0 && (
            <>
              <h2 className="text-lg font-semibold font-display">Was möchtest du aufzeichnen?</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <button
                  onClick={() => { setMatchType("match"); setStep(1); }}
                  className="glass-card p-6 text-left hover:border-primary/40 transition-all group"
                >
                  <Swords className="h-10 w-10 text-primary mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold font-display mb-1">Spiel</h3>
                  <p className="text-sm text-muted-foreground">
                    Wettkampf mit Heim- und Gast-Aufstellung, Formationen und vollständiger Analyse.
                  </p>
                </button>
                <button
                  onClick={() => { setMatchType("training"); setStep(1); }}
                  className="glass-card p-6 text-left hover:border-primary/40 transition-all group"
                >
                  <Dumbbell className="h-10 w-10 text-primary mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold font-display mb-1">Training</h3>
                  <p className="text-sm text-muted-foreground">
                    Trainingseinheit mit 1–beliebig vielen Spielern. Laufdaten, Sprints & Heatmaps.
                  </p>
                </button>
              </div>
            </>
          )}

          {/* Step 1: Details */}
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {isTraining ? "Training-Details" : "Spiel-Details"}
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Datum *</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">{isTraining ? "Uhrzeit" : "Anstoß"}</label>
                  <input type="time" value={kickoff} onChange={e => setKickoff(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Platz *</label>
                <select value={fieldId} onChange={e => setFieldId(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
                  {!fields?.length && <option value="">Kein Platz verfügbar</option>}
                  {(fields ?? []).map(f => <option key={f.id} value={f.id}>{f.name} ({f.width_m}×{f.height_m}m)</option>)}
                </select>
                {!fields?.length && <p className="text-xs text-destructive mt-1">Bitte lege zuerst einen <Link to="/fields" className="underline">Platz</Link> an.</p>}
              </div>
              {!isTraining && (
                <>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Heim</label>
                    <input type="text" value={clubName ?? ""} disabled className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground/50 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Gegner</label>
                    <input type="text" value={awayName} onChange={e => setAwayName(e.target.value)} placeholder="Vereinsname eingeben..." className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Formation Heim</label>
                      <select value={homeFormation} onChange={e => setHomeFormation(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
                        {FORMATIONS.map(f => <option key={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Formation Gast</label>
                      <select value={awayFormation} onChange={e => setAwayFormation(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
                        {FORMATIONS.map(f => <option key={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Step 2: Training Players OR Home Lineup */}
          {step === 2 && isTraining && (
            <>
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Spieler auswählen
              </h2>
              <p className="text-sm text-muted-foreground">
                Wähle mindestens 1 Spieler für das Training aus. Ausgewählt: {trainingPlayers.size}
              </p>
              {activePlayers.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Lege zuerst Spieler im <Link to="/players" className="text-primary hover:underline">Kader</Link> an.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {activePlayers.map(p => {
                    const isSelected = trainingPlayers.has(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleTrainingPlayer(p.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                          isSelected ? "border-primary/30 bg-primary/5" : "border-border/50 hover:border-border"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          {p.number ?? "—"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.position ?? "—"}</div>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setTrainingPlayers(new Set(activePlayers.map(p => p.id)))}>
                  Alle auswählen
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setTrainingPlayers(new Set())}>
                  Keine
                </Button>
              </div>
            </>
          )}

          {step === 2 && !isTraining && (
            <>
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Aufstellung Heim
              </h2>
              <p className="text-sm text-muted-foreground">
                Startelf: {homeStarters.size}/11 · Bank: {homeBench.size}/7
              </p>
              {activePlayers.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Lege zuerst Spieler im <Link to="/players" className="text-primary hover:underline">Kader</Link> an.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {activePlayers.map(p => {
                    const isStarter = homeStarters.has(p.id);
                    const isBench = homeBench.has(p.id);
                    return (
                      <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        isStarter ? "border-primary/30 bg-primary/5" : isBench ? "border-border bg-muted/30" : "border-border/50"
                      }`}>
                        <div className="w-8 text-center">
                          <input
                            type="number"
                            value={getShirtNumber(p.id)}
                            onChange={e => setShirtNumbers({ ...shirtNumbers, [p.id]: parseInt(e.target.value) || 0 })}
                            className="w-full text-center text-sm bg-transparent border-none outline-none text-foreground"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.position ?? "—"}</div>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => toggleStarter(p.id)}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                              isStarter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                          >
                            Start
                          </button>
                          <button
                            onClick={() => toggleBench(p.id)}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                              isBench ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                          >
                            Bank
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Step 3: Away Lineup (match only) */}
          {step === 3 && !isTraining && (
            <>
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Aufstellung Gast {awayName && `— ${awayName}`}
              </h2>
              <p className="text-sm text-muted-foreground">Optional — Gast-Aufstellung eingeben oder überspringen.</p>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {guestPlayers.map((gp, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="number"
                      placeholder="#"
                      value={gp.number}
                      onChange={e => updateGuestPlayer(i, "number", e.target.value)}
                      className="w-14 px-2 py-2 rounded-lg bg-muted border border-border text-foreground text-sm text-center"
                    />
                    <input
                      type="text"
                      placeholder={`Spieler ${i + 1}`}
                      value={gp.name}
                      onChange={e => updateGuestPlayer(i, "name", e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground"
                    />
                    <input
                      type="text"
                      placeholder="Pos"
                      value={gp.position}
                      onChange={e => updateGuestPlayer(i, "position", e.target.value)}
                      className="w-16 px-2 py-2 rounded-lg bg-muted border border-border text-foreground text-sm text-center placeholder:text-muted-foreground"
                    />
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={addGuestRow}>+ Weiteren Spieler</Button>
            </>
          )}

          {/* Last Step: Cameras */}
          {step === lastStep && (
            <>
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" /> Kamera-Setup
              </h2>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Anzahl Kameras</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((n) => (
                    <button key={n} onClick={() => setCameras(n)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      cameras === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}>
                      {n} Kamera{n > 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
              </div>
              <div className="glass-card p-4 text-sm text-muted-foreground flex items-start gap-2">
                <Camera className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{isTraining
                  ? "1 Kamera reicht für Trainingseinheiten meist aus."
                  : "Empfehlung: 3 Kameras für vollständige Abdeckung des gesamten Spielfelds."
                }</span>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="aspect-[105/68] border-2 border-primary/20 rounded relative">
                  <div className="absolute inset-0 flex">
                    {Array.from({ length: cameras }).map((_, i) => (
                      <div key={i} className="flex-1 border-r last:border-r-0 border-primary/20 flex items-center justify-center">
                        <div className="text-center">
                          <Camera className="h-5 w-5 text-primary mx-auto mb-1" />
                          <span className="text-xs text-muted-foreground">Kamera {i + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Tracking-Links (nach dem Erstellen aktiv):</p>
                {Array.from({ length: cameras }).map((_, i) => (
                  <div key={i} className="glass-card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <QrCode className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Kamera {i + 1}</div>
                        <div className="text-xs text-muted-foreground font-mono">/track?cam={i}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
          </Button>
          {step === 0 ? (
            <div /> // Type selection handles its own navigation
          ) : step < lastStep ? (
            <Button variant="hero" onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Weiter <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button variant="hero" onClick={handleCreate} disabled={createMatch.isPending}>
              {createMatch.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {isTraining ? "Training erstellen" : "Spiel erstellen"}
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
