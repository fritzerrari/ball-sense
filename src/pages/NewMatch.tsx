import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft, Calendar, Upload, Video, Loader2,
  Swords, ArrowRight, Sparkles, FileVideo, ImageIcon, Search, CheckCircle2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useFields } from "@/hooks/use-fields";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { captureFramesFromFile, type FrameCaptureResult } from "@/lib/frame-capture";
import MatchRecordingChoice from "@/components/MatchRecordingChoice";
import CameraCodeShare from "@/components/CameraCodeShare";

type Step = "info" | "choice" | "code" | "upload" | "processing";

export default function NewMatch() {
  const navigate = useNavigate();
  const { clubId } = useAuth();
  const { data: fields } = useFields();

  const [step, setStep] = useState<Step>("info");

  // Step 1: Match info
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [fieldId, setFieldId] = useState("");
  const [awayName, setAwayName] = useState("");
  const [teamIdentity, setTeamIdentity] = useState<string>("");
  const [homeJerseyColor, setHomeJerseyColor] = useState<string>("#22c55e");
  const [awayJerseyColor, setAwayJerseyColor] = useState<string>("#ef4444");

  const [creating, setCreating] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);

  // Football-API opponent suggestion
  const [oppSuggesting, setOppSuggesting] = useState(false);
  const [oppSuggestions, setOppSuggestions] = useState<any[]>([]);
  const [selectedOpp, setSelectedOpp] = useState<{ id: number; name: string; logo: string; form?: any } | null>(null);

  // 🆕 Club-Teams library
  const [clubTeams, setClubTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [nextFixture, setNextFixture] = useState<any | null>(null);

  useEffect(() => {
    if (!clubId) return;
    supabase
      .from("club_teams")
      .select("id, name, age_group, league, is_default")
      .eq("club_id", clubId)
      .eq("active", true)
      .order("is_default", { ascending: false })
      .order("name")
      .then(({ data }) => {
        const list = data ?? [];
        setClubTeams(list);
        const def = list.find((t: any) => t.is_default) || list[0];
        if (def && !selectedTeamId) setSelectedTeamId(def.id);
      });
  }, [clubId]);

  useEffect(() => {
    if (!selectedTeamId) { setNextFixture(null); return; }
    supabase
      .from("team_fixtures")
      .select("*")
      .eq("team_id", selectedTeamId)
      .eq("status", "scheduled")
      .gte("match_date", new Date().toISOString().split("T")[0])
      .order("match_date", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setNextFixture(data);
        if (data) {
          setDate(data.match_date);
          const opp = data.is_home ? data.away_team_name : data.home_team_name;
          if (opp && !awayName) setAwayName(opp);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamId]);


  const searchOpponent = useCallback(async () => {
    if (!awayName || awayName.length < 3) return;
    setOppSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("api-football", {
        body: { action: "search_team", query: awayName, country: "Germany", club_id: clubId },
      });
      if (error) throw error;
      setOppSuggestions((data?.teams ?? []).slice(0, 5));
    } catch {
      setOppSuggestions([]);
    } finally {
      setOppSuggesting(false);
    }
  }, [awayName, clubId]);

  const pickOpponent = (t: any) => {
    setSelectedOpp({ id: t.team?.id, name: t.team?.name, logo: t.team?.logo });
    setAwayName(t.team?.name ?? awayName);
    setOppSuggestions([]);
  };

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fields?.length && !fieldId) setFieldId(fields[0].id);
  }, [fields, fieldId]);

  const handleCreateMatch = async () => {
    if (!fieldId || !clubId) {
      toast.error("Bitte wähle einen Platz");
      return;
    }
    setCreating(true);
    try {
      const { data: newMatch, error } = await supabase
        .from("matches")
        .insert({
          date,
          field_id: fieldId,
          away_club_name: awayName || null,
          home_club_id: clubId,
          match_type: "match",
          status: "setup",
          consent_players_confirmed: true,
          consent_minors_confirmed: true,
          team_identity: teamIdentity || null,
          home_jersey_color: homeJerseyColor || null,
          away_jersey_color: awayJerseyColor || null,
          opponent_logo_url: selectedOpp?.logo ?? null,
          opponent_api_team_id: selectedOpp?.id ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      setMatchId(newMatch.id);
      setStep("choice");
      toast.success("Spiel angelegt! Die Feldkalibrierung läuft automatisch beim Aufnahmestart.");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Erstellen");
    } finally {
      setCreating(false);
    }
  };

  const analyzeFrames = useCallback(async (captureResult: FrameCaptureResult) => {
    if (!matchId || !clubId) return;

    setStatusText("Frames werden gespeichert…");
    setUploadProgress(75);

    try {
      const framesJson = JSON.stringify({
        frames: captureResult.frames,
        duration_sec: captureResult.durationSec,
        captured_at: new Date().toISOString(),
      });
      await supabase.storage
        .from("match-frames")
        .upload(`${matchId}.json`, new Blob([framesJson], { type: "application/json" }), { upsert: true });

      setStatusText("Analyse wird gestartet…");
      setUploadProgress(85);

      const { data: job, error: jobError } = await supabase.from("analysis_jobs").insert({
        match_id: matchId,
        status: "queued",
        progress: 0,
      }).select().single();
      if (jobError) throw jobError;

      await supabase.from("matches").update({ status: "processing" }).eq("id", matchId);
      setUploadProgress(90);

      // Invoke analyze-match WITHOUT inline frames — it loads from storage
      const { error: fnError } = await supabase.functions.invoke("analyze-match", {
        body: {
          match_id: matchId,
          job_id: job.id,
          duration_sec: captureResult.durationSec,
        },
      });
      if (fnError) console.error("analyze-match error:", fnError);

      setUploadProgress(100);
      setStep("processing");
      toast.success("Analyse gestartet!");
      setTimeout(() => navigate(`/matches/${matchId}/processing`), 1000);
    } catch (err: any) {
      toast.error(err.message ?? "Analyse konnte nicht gestartet werden");
      setUploading(false);
    }
  }, [matchId, clubId, navigate]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setStatusText("Frames werden extrahiert…");

    try {
      const result = await captureFramesFromFile(file, (pct) => {
        setUploadProgress(Math.round(pct * 0.7));
        setStatusText(`Frame ${Math.round(pct)}% extrahiert…`);
      });

      if (result.frames.length === 0) throw new Error("Keine Frames konnten extrahiert werden");

      setStatusText(`${result.frames.length} Frames extrahiert`);
      await analyzeFrames(result);
    } catch (err: any) {
      toast.error(err.message ?? "Frame-Extraktion fehlgeschlagen");
      setUploading(false);
    }
  };

  const handleRecordingChoice = (mode: "self" | "helper" | "upload" | "external") => {
    if (mode === "self" && matchId) {
      navigate(`/camera/${matchId}/track`);
    } else if (mode === "external" && matchId) {
      navigate(`/camera/${matchId}/track?mode=external`);
    } else if (mode === "helper") {
      setStep("code");
    } else {
      setStep("upload");
    }
  };

  const steps: Step[] = ["info", "choice", step === "code" ? "code" : "upload", "processing"];
  const currentIndex = steps.indexOf(step);
  const canProceed = Boolean(date && fieldId);

  return (
    <AppLayout>
      <div className="mx-auto max-w-xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/matches" className="rounded-lg p-2 transition-colors hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-display">Neues Spiel</h1>
            <p className="text-xs text-muted-foreground">
              {step === "info" && "In 30 Sekunden startklar"}
              {step === "choice" && "Wähle die Aufnahme-Methode"}
              {step === "code" && "Code an deinen Helfer senden"}
              {step === "upload" && "Video hochladen"}
              {step === "processing" && "Analyse läuft automatisch"}
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
              i === currentIndex ? "bg-primary" :
              i < currentIndex ? "bg-primary/40" : "bg-muted"
            }`} />
          ))}
        </div>

        {/* Step 1: Match Info */}
        {step === "info" && (
          <div className="glass-card space-y-5 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Swords className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold font-display">Matchdaten</h2>
                <p className="text-xs text-muted-foreground">Nur das Wichtigste</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Gegner (optional)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={awayName}
                    onChange={(e) => { setAwayName(e.target.value); setSelectedOpp(null); }}
                    onBlur={() => awayName.length >= 3 && !selectedOpp && searchOpponent()}
                    placeholder="z.B. FC Musterstadt"
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 h-12 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50"
                  />
                  <button
                    type="button"
                    onClick={searchOpponent}
                    disabled={oppSuggesting || awayName.length < 3}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 hover:bg-primary/10 disabled:opacity-30"
                    aria-label="Gegner suchen"
                  >
                    {oppSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </button>
                </div>
                {selectedOpp && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1.5 text-xs">
                    {selectedOpp.logo && <img src={selectedOpp.logo} alt="" className="h-5 w-5 object-contain" />}
                    <span className="font-medium">{selectedOpp.name}</span>
                    <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />
                  </div>
                )}
                {oppSuggestions.length > 0 && !selectedOpp && (
                  <div className="mt-2 space-y-1 rounded-lg border border-border bg-card p-1 max-h-44 overflow-auto">
                    {oppSuggestions.map((t: any) => (
                      <button
                        key={t.team?.id}
                        type="button"
                        onClick={() => pickOpponent(t)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-primary/10"
                      >
                        {t.team?.logo && <img src={t.team.logo} alt="" className="h-5 w-5 object-contain" />}
                        <span className="font-medium">{t.team?.name}</span>
                        <span className="ml-auto text-muted-foreground">{t.team?.country}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Datum *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 h-12 text-sm text-foreground"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Platz *</label>
              <select
                value={fieldId}
                onChange={(e) => setFieldId(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 h-12 text-sm text-foreground"
              >
                {!fields?.length && <option value="">Kein Platz</option>}
                {(fields ?? []).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Trikotfarben — hilft der KI, beide Teams sicher zu unterscheiden */}
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Trikotfarben
                <span className="text-xs text-muted-foreground/70 ml-1">— hilft der KI bei der Team-Zuordnung</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted px-3 py-2.5 h-12">
                  <input
                    type="color"
                    value={homeJerseyColor}
                    onChange={(e) => setHomeJerseyColor(e.target.value)}
                    className="h-7 w-10 rounded cursor-pointer border-0 bg-transparent"
                    aria-label="Heim-Trikotfarbe"
                  />
                  <span className="text-sm text-foreground">Heim</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted px-3 py-2.5 h-12">
                  <input
                    type="color"
                    value={awayJerseyColor}
                    onChange={(e) => setAwayJerseyColor(e.target.value)}
                    className="h-7 w-10 rounded cursor-pointer border-0 bg-transparent"
                    aria-label="Auswärts-Trikotfarbe"
                  />
                  <span className="text-sm text-foreground">Gast</span>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Spielidentität (Team-DNA)
                <span className="text-xs text-muted-foreground/70 ml-1">— wie wollt ihr spielen?</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "pressing", label: "Pressing", emoji: "🔥" },
                  { key: "ballbesitz", label: "Ballbesitz", emoji: "⚙️" },
                  { key: "umschalt", label: "Umschalten", emoji: "⚡" },
                  { key: "defensiv", label: "Defensiv-kompakt", emoji: "🛡️" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setTeamIdentity(teamIdentity === opt.key ? "" : opt.key)}
                    className={`rounded-lg border px-3 py-2.5 text-sm text-left transition-all ${
                      teamIdentity === opt.key
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-muted hover:border-primary/40"
                    }`}
                  >
                    <span className="mr-1.5">{opt.emoji}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                Optional — das Cockpit bewertet dann, wie nah ihr an eurer DNA gespielt habt.
              </p>
            </div>

            <Button
              onClick={() => { if (navigator.vibrate) navigator.vibrate(20); handleCreateMatch(); }}
              disabled={!canProceed || creating}
              className="w-full gap-2 h-12 md:h-14 text-base sticky bottom-20 md:static z-10 shadow-lg md:shadow-none active:scale-[0.98] transition-transform"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Weiter
            </Button>
          </div>
        )}

        {/* Step 2: Recording Choice */}
        {step === "choice" && (
          <MatchRecordingChoice onSelect={handleRecordingChoice} />
        )}

        {/* Step 3: Camera Code Share */}
        {step === "code" && matchId && (
          <CameraCodeShare
            matchId={matchId}
            onDone={() => navigate(`/matches/${matchId}`)}
          />
        )}

        {/* Step 3 alt: File Upload */}
        {step === "upload" && !uploading && (
          <div className="glass-card p-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <FileVideo className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold font-display">Spielvideo hochladen</h3>
              <p className="text-sm text-muted-foreground mt-1">
                MP4, MOV oder WebM — es werden nur Standbilder extrahiert
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} size="lg" className="w-full gap-2 h-14 text-base">
              <Upload className="h-5 w-5" /> Datei auswählen
            </Button>
            <p className="text-xs text-muted-foreground">
              <ImageIcon className="inline h-3 w-3 mr-1" />
              Das Video wird nicht hochgeladen — nur Einzelbilder alle 30 Sek.
            </p>
          </div>
        )}

        {/* Uploading state */}
        {uploading && (
          <div className="glass-card p-8 space-y-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <div>
              <h3 className="font-semibold font-display">{statusText || "Verarbeitung…"}</h3>
              <p className="text-sm text-muted-foreground mt-1">Bitte nicht schließen.</p>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {/* Step 4: Processing redirect */}
        {step === "processing" && (
          <div className="glass-card p-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold font-display text-lg">Analyse gestartet!</h3>
              <p className="text-sm text-muted-foreground mt-1">Du wirst zum Fortschritt weitergeleitet…</p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
