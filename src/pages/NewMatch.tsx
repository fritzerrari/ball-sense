import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import {
  ArrowLeft, ArrowRight, Calendar, Users, Camera, Loader2, Check,
  Dumbbell, Swords, ShieldCheck, EyeOff, UserPlus, Copy, Share2,
  Rocket, SkipForward, Smartphone, Info,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { usePlayers } from "@/hooks/use-players";
import { useFields } from "@/hooks/use-fields";
import { useCreateMatch } from "@/hooks/use-matches";
import { useAuth } from "@/components/AuthProvider";
import { FORMATIONS } from "@/lib/constants";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  const { clubName, clubId, session } = useAuth();
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
  const [matchPositions, setMatchPositions] = useState<Record<string, string>>({});
  const [trainingPlayers, setTrainingPlayers] = useState<Set<string>>(new Set());
  const [excludedPlayers, setExcludedPlayers] = useState<Set<string>>(new Set());
  const [squadSize, setSquadSize] = useState(11);
  const [awaySquadSize, setAwaySquadSize] = useState(11);
  const [guestPlayers, setGuestPlayers] = useState<GuestPlayer[]>(
    Array.from({ length: 11 }, (_, i) => ({ name: "", number: String(i + 1), position: "" })),
  );
  const [cameras, setCameras] = useState(3);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [trackOpponent, setTrackOpponent] = useState(false);

  // Post-creation state
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [generatingCodes, setGeneratingCodes] = useState(false);

  const activePlayers = (players ?? []).filter((player) => player.active);
  const isTraining = matchType === "training";

  // 4-step wizard
  const wizardSteps = isTraining
    ? [
        { label: "Details", icon: Dumbbell },
        { label: "Spieler", icon: Users },
        { label: "Kameras", icon: Camera },
        { label: "Fertig", icon: Rocket },
      ]
    : [
        { label: "Details", icon: Calendar },
        { label: "Aufstellung", icon: Users },
        { label: "Kameras", icon: Camera },
        { label: "Fertig", icon: Rocket },
      ];

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

  useEffect(() => {
    setGuestPlayers((prev) => {
      if (prev.length < awaySquadSize) {
        return [...prev, ...Array.from({ length: awaySquadSize - prev.length }, (_, i) => ({ name: "", number: String(prev.length + i + 1), position: "" }))];
      }
      return prev.slice(0, awaySquadSize);
    });
  }, [awaySquadSize]);

  const toggleStarter = (playerId: string) => {
    const next = new Set(homeStarters);
    if (next.has(playerId)) {
      next.delete(playerId);
    } else {
      if (next.size >= squadSize) {
        toast.error(`Maximal ${squadSize} Startspieler`);
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

  const handleSelectAllStarters = () => {
    const allIds = activePlayers.slice(0, squadSize).map(p => p.id);
    setHomeStarters(new Set(allIds));
    const bench = new Set(homeBench);
    allIds.forEach(id => bench.delete(id));
    setHomeBench(bench);
  };

  const handleSelectAllTraining = () => {
    if (trainingPlayers.size === activePlayers.length) {
      setTrainingPlayers(new Set());
    } else {
      setTrainingPlayers(new Set(activePlayers.map(p => p.id)));
    }
  };

  const handleClearStarters = () => {
    setHomeStarters(new Set());
  };

  const canProceed = () => {
    if (step === 0) return Boolean(date && fieldId && consentConfirmed);
    if (step === 1 && isTraining) return trainingPlayers.size >= 1;
    return true;
  };

  const generateCameraCode = (): string => {
    return String(Math.floor(100000 + Math.random() * 900000));
  };

  const handleCreate = async () => {
    if (!fieldId) {
      toast.error("Bitte wähle einen Platz");
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
      consent_players_confirmed: consentConfirmed,
      consent_minors_confirmed: consentConfirmed,
      track_opponent: trackOpponent,
      opponent_consent_confirmed: trackOpponent ? consentConfirmed : false,
      lineups,
    });

    setCreatedMatchId(newMatch.id);

    // Auto-generate camera codes
    setGeneratingCodes(true);
    const codes: string[] = [];
    try {
      for (let i = 0; i < cameras; i++) {
        const codeStr = generateCameraCode();
        codes.push(codeStr);
        const encoder = new TextEncoder();
        const data = encoder.encode(codeStr);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

        await supabase.from("camera_access_codes").insert({
          club_id: clubId!,
          code_hash: hashHex,
          label: `Kamera ${i + 1} – ${awayName || (isTraining ? "Training" : "Spiel")} ${date}`,
          created_by_user_id: session!.user.id,
        });
      }
      setGeneratedCodes(codes);
    } catch {
      toast.error("Codes konnten nicht generiert werden");
    }
    setGeneratingCodes(false);

    // Move to step 4 (Fertig)
    setStep(3);
  };

  const copyCode = (codeStr: string, index: number) => {
    navigator.clipboard.writeText(codeStr).then(() => {
      toast.success(`Code für Kamera ${index + 1} kopiert`);
    }).catch(() => {
      toast.error("Kopieren fehlgeschlagen");
    });
  };

  const shareCode = (codeStr: string, index: number) => {
    const url = `${window.location.origin}/camera/${createdMatchId}/track?cam=${index}`;
    const text = `FieldIQ Kamera ${index + 1}\nCode: ${codeStr}\nLink: ${url}`;
    if (navigator.share) {
      navigator.share({ title: `Kamera ${index + 1}`, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => toast.success("Code & Link kopiert"));
    }
  };

  const shareAllCodes = () => {
    const text = generatedCodes.map((c, i) => {
      const url = `${window.location.origin}/camera/${createdMatchId}/track?cam=${i}`;
      return `Kamera ${i + 1}: ${c}\n${url}`;
    }).join("\n\n");
    const fullText = `FieldIQ Kamera-Codes\n${awayName ? `${clubName} vs ${awayName}` : isTraining ? "Training" : "Spiel"} · ${new Date(date).toLocaleDateString("de-DE")}\n\n${text}`;

    if (navigator.share) {
      navigator.share({ title: "FieldIQ Kamera-Codes", text: fullText }).catch(() => {});
    } else {
      navigator.clipboard.writeText(fullText).then(() => toast.success("Alle Codes kopiert!"));
    }
  };

  const selectedHomeCount = homeStarters.size + homeBench.size;

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/matches" className="rounded-lg p-2 transition-colors hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold font-display truncate">
              {isTraining ? "Neues Training" : "Neues Spiel"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {step === 0 && "Was, wann, wo?"}
              {step === 1 && (isTraining ? "Wer macht mit?" : "Wer spielt?")}
              {step === 2 && "Wie viele Kameras?"}
              {step === 3 && "Codes verteilen & loslegen!"}
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1">
          {wizardSteps.map((ws, index) => (
            <div key={ws.label} className="flex flex-1 items-center gap-1">
              <button
                onClick={() => index < step && !createdMatchId && setStep(index)}
                disabled={index >= step || !!createdMatchId}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold font-display transition-all ${
                  index === step
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : index < step
                      ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {index < step ? <Check className="h-4 w-4" /> : index + 1}
              </button>
              <span className="hidden text-[11px] text-muted-foreground sm:block">{ws.label}</span>
              {index < wizardSteps.length - 1 && (
                <div className={`h-px flex-1 transition-colors ${index < step ? "bg-primary/40" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="glass-card space-y-5 p-6">
          {/* ─── Step 0: Details ─── */}
          {step === 0 && (
            <>
              {/* Type toggle */}
              <div className="flex gap-2 p-1 bg-muted rounded-xl">
                <button
                  onClick={() => setMatchType("match")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${matchType === "match" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Swords className="h-4 w-4" /> Spiel
                </button>
                <button
                  onClick={() => setMatchType("training")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${matchType === "training" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Dumbbell className="h-4 w-4" /> Training
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">Datum *</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">{isTraining ? "Uhrzeit" : "Anstoß"}</label>
                  <input type="time" value={kickoff} onChange={(e) => setKickoff(e.target.value)} className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Platz *</label>
                <select value={fieldId} onChange={(e) => setFieldId(e.target.value)} className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
                  {!fields?.length && <option value="">Kein Platz verfügbar</option>}
                  {(fields ?? []).map((field) => (
                    <option key={field.id} value={field.id}>{field.name} ({field.width_m}×{field.height_m}m)</option>
                  ))}
                </select>
                {!fields?.length && <p className="mt-1 text-xs text-destructive">Bitte lege zuerst einen <Link to="/fields" className="underline">Platz</Link> an.</p>}
              </div>

              {!isTraining && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-muted-foreground">Heim</label>
                      <input type="text" value={clubName ?? ""} disabled className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground/50" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-muted-foreground">Gegner</label>
                      <input type="text" value={awayName} onChange={(e) => setAwayName(e.target.value)} placeholder="Vereinsname..." className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-muted-foreground">Formation Heim</label>
                      <select value={homeFormation} onChange={(e) => setHomeFormation(e.target.value)} className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
                        {FORMATIONS.map((f) => <option key={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-muted-foreground">Formation Gast</label>
                      <select value={awayFormation} onChange={(e) => setAwayFormation(e.target.value)} className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
                        {FORMATIONS.map((f) => <option key={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Gegner auch tracken</span>
                    </div>
                    <Switch checked={trackOpponent} onCheckedChange={setTrackOpponent} />
                  </div>
                </>
              )}

              {/* Simplified single consent */}
              <label className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 cursor-pointer">
                <Switch checked={consentConfirmed} onCheckedChange={setConsentConfirmed} className="mt-0.5" />
                <div>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Einwilligungen bestätigt
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground leading-relaxed">
                    Alle getrackten Spieler (inkl. Minderjährige mit Eltern-Einwilligung{trackOpponent ? " und Gegner" : ""}) haben dem Tracking zugestimmt.
                  </span>
                </div>
              </label>
            </>
          )}

          {/* ─── Step 1: Players ─── */}
          {step === 1 && isTraining && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Spieler auswählen
                </h2>
                <Button variant="outline" size="sm" onClick={handleSelectAllTraining}>
                  <UserPlus className="mr-1 h-4 w-4" />
                  {trainingPlayers.size === activePlayers.length ? "Alle abwählen" : "Alle auswählen"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{trainingPlayers.size} Spieler ausgewählt.</p>
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {activePlayers.map((player) => {
                  const isSelected = trainingPlayers.has(player.id);
                  const isExcluded = excludedPlayers.has(player.id);
                  return (
                    <div key={player.id} className={`rounded-lg border p-3 transition-all ${isSelected ? "border-primary/30 bg-primary/5" : "border-border/50"}`}>
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

          {step === 1 && !isTraining && (
            <>
              {/* KI Auto-Discovery prominent option */}
              <button
                onClick={() => setStep(2)}
                className="w-full rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-5 text-left transition-all hover:border-primary/60 hover:bg-primary/10 group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary group-hover:bg-primary/30 transition-colors">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      KI erkennt Spieler automatisch
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">Empfohlen</span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground leading-relaxed">
                      Die KI erkennt beim Tracking automatisch wie viele Spieler auf dem Feld sind und ordnet sie den Teams zu. Ohne manuelle Eingabe.
                    </span>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-primary/60 group-hover:text-primary transition-colors" />
                </div>
              </button>

              <div className="relative flex items-center gap-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground">oder manuell aufstellen</span>
                <div className="flex-1 border-t border-border" />
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Aufstellung
                </h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAllStarters}>
                    <UserPlus className="mr-1 h-4 w-4" /> Alle als Starter
                  </Button>
                  {homeStarters.size > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleClearStarters}>Löschen</Button>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-muted-foreground">Spieleranzahl pro Team</label>
                <div className="flex flex-wrap gap-1.5">
                  {[5, 7, 9, 11].map((size) => (
                    <button key={size} onClick={() => setSquadSize(size)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${squadSize === size ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {size}er
                    </button>
                  ))}
                  <input type="number" min={1} max={15} value={squadSize} onChange={(e) => setSquadSize(Math.max(1, Math.min(15, parseInt(e.target.value, 10) || 11)))} className="w-16 rounded-lg border border-border bg-muted px-2 py-1.5 text-center text-sm text-foreground" title="Eigene Anzahl" />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">Startelf: {homeStarters.size}/{squadSize} · Bank: {homeBench.size}/7</p>

              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {activePlayers.map((player) => {
                  const isStarter = homeStarters.has(player.id);
                  const isBench = homeBench.has(player.id);
                  const isSelected = isStarter || isBench;
                  const isExcluded = excludedPlayers.has(player.id);
                  const currentPos = matchPositions[player.id] ?? player.position ?? "";
                  return (
                    <div key={player.id} className={`rounded-lg border p-3 transition-all ${isStarter ? "border-primary/30 bg-primary/5" : isBench ? "border-border bg-muted/30" : "border-border/50"}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10">
                          <input type="number" value={getShirtNumber(player.id)} onChange={(e) => setShirtNumbers({ ...shirtNumbers, [player.id]: parseInt(e.target.value, 10) || 0 })} className="w-full bg-transparent text-center text-sm text-foreground outline-none" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{player.name}</div>
                          {isSelected ? (
                            <select value={currentPos} onChange={(e) => setMatchPositions({ ...matchPositions, [player.id]: e.target.value })} className="mt-0.5 w-20 rounded border border-border/50 bg-transparent px-1 py-0.5 text-[10px] text-muted-foreground outline-none">
                              <option value="">Auto (KI)</option>
                              {MATCH_POSITIONS.filter(p => p).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          ) : (
                            <div className="text-xs text-muted-foreground">{player.position || "—"}</div>
                          )}
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

              {/* Guest section inline */}
              {trackOpponent && (
                <div className="border-t border-border pt-4 mt-4">
                  <h3 className="text-base font-semibold font-display flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-primary" /> Gast {awayName && `— ${awayName}`}
                  </h3>

                  <div className="mb-3">
                    <label className="mb-1.5 block text-sm text-muted-foreground">Spieleranzahl Gegner</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[5, 7, 9, 11].map((size) => (
                        <button key={size} onClick={() => setAwaySquadSize(size)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${awaySquadSize === size ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                          {size}er
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-primary/10 bg-primary/5 p-2 text-xs text-muted-foreground flex items-start gap-2 mb-3">
                    <span className="text-primary font-bold">🤖</span>
                    <span><strong>KI-Erkennung aktiv.</strong> Gegnerdaten sind optional.</span>
                  </div>

                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {guestPlayers.map((guestPlayer, index) => (
                      <div key={index} className="flex gap-2">
                        <input type="number" placeholder="#" value={guestPlayer.number} onChange={(e) => updateGuestPlayer(index, "number", e.target.value)} className="w-14 rounded-lg border border-border bg-muted px-2 py-2 text-center text-sm text-foreground" />
                        <input type="text" placeholder={`Spieler ${index + 1}`} value={guestPlayer.name} onChange={(e) => updateGuestPlayer(index, "name", e.target.value)} className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
                        <input type="text" placeholder="Pos" value={guestPlayer.position} onChange={(e) => updateGuestPlayer(index, "position", e.target.value)} className="w-16 rounded-lg border border-border bg-muted px-2 py-2 text-center text-sm text-foreground placeholder:text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" onClick={addGuestRow} className="mt-2">+ Weiteren Spieler</Button>
                </div>
              )}

              {!trackOpponent && !isTraining && (
                <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Gegner-Tracking ist deaktiviert. Aktiviere es im Schritt "Details".
                </div>
              )}
            </>
          )}

          {/* ─── Step 2: Cameras ─── */}
          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" /> Kamera-Setup
              </h2>

              <div>
                <label className="mb-2 block text-sm text-muted-foreground">Wie viele Smartphones nutzt du?</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((count) => (
                    <button key={count} onClick={() => setCameras(count)} className={`flex-1 rounded-xl p-4 text-center transition-all border ${cameras === count ? "border-primary bg-primary/10 shadow-sm shadow-primary/10" : "border-border bg-muted hover:bg-muted/80"}`}>
                      <Smartphone className={`mx-auto mb-1 h-6 w-6 ${cameras === count ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`block text-sm font-medium ${cameras === count ? "text-foreground" : "text-muted-foreground"}`}>{count}</span>
                      <span className="block text-[10px] text-muted-foreground mt-0.5">
                        {count === 1 ? "Basis" : count === 2 ? "Empfohlen" : "Optimal"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Field visualization */}
              <div className="rounded-xl bg-muted/50 p-4">
                <div className="relative aspect-[105/68] rounded-lg border-2 border-primary/20 overflow-hidden">
                  <div className="absolute inset-0 flex">
                    {Array.from({ length: cameras }).map((_, index) => (
                      <div key={index} className="flex flex-1 items-center justify-center border-r border-primary/10 last:border-r-0">
                        <div className="text-center">
                          <Camera className="mx-auto mb-1 h-5 w-5 text-primary" />
                          <span className="text-xs text-muted-foreground">Kamera {index + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-primary/10 bg-primary/5 p-3 text-xs text-muted-foreground">
                <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span>Die Kamera-Codes werden im nächsten Schritt automatisch generiert. Teile sie per Nachricht mit deinen Helfern.</span>
              </div>
            </>
          )}

          {/* ─── Step 3: Fertig ─── */}
          {step === 3 && (
            <>
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold font-display">{isTraining ? "Training erstellt!" : "Spiel erstellt!"}</h2>
                <p className="text-sm text-muted-foreground">Teile die Kamera-Codes mit deinen Helfern — fertig.</p>
              </div>

              {generatingCodes ? (
                <div className="flex items-center justify-center gap-2 py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Codes werden generiert…</span>
                </div>
              ) : (
                <>
                  {/* All codes sharing */}
                  {generatedCodes.length > 1 && (
                    <Button variant="outline" className="w-full" onClick={shareAllCodes}>
                      <Share2 className="mr-2 h-4 w-4" /> Alle Codes auf einmal teilen
                    </Button>
                  )}

                  <div className="space-y-3">
                    {generatedCodes.map((codeStr, i) => (
                      <div key={i} className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Camera className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold font-display text-sm">Kamera {i + 1}</p>
                            <p className="text-[11px] text-muted-foreground">Helfer öffnet den Link und gibt den Code ein</p>
                          </div>
                        </div>
                        <div className="text-center py-3 bg-muted rounded-xl">
                          <span className="text-3xl font-mono font-bold tracking-[0.3em] text-foreground">{codeStr}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => copyCode(codeStr, i)}>
                            <Copy className="mr-1.5 h-3.5 w-3.5" /> Kopieren
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1" onClick={() => shareCode(codeStr, i)}>
                            <Share2 className="mr-1.5 h-3.5 w-3.5" /> Teilen
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between gap-3">
          {step < 3 ? (
            <>
              <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Zurück
              </Button>

              <div className="flex gap-2">
                {/* Skip button for step 1 */}
                {step === 1 && !isTraining && (
                  <Button variant="ghost" onClick={() => setStep(2)}>
                    <SkipForward className="mr-1 h-4 w-4" /> Überspringen
                  </Button>
                )}

                {step < 2 ? (
                  <Button variant="hero" onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                    Weiter <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="hero" onClick={() => void handleCreate()} disabled={createMatch.isPending || !canProceed()}>
                    {createMatch.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    {isTraining ? "Training erstellen" : "Spiel erstellen"} <Rocket className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          ) : (
            /* Step 3 navigation */
            <div className="flex w-full gap-3">
              <Button variant="hero" size="lg" className="flex-1" onClick={() => navigate(`/matches/${createdMatchId}/track?cam=0`)}>
                <Camera className="mr-2 h-5 w-5" /> Selbst tracken
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate(`/matches/${createdMatchId}`)}>
                Zum Spiel
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
