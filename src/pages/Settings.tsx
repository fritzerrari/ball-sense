import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Building2, CreditCard, Shield } from "lucide-react";

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold font-display">Einstellungen</h1>

        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-semibold font-display flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Vereinsdaten
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Vereinsname</label>
              <input type="text" placeholder="FC Musterstadt" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Stadt</label>
              <input type="text" placeholder="Musterstadt" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Liga</label>
              <input type="text" placeholder="Regionalliga Bayern" className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" />
            </div>
          </div>
          <Button variant="hero" size="sm">Speichern</Button>
        </div>

        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-semibold font-display flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Plan & Abrechnung
          </h2>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
            <div>
              <div className="font-medium">Trial</div>
              <div className="text-sm text-muted-foreground">30 Tage kostenlos testen</div>
            </div>
            <Button variant="heroOutline" size="sm">Upgrade</Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
