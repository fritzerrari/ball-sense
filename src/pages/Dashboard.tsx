import AppLayout from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, Map, Users, Swords, BarChart3, Zap, Trophy } from "lucide-react";

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Willkommen bei FieldIQ</p>
        </div>

        {/* Quickstart */}
        <div className="glass-card p-6 glow-border">
          <h2 className="text-lg font-semibold font-display mb-1">Bereit für das erste Tracking?</h2>
          <p className="text-sm text-muted-foreground mb-6">Starte in 3 einfachen Schritten.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { step: "1", label: "Platz kalibrieren", icon: Map, href: "/fields" },
              { step: "2", label: "Kader anlegen", icon: Users, href: "/players" },
              { step: "3", label: "Spiel starten", icon: Swords, href: "/matches/new" },
            ].map((s) => (
              <Link
                key={s.step}
                to={s.href}
                className="glass-card p-5 flex items-center gap-4 hover:border-primary/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold font-display group-hover:bg-primary/20 transition-colors">
                  {s.step}
                </div>
                <div>
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    Einrichten <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid sm:grid-cols-4 gap-4">
          {[
            { label: "Spiele getrackt", value: "0", icon: Trophy },
            { label: "Gesamt-km", value: "0", icon: BarChart3 },
            { label: "Top Speed", value: "— km/h", icon: Zap },
            { label: "Spieler", value: "0", icon: Users },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold font-display">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Empty state for last match */}
        <div className="glass-card p-8 text-center">
          <Swords className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Noch kein Spiel getrackt</p>
          <Button variant="hero" asChild>
            <Link to="/matches/new">Erstes Spiel anlegen</Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
