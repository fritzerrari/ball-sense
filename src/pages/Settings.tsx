import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Building2, CreditCard, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PLAN_CONFIG } from "@/lib/constants";
import type { PlanType } from "@/lib/types";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useMonthlyMatchCount } from "@/hooks/use-match-stats";
import { Check } from "lucide-react";
import { ClubLogoUpload } from "@/components/ClubLogoUpload";

export default function SettingsPage() {
  const { clubId, clubName, clubPlan } = useAuth();
  const { data: monthlyCount } = useMonthlyMatchCount();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [league, setLeague] = useState("");
  const [saving, setSaving] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

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

  const handleSave = async () => {
    if (!clubId || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("clubs").update({ name: name.trim(), city: city.trim() || null, league: league.trim() || null }).eq("id", clubId);
    setSaving(false);
    if (error) toast.error("Fehler beim Speichern");
    else toast.success("Vereinsdaten gespeichert");
  };

  const plan = (clubPlan ?? "trial") as PlanType;
  const config = PLAN_CONFIG[plan];
  const maxMatches = config.maxMatches;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold font-display">Einstellungen</h1>

        {/* Club data */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-semibold font-display flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Vereinsdaten
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Vereinsname *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="FC Musterstadt" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Stadt</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Musterstadt" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Liga</label>
              <input type="text" value={league} onChange={e => setLeague(e.target.value)} placeholder="Regionalliga Bayern" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" />
            </div>
          </div>
          <Button variant="hero" size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Speichern
          </Button>
        </div>

        {/* Plan */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-semibold font-display flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Plan & Abrechnung
          </h2>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
            <div>
              <div className="font-medium font-display">{config.label}</div>
              <div className="text-sm text-muted-foreground">
                {config.price === 0 ? "Kostenlose Testphase" : `€${config.price}/Monat`}
              </div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
              Aktuell
            </span>
          </div>

          {/* Usage */}
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Spiele diesen Monat</span>
              <span className="text-sm font-medium">
                {monthlyCount ?? 0} / {maxMatches ?? "∞"}
              </span>
            </div>
            {maxMatches && (
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-full rounded-full transition-all ${
                    (monthlyCount ?? 0) >= maxMatches ? "bg-destructive" : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(((monthlyCount ?? 0) / maxMatches) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Plan comparison */}
          <div className="grid sm:grid-cols-3 gap-3">
            {(["starter", "club", "pro"] as PlanType[]).map(p => {
              const c = PLAN_CONFIG[p];
              const isCurrent = p === plan;
              return (
                <div key={p} className={`p-4 rounded-lg border ${isCurrent ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                  <div className="text-xs font-semibold text-muted-foreground tracking-wider mb-1">{c.label.toUpperCase()}</div>
                  <div className="text-2xl font-bold font-display">€{c.price}</div>
                  <div className="text-xs text-muted-foreground mb-2">/Monat</div>
                  <div className="text-xs text-muted-foreground">{c.maxMatches ? `${c.maxMatches} Spiele/Mo` : "Unbegrenzt"}</div>
                  {isCurrent ? (
                    <div className="mt-2 text-xs text-primary flex items-center gap-1"><Check className="h-3 w-3" /> Aktuell</div>
                  ) : (
                    <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => setUpgradeOpen(true)}>
                      Upgraden
                    </Button>
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
