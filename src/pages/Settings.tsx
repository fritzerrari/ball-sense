import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Building2, CreditCard, Save, Loader2, Check, KeyRound, Copy, ShieldCheck, Trash2, Power, BarChart3, Camera } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PLAN_CONFIG } from "@/lib/constants";
import type { PlanType } from "@/lib/types";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useMonthlyMatchCount } from "@/hooks/use-match-stats";
import { ClubLogoUpload } from "@/components/ClubLogoUpload";
import { useTranslation } from "@/lib/i18n";
import { Switch } from "@/components/ui/switch";
import { useBenchmarkOptIn } from "@/hooks/use-benchmark";
import { getUltraWidePreference, setUltraWidePreference } from "@/hooks/use-ultra-wide-camera";

async function hashCode(code: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function generateCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

type CameraCodeRow = {
  id: string;
  label: string;
  active: boolean;
  last_used_at: string | null;
  created_at: string;
};

export default function SettingsPage() {
  const { clubId, clubName, clubPlan, user } = useAuth();
  const { data: monthlyCount } = useMonthlyMatchCount();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [league, setLeague] = useState("");
  const [saving, setSaving] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [cameraCodes, setCameraCodes] = useState<CameraCodeRow[]>([]);
  const [cameraCodesLoading, setCameraCodesLoading] = useState(false);
  const [cameraLabel, setCameraLabel] = useState("");
  const [creatingCameraCode, setCreatingCameraCode] = useState(false);
  const [latestPlainCode, setLatestPlainCode] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!clubId) return;
    supabase.from("clubs").select("name, city, league").eq("id", clubId).single().then(({ data }) => {
      if (data) {
        setName(data.name ?? "");
        setCity(data.city ?? "");
        setLeague(data.league ?? "");
      }
    });
  }, [clubId]);

  const loadCameraCodes = async () => {
    if (!clubId) return;
    setCameraCodesLoading(true);
    const { data, error } = await supabase
      .from("camera_access_codes")
      .select("id, label, active, last_used_at, created_at")
      .eq("club_id", clubId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Kamera-Codes konnten nicht geladen werden");
    } else {
      setCameraCodes((data ?? []) as CameraCodeRow[]);
    }
    setCameraCodesLoading(false);
  };

  useEffect(() => {
    void loadCameraCodes();
  }, [clubId]);

  const handleSave = async () => {
    if (!clubId || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("clubs")
      .update({ name: name.trim(), city: city.trim() || null, league: league.trim() || null })
      .eq("id", clubId);
    setSaving(false);
    if (error) toast.error(t("settings.saveError"));
    else toast.success(t("settings.saved"));
  };

  const handleCreateCameraCode = async () => {
    if (!clubId || !user) return;
    const activeCount = cameraCodes.filter((code) => code.active).length;
    if (activeCount >= 3) {
      toast.error("Maximal 3 aktive Kamera-Codes gleichzeitig möglich");
      return;
    }

    const label = cameraLabel.trim() || `Kamera ${cameraCodes.length + 1}`;
    const plainCode = generateCode();
    const codeHash = await hashCode(plainCode);

    setCreatingCameraCode(true);
    const { error } = await supabase.from("camera_access_codes").insert({
      club_id: clubId,
      label,
      code_hash: codeHash,
      created_by_user_id: user.id,
      active: true,
    });
    setCreatingCameraCode(false);

    if (error) {
      toast.error("Kamera-Code konnte nicht angelegt werden");
      return;
    }

    setLatestPlainCode(plainCode);
    setCameraLabel("");
    toast.success("Kamera-Code erstellt");
    await loadCameraCodes();
  };

  const toggleCameraCode = async (code: CameraCodeRow) => {
    const { error } = await supabase.from("camera_access_codes").update({ active: !code.active }).eq("id", code.id);
    if (error) {
      toast.error("Status konnte nicht geändert werden");
      return;
    }
    await loadCameraCodes();
  };

  const deleteCameraCode = async (codeId: string) => {
    const { error } = await supabase.from("camera_access_codes").delete().eq("id", codeId);
    if (error) {
      toast.error("Kamera-Code konnte nicht gelöscht werden");
      return;
    }
    toast.success("Kamera-Code gelöscht");
    await loadCameraCodes();
  };

  const copyLatestCode = async () => {
    if (!latestPlainCode) return;
    await navigator.clipboard.writeText(latestPlainCode);
    toast.success("Code kopiert");
  };

  const plan = (clubPlan ?? "trial") as PlanType;
  const config = PLAN_CONFIG[plan];
  const maxMatches = config.maxMatches;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold font-display">{t("settings.title")}</h1>

        <div className="glass-card space-y-4 p-6">
          <h2 className="text-lg font-semibold font-display flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> {t("settings.clubData")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">{t("settings.clubName")}</label>
              <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="FC Musterstadt" className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">{t("settings.city")}</label>
              <input type="text" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Musterstadt" className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">{t("settings.league")}</label>
              <input type="text" value={league} onChange={(event) => setLeague(event.target.value)} placeholder="Regionalliga Bayern" className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm text-muted-foreground">{t("settings.logo")}</label>
            <ClubLogoUpload />
          </div>
          <Button variant="hero" size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            {t("common.save")}
          </Button>
        </div>

        <div className="glass-card space-y-4 p-6">
          <h2 className="text-lg font-semibold font-display flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Kamera-Zugänge
          </h2>
          <p className="text-sm text-muted-foreground">
            Erstelle bis zu 3 einfache Kamera-Codes für Smartphones am Spielfeldrand. Die Codes gelten nur für das Tracking.
          </p>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={cameraLabel}
              onChange={(event) => setCameraLabel(event.target.value)}
              placeholder="z. B. Hauptkamera oder linke Seite"
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <Button variant="hero" onClick={() => void handleCreateCameraCode()} disabled={creatingCameraCode || cameraCodes.filter((code) => code.active).length >= 3}>
              {creatingCameraCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Code erzeugen
            </Button>
          </div>

          {latestPlainCode && (
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary">Neuer Kamera-Code</p>
                  <p className="mt-1 font-display text-2xl tracking-[0.2em] text-foreground">{latestPlainCode}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Bitte jetzt sicher notieren — gespeichert wird nur der Hash.</p>
                </div>
                <Button variant="heroOutline" size="sm" onClick={() => void copyLatestCode()}>
                  <Copy className="mr-1 h-4 w-4" /> Kopieren
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {cameraCodesLoading ? (
              <div className="text-sm text-muted-foreground">Lade Kamera-Codes...</div>
            ) : cameraCodes.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Noch keine Kamera-Codes angelegt.</div>
            ) : (
              cameraCodes.map((code) => (
                <div key={code.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{code.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {code.active ? "Aktiv" : "Inaktiv"}
                      {code.last_used_at ? ` · zuletzt genutzt ${new Date(code.last_used_at).toLocaleString("de-DE")}` : " · noch unbenutzt"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="heroOutline" size="sm" onClick={() => void toggleCameraCode(code)}>
                      <Power className="mr-1 h-4 w-4" /> {code.active ? "Deaktivieren" : "Aktivieren"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void deleteCameraCode(code.id)}>
                      <Trash2 className="mr-1 h-4 w-4" /> Löschen
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Camera Settings */}
        <CameraSettingsSection />

        {/* Benchmark Opt-in — Pro only */}
        <BenchmarkOptInSection />


        <div className="glass-card space-y-4 p-6">
          <h2 className="text-lg font-semibold font-display flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> {t("settings.planBilling")}
          </h2>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-4">
            <div>
              <div className="font-medium font-display">{config.label}</div>
              <div className="text-sm text-muted-foreground">
                {config.price === 0 ? t("settings.freeTrialPhase") : `€${config.price}${t("settings.perMonth")}`}
              </div>
            </div>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {t("settings.current")}
            </span>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("settings.matchesThisMonth")}</span>
              <span className="text-sm font-medium">{monthlyCount ?? 0} / {maxMatches ?? "∞"}</span>
            </div>
            {maxMatches && (
              <div className="h-2 w-full rounded-full bg-muted">
                <div className={`h-full rounded-full transition-all ${(monthlyCount ?? 0) >= maxMatches ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(((monthlyCount ?? 0) / maxMatches) * 100, 100)}%` }} />
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(["starter", "club", "pro"] as PlanType[]).map((currentPlan) => {
              const currentConfig = PLAN_CONFIG[currentPlan];
              const isCurrent = currentPlan === plan;
              return (
                <div key={currentPlan} className={`rounded-lg border p-4 ${isCurrent ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                  <div className="mb-1 text-xs font-semibold tracking-wider text-muted-foreground">{currentConfig.label.toUpperCase()}</div>
                  <div className="text-2xl font-bold font-display">€{currentConfig.price}</div>
                  <div className="mb-2 text-xs text-muted-foreground">{t("settings.perMonth")}</div>
                  <div className="text-xs text-muted-foreground">{currentConfig.maxMatches ? `${currentConfig.maxMatches} ${t("settings.matchesPerMonth")}` : t("settings.unlimited")}</div>
                  {isCurrent ? (
                    <div className="mt-2 flex items-center gap-1 text-xs text-primary"><Check className="h-3 w-3" /> {t("settings.current")}</div>
                  ) : (
                    <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => setUpgradeOpen(true)}>{t("common.upgrade")}</Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} currentPlan={plan} />
    </AppLayout>
  );
}

function CameraSettingsSection() {
  const { language } = useTranslation();
  const [preferUltraWide, setPreferUltraWide] = useState(getUltraWidePreference);

  const handleToggle = (val: boolean) => {
    setPreferUltraWide(val);
    setUltraWidePreference(val);
    toast.success(language === "de" ? "Einstellung gespeichert" : "Setting saved");
  };

  return (
    <div className="glass-card space-y-4 p-6">
      <h2 className="text-lg font-semibold font-display flex items-center gap-2">
        <Camera className="h-5 w-5 text-primary" />
        {language === "de" ? "Kamera-Einstellungen" : "Camera Settings"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {language === "de"
          ? "Steuere die Standard-Kameraeinstellungen für das Tracking."
          : "Control default camera settings for tracking."}
      </p>
      <div className="flex items-center gap-3">
        <Switch checked={preferUltraWide} onCheckedChange={handleToggle} />
        <div>
          <span className="text-sm text-foreground font-medium">
            {language === "de" ? "Weitwinkel als Standard" : "Use wide-angle by default"}
          </span>
          <p className="text-xs text-muted-foreground">
            {language === "de"
              ? "Aktiviert automatisch die 0.5x Ultra-Weitwinkel-Kamera beim Start der Aufnahme (falls verfügbar)."
              : "Automatically activates the 0.5x ultra-wide camera when starting a recording (if available)."}
          </p>
        </div>
      </div>
    </div>
  );
}

function BenchmarkOptInSection() {
  const { optedIn, loading, isPro, toggle, toggling } = useBenchmarkOptIn();
  const { t, language } = useTranslation();

  if (!isPro) return null;

  return (
    <div className="glass-card space-y-4 p-6">
      <h2 className="text-lg font-semibold font-display flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        {language === "de" ? "Liga-Benchmark" : "League Benchmark"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {language === "de"
          ? "Nimm anonym am Liga-Benchmark teil. Deine aggregierten Werte (Ballbesitz, Laufdistanz, Tempo) werden mit dem Liga-Durchschnitt verglichen. Es werden keine einzelnen Vereinsdaten weitergegeben — nur Durchschnitte ab mindestens 5 Teilnehmern."
          : "Participate anonymously in the league benchmark. Your aggregated stats (possession, distance, speed) are compared to the league average. No individual club data is shared — only averages with at least 5 participants."}
      </p>
      <div className="flex items-center gap-3">
        <Switch
          checked={optedIn}
          onCheckedChange={toggle}
          disabled={loading || toggling}
        />
        <span className="text-sm text-foreground">
          {optedIn
            ? (language === "de" ? "Teilnahme aktiv" : "Participation active")
            : (language === "de" ? "Nicht teilnehmen" : "Not participating")}
        </span>
      </div>
      {optedIn && (
        <p className="text-xs text-muted-foreground">
          {language === "de"
            ? "Du kannst die Teilnahme jederzeit deaktivieren. Deine Daten werden dann nicht mehr in den Benchmark einbezogen."
            : "You can deactivate participation at any time. Your data will no longer be included in the benchmark."}
        </p>
      )}
    </div>
  );
}
