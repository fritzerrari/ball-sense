import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Calendar, Users, Camera, QrCode, Loader2, Check, Dumbbell, Swords, ShieldCheck, EyeOff } from "lucide-react";
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

const MATCH_POSITIONS = [
  "", "TW", "IV", "LV", "RV", "LIV", "RIV",
  "ZDM", "ZM", "LM", "RM", "ZOM",
  "LA", "RA", "ST", "HS",
];

export default function NewMatch() {
  const navigate = useNavigate();
  const { clubName } = useAuth();
  const { data: players } = usePlayers();
  const { data: fields } = useFields();
  const createMatch = useCreateMatch();

  const [matchType, setMatchType] = useState<"match" | "training">("match");
  const [step, setStep] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [kickoff, setKickoff] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [awayName, setAwayName] = useState("");
  const [homeFormation, setHomeFormation] = useState("4-4-2");
  const [awayFormation, setAwayFormation] = useState("4-4-2");
  const [homeStarters, setHomeStarters] = useState<Set<string>>(new Set());
  const [homeBench, setHomeBench] = useState<Set<string>>(new Set());
  const [shirtNumbers, setShirtNumbers] = useState<Record<string, number>>({});
  const [trainingPlayers, setTrainingPlayers] = useState<Set<string>>(new Set());
  const [excludedPlayers, setExcludedPlayers] = useState<Set<string>>(new Set());
  const [guestPlayers, setGuestPlayers] = useState<GuestPlayer[]>(
    Array.from({ length: 11 }, (_, i) => ({ name: "", number: String(i + 1), position: "" })),
  );
  const [cameras, setCameras] = useState(3);
  const [consentPlayersConfirmed, setConsentPlayersConfirmed] = useState(false);
  const [consentMinorsConfirmed, setConsentMinorsConfirmed] = useState(false);
  const [trackOpponent, setTrackOpponent] = useState(false);
  const [opponentConsentConfirmed, setOpponentConsentConfirmed] = useState(false);

  const activePlayers = (players ?? []).filter((player) => player.active);
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

  const lastStep = steps.length - 1;

  useEffect(() => {
    if (fields && fields.length > 0 && !fieldId) {
      setFieldId(fields[0].id);
    }
  }, [fields, fieldId]);

  const getShirtNumber = (playerId: string) => {
    if (shirtNumbers[playerId] !== undefined) return shirtNumbers[playerId];
    const player = activePlayers.find((entry) => entry.id === playerId);
    return player?.number ?? 0;
  };

  const toggleStarter = (playerId: string) => {
    const next = new Set(homeStarters);
    if (next.has(playerId)) {
      next.delete(playerId);
    } else {
      if (next.size >= 11) {
        toast.error("Maximal 11 Startspieler");
        return;
      }
      next.add(playerId);
      const bench = new Set(homeBench);
      bench.delete(playerId);
      setHomeBench(bench);
    }
    setHomeStarters(next);
  };

  const toggleBench = (playerId: string) => {
    const next = new Set(homeBench);
    if (next.has(playerId)) {
      next.delete(playerId);
    } else {
      if (next.size >= 7) {
        toast.error("Maximal 7 Auswechselspieler");
        return;
      }
      next.add(playerId);
      const starters = new Set(homeStarters);
      starters.delete(playerId);
      setHomeStarters(starters);
    }
    setHomeBench(next);
  };

  const toggleTrainingPlayer = (playerId: string) => {
    const next = new Set(trainingPlayers);
    if (next.has(playerId)) next.delete(playerId);
    else next.add(playerId);
    setTrainingPlayers(next);
  };

  const toggleExcludedPlayer = (playerId: string) => {
    const next = new Set(excludedPlayers);
    if (next.has(playerId)) next.delete(playerId);
    else next.add(playerId);
    setExcludedPlayers(next);
  };

  const updateGuestPlayer = (index: number, field: keyof GuestPlayer, value: string) => {
    const next = [...guestPlayers];
    next[index] = { ...next[index], [field]: value };
    setGuestPlayers(next);
  };

  const addGuestRow = () => {
    setGuestPlayers([...guestPlayers, { name: "", number: String(guestPlayers.length + 1), position: "" }]);
  };

  const canProceed = () => {
    if (step === 0) return true;
    if (step === 1) {
      return Boolean(date && fieldId && consentPlayersConfirmed && consentMinorsConfirmed && (!trackOpponent || opponentConsentConfirmed));
    }
    if (isTraining && step === 2) return trainingPlayers.size >= 1;
    return true;
  };

  const handleCreate = async () => {
    if (!fieldId) {
      toast.error("Bitte wähle einen Platz");
      return;
    }
    if (!consentPlayersConfirmed || !consentMinorsConfirmed || (trackOpponent && !opponentConsentConfirmed)) {
      toast.error("Bitte bestätige zuerst die Einwilligungen");
      return;
    }

    const lineups: any[] = [];

    if (isTraining) {
      trainingPlayers.forEach((playerId) => {
        const player = activePlayers.find((entry) => entry.id === playerId);
        lineups.push({
          player_id: playerId,
          team: "home",
          starting: true,
          shirt_number: getShirtNumber(playerId),
          player_name: player?.name ?? null,
          excluded_from_tracking: excludedPlayers.has(playerId),
        });
      });
    } else {
      homeStarters.forEach((playerId) => {
        const player = activePlayers.find((entry) => entry.id === playerId);
        lineups.push({
          player_id: playerId,
          team: "home",
          starting: true,
          shirt_number: getShirtNumber(playerId),
          player_name: player?.name ?? null,
          excluded_from_tracking: excludedPlayers.has(playerId),
        });
      });

      homeBench.forEach((playerId) => {
        const player = activePlayers.find((entry) => entry.id === playerId);
        lineups.push({
          player_id: playerId,
          team: "home",
          starting: false,
          shirt_number: getShirtNumber(playerId),
          player_name: player?.name ?? null,
          excluded_from_tracking: excludedPlayers.has(playerId),
        });
      });

      if (trackOpponent) {
        guestPlayers.filter((player) => player.name.trim()).forEach((player) => {
          lineups.push({
            player_id: null,
            team: "away",
            starting: true,
            shirt_number: player.number ? parseInt(player.number, 10) : null,
            player_name: player.name.trim(),
            excluded_from_tracking: false,
          });
        });
      }
    }

    const newMatch = await createMatch.mutateAsync({
      date,
      kickoff: kickoff || undefined,
      field_id: fieldId,
      away_club_name: isTraining ? undefined : awayName || undefined,
      home_formation: isTraining ? undefined : homeFormation,
      away_formation: isTraining ? undefined : awayFormation,
      match_type: matchType,
      consent_players_confirmed: consentPlayersConfirmed,
      consent_minors_confirmed: consentMinorsConfirmed,
      track_opponent: trackOpponent,
      opponent_consent_confirmed: trackOpponent ? opponentConsentConfirmed : false,
      lineups,
    });

    navigate(`/matches/${newMatch.id}`);
  };

  const selectedHomeCount = homeStarters.size + homeBench.size;

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/matches" className="rounded-lg p-2 transition-colors hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold font-display">{isTraining && step > 0 ? "Neues Training" : "Neues Spiel / Training"}</h1>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {steps.map((currentStep, index) => (
            <div key={currentStep.label} className="flex flex-1 items-center gap-1 sm:gap-2">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold font-display transition-colors ${
                index === step ? "bg-primary text-primary-foreground" : index < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {index < step ? <Check className="h-4 w-4" /> : <currentStep.icon className="h-4 w-4 sm:hidden" />}
              </div>
              <span className="hidden text-xs text-muted-foreground sm:block">{currentStep.label}</span>
              {index < steps.length - 1 && <div className={`h-px flex-1 ${index < step ? "bg-primary/30" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="glass-card space-y-5 p-6">
          {step === 0 && (
            <>
              <h2 className="text-lg font-semibold font-display">Was möchtest du aufzeichnen?</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <button onClick={() => { setMatchType("match"); setStep(1); }} className="glass-card group p-6 text-left transition-all hover:border-primary/40">
                  <Swords className="mb-3 h-10 w-10 text-primary transition-transform group-hover:scale-110" />
                  <h3 className="mb-1 font-semibold font-display">Spiel</h3>
                  <p className="text-sm text-muted-foreground">Wettkampf mit Einwilligungscheck, Startelf, Gegnerdaten und vollständiger Analyse.</p>
                </button>
                <button onClick={() => { setMatchType("training"); setStep(1); }} className="glass-card group p-6 text-left transition-all hover:border-primary/40">
                  <Dumbbell className="mb-3 h-10 w-10 text-primary transition-transform group-hover:scale-110" />
                  <h3 className="mb-1 font-semibold font-display">Training</h3>
                  <p className="text-sm text-muted-foreground">Trainingseinheit mit klarer Einwilligungsbestätigung und optionalem Tracking-Ausschluss einzelner Spieler.</p>
                </button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" /> {isTraining ? "Training-Details" : "Spiel-Details"}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">Datum *</label>
                  <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">{isTraining ? "Uhrzeit" : "Anstoß"}</label>
                  <input type="time" value={kickoff} onChange={(event) => setKickoff(event.target.value)} className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Platz *</label>
                <select value={fieldId} onChange={(event) => setFieldId(event.target.value)} className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
                  {!fields?.length && <option value="">Kein Platz verfügbar</option>}
                  {(fields ?? []).map((field) => (
                    <option key={field.id} value={field.id}>{field.name} ({field.width_m}×{field.height_m}m)</option>
                  ))}
                </select>
                {!fields?.length && <p className="mt-1 text-xs text-destructive">Bitte lege zuerst einen <Link to="/fields" className="underline">Platz</Link> an.</p>}
              </div>

              {!isTraining && (
                <>
                  <div>
                    <label className="mb-1 block text-sm text-muted-foreground">Heim</label>
                    <input type="text" value={clubName ?? ""} disabled className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground/50" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-muted-foreground">Gegner</label>
                    <input type="text" value={awayName} onChange={(event) => setAwayName(event.target.value)} placeholder="Vereinsname eingeben..." className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-muted-foreground">Formation Heim</label>
                      <select value={homeFormation} onChange={(event) => setHomeFormation(event.target.value)} className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
                        {FORMATIONS.map((formation) => <option key={formation}>{formation}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-muted-foreground">Formation Gast</label>
                      <select value={awayFormation} onChange={(event) => setAwayFormation(event.target.value)} className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
                        {FORMATIONS.map((formation) => <option key={formation}>{formation}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Einwilligungen & Datenschutz
                </div>

                <label className="flex items-start gap-3 text-sm text-foreground">
                  <Checkbox checked={consentPlayersConfirmed} onCheckedChange={(value) => setConsentPlayersConfirmed(Boolean(value))} />
                  <span>Ich bestätige, dass alle getrackten Spieler eingewilligt haben.</span>
                </label>

                <label className="flex items-start gap-3 text-sm text-foreground">
                  <Checkbox checked={consentMinorsConfirmed} onCheckedChange={(value) => setConsentMinorsConfirmed(Boolean(value))} />
                  <span>Ich bestätige, dass alle Spieler volljährig sind oder eine wirksame Eltern-Einwilligung vorliegt.</span>
                </label>

                {!isTraining && (
                  <>
                    <label className="flex items-start gap-3 text-sm text-foreground">
                      <Checkbox checked={trackOpponent} onCheckedChange={(value) => setTrackOpponent(Boolean(value))} />
                      <span>Auch die gegnerische Mannschaft soll getrackt werden.</span>
                    </label>
                    {trackOpponent && (
                      <label className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
                        <Checkbox checked={opponentConsentConfirmed} onCheckedChange={(value) => setOpponentConsentConfirmed(Boolean(value))} />
                        <span>Ich bestätige, dass auch für die gegnerische Mannschaft die nötige Einwilligung vorliegt.</span>
                      </label>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {step === 2 && isTraining && (
            <>
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Spieler auswählen
              </h2>
              <p className="text-sm text-muted-foreground">Wähle mindestens 1 Spieler für das Training aus und schließe bei Bedarf einzelne Spieler vom Tracking aus.</p>
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {activePlayers.map((player) => {
                  const isSelected = trainingPlayers.has(player.id);
                  const isExcluded = excludedPlayers.has(player.id);
                  return (
                    <div key={player.id} className={`rounded-lg border p-3 ${isSelected ? "border-primary/30 bg-primary/5" : "border-border/50"}`}>
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleTrainingPlayer(player.id)} className="flex flex-1 items-center gap-3 text-left">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                            {player.number ?? "—"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{player.name}</div>
                            <div className="text-xs text-muted-foreground">{player.position ?? "—"}</div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                        {isSelected && (
                          <Button variant={isExcluded ? "hero" : "heroOutline"} size="sm" onClick={() => toggleExcludedPlayer(player.id)}>
                            <EyeOff className="mr-1 h-4 w-4" /> {isExcluded ? "Ausgeschlossen" : "Tracking aus"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && !isTraining && (
            <>
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Aufstellung Heim
              </h2>
              <p className="text-sm text-muted-foreground">Startelf: {homeStarters.size}/11 · Bank: {homeBench.size}/7 · Ausgewählt: {selectedHomeCount}</p>
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {activePlayers.map((player) => {
                  const isStarter = homeStarters.has(player.id);
                  const isBench = homeBench.has(player.id);
                  const isSelected = isStarter || isBench;
                  const isExcluded = excludedPlayers.has(player.id);
                  return (
                    <div key={player.id} className={`rounded-lg border p-3 ${isStarter ? "border-primary/30 bg-primary/5" : isBench ? "border-border bg-muted/30" : "border-border/50"}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10">
                          <input type="number" value={getShirtNumber(player.id)} onChange={(event) => setShirtNumbers({ ...shirtNumbers, [player.id]: parseInt(event.target.value, 10) || 0 })} className="w-full bg-transparent text-center text-sm text-foreground outline-none" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{player.name}</div>
                          <div className="text-xs text-muted-foreground">{player.position ?? "—"}</div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button onClick={() => toggleStarter(player.id)} className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${isStarter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>Start</button>
                          <button onClick={() => toggleBench(player.id)} className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${isBench ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>Bank</button>
                          {isSelected && (
                            <button onClick={() => toggleExcludedPlayer(player.id)} className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${isExcluded ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                              {isExcluded ? "Tracking aus" : "Ausschließen"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {step === 3 && !isTraining && (
            <>
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Aufstellung Gast {awayName && `— ${awayName}`}
              </h2>
              <p className="text-sm text-muted-foreground">{trackOpponent ? "Gegner wird mitgetrackt — nur Spieler mit vorliegender Einwilligung eintragen." : "Optional: Gegnerdaten können ohne Tracking als Spielkontext leer bleiben."}</p>
              {!trackOpponent ? (
                <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Gegner-Tracking ist deaktiviert. Falls du den Gegner tracken willst, aktiviere dies bei den Einwilligungen im Schritt Details.
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {guestPlayers.map((guestPlayer, index) => (
                      <div key={index} className="flex gap-2">
                        <input type="number" placeholder="#" value={guestPlayer.number} onChange={(event) => updateGuestPlayer(index, "number", event.target.value)} className="w-14 rounded-lg border border-border bg-muted px-2 py-2 text-center text-sm text-foreground" />
                        <input type="text" placeholder={`Spieler ${index + 1}`} value={guestPlayer.name} onChange={(event) => updateGuestPlayer(index, "name", event.target.value)} className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                        <input type="text" placeholder="Pos" value={guestPlayer.position} onChange={(event) => updateGuestPlayer(index, "position", event.target.value)} className="w-16 rounded-lg border border-border bg-muted px-2 py-2 text-center text-sm text-foreground placeholder:text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" onClick={addGuestRow}>+ Weiteren Spieler</Button>
                </>
              )}
            </>
          )}

          {step === lastStep && (
            <>
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" /> Kamera-Setup
              </h2>
              <div>
                <label className="mb-2 block text-sm text-muted-foreground">Anzahl Kameras</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((count) => (
                    <button key={count} onClick={() => setCameras(count)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${cameras === count ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {count} Kamera{count > 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
              </div>
              <div className="glass-card flex items-start gap-2 p-4 text-sm text-muted-foreground">
                <Camera className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{isTraining ? "1 Kamera reicht für Trainingseinheiten meist aus." : "Empfehlung: 3 Kameras für vollständige Abdeckung des gesamten Spielfelds."}</span>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="relative aspect-[105/68] rounded border-2 border-primary/20">
                  <div className="absolute inset-0 flex">
                    {Array.from({ length: cameras }).map((_, index) => (
                      <div key={index} className="flex flex-1 items-center justify-center border-r border-primary/20 last:border-r-0">
                        <div className="text-center">
                          <Camera className="mx-auto mb-1 h-5 w-5 text-primary" />
                          <span className="text-xs text-muted-foreground">Kamera {index + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Tracking-Links (nach dem Erstellen aktiv):</p>
                {Array.from({ length: cameras }).map((_, index) => (
                  <div key={index} className="glass-card flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <QrCode className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Kamera {index + 1}</div>
                        <div className="font-mono text-xs text-muted-foreground">/matches/:id/track?cam={index}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Zurück
          </Button>
          {step === 0 ? (
            <div />
          ) : step < lastStep ? (
            <Button variant="hero" onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Weiter <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button variant="hero" onClick={() => void handleCreate()} disabled={createMatch.isPending}>
              {createMatch.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {isTraining ? "Training erstellen" : "Spiel erstellen"}
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
