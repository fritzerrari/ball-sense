import AppLayout from "@/components/AppLayout";
import { useParams } from "react-router-dom";
import { BarChart3, Zap, Route, Trophy } from "lucide-react";

export default function PlayerProfile() {
  const { id } = useParams();

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-card p-6 flex items-center gap-6">
          <div className="w-20 h-20 rounded-xl bg-primary/10 flex items-center justify-center text-3xl font-bold font-display text-primary">
            10
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Max Müller</h1>
            <p className="text-muted-foreground">Zentrales Mittelfeld · #10</p>
          </div>
        </div>

        {/* Season stats */}
        <div className="grid sm:grid-cols-4 gap-4">
          {[
            { label: "Spiele", value: "0", icon: Trophy },
            { label: "Ø km/Spiel", value: "—", icon: Route },
            { label: "Ø Topspeed", value: "—", icon: Zap },
            { label: "Gesamt-Sprints", value: "0", icon: BarChart3 },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4">
              <s.icon className="h-4 w-4 text-primary mb-2" />
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-xl font-bold font-display">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="glass-card p-8 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Statistiken werden nach dem ersten Tracking sichtbar.</p>
        </div>
      </div>
    </AppLayout>
  );
}
