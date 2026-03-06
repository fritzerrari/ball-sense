import AppLayout from "@/components/AppLayout";
import { useParams } from "react-router-dom";
import { useState } from "react";
import { BarChart3, Zap, Route, Users, ArrowUpDown } from "lucide-react";

const tabs = ["Übersicht", "Heim", "Auswärts", "Vergleich"];

// Mock heatmap component
function HeatmapField({ label }: { label: string }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="aspect-[105/68] bg-muted/30 rounded-lg border border-border relative overflow-hidden">
        {/* Field lines */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[1px] h-full bg-primary/10" />
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-primary/10" />
        {/* Mock heatmap zones */}
        <div className="absolute inset-4 grid grid-cols-7 grid-rows-5 gap-0.5 opacity-60">
          {Array.from({ length: 35 }).map((_, i) => {
            const intensity = Math.random();
            const hue = intensity > 0.7 ? 0 : intensity > 0.4 ? 60 : intensity > 0.2 ? 120 : 200;
            return (
              <div
                key={i}
                className="rounded-sm"
                style={{
                  backgroundColor: `hsla(${hue}, 80%, 50%, ${intensity * 0.6})`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function MatchReport() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("Übersicht");

  // Mock data
  const mockPlayers = [
    { name: "M. Müller", number: 10, pos: "ZOM", km: "11.2", speed: "31.2", sprints: 18, min: 90 },
    { name: "T. Werner", number: 9, pos: "ST", km: "10.8", speed: "33.1", sprints: 22, min: 90 },
    { name: "L. Goretzka", number: 8, pos: "ZM", km: "12.1", speed: "29.4", sprints: 14, min: 90 },
    { name: "J. Kimmich", number: 6, pos: "ZDM", km: "11.9", speed: "28.7", sprints: 12, min: 90 },
    { name: "A. Davies", number: 19, pos: "LV", km: "10.5", speed: "34.2", sprints: 20, min: 78 },
  ];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Demo-Daten</span>
          </div>
          <h1 className="text-2xl font-bold font-display">FC Bayern II vs TSV 1860</h1>
          <p className="text-sm text-muted-foreground">05.03.2026 · Hauptplatz</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Übersicht" && (
          <div className="space-y-6">
            {/* Team comparison */}
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { team: "FC Bayern II", km: "10.8", total: "119", speed: "31.2", sprints: 187 },
                { team: "TSV 1860", km: "10.2", total: "112", speed: "29.8", sprints: 164 },
              ].map((t) => (
                <div key={t.team} className="glass-card p-5 space-y-4">
                  <h3 className="font-semibold font-display">{t.team}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div><div className="text-xs text-muted-foreground">Ø km/Spieler</div><div className="text-xl font-bold font-display">{t.km}</div></div>
                    <div><div className="text-xs text-muted-foreground">Gesamt</div><div className="text-xl font-bold font-display">{t.total} km</div></div>
                    <div><div className="text-xs text-muted-foreground">Topspeed</div><div className="text-xl font-bold font-display">{t.speed} <span className="text-sm font-normal">km/h</span></div></div>
                    <div><div className="text-xs text-muted-foreground">Sprints</div><div className="text-xl font-bold font-display">{t.sprints}</div></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <HeatmapField label="Team-Heatmap Heim" />
              <HeatmapField label="Team-Heatmap Auswärts" />
            </div>
          </div>
        )}

        {(activeTab === "Heim" || activeTab === "Auswärts") && (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Spieler", "#", "Pos", "km", "Top km/h", "Sprints", "Min"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">
                      <span className="flex items-center gap-1">{h} <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockPlayers.map((p) => (
                  <tr key={p.name} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer">
                    <td className="py-3 px-4 font-medium">{p.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{p.number}</td>
                    <td className="py-3 px-4 text-muted-foreground">{p.pos}</td>
                    <td className="py-3 px-4 font-semibold">{p.km}</td>
                    <td className="py-3 px-4">{p.speed}</td>
                    <td className="py-3 px-4">{p.sprints}</td>
                    <td className="py-3 px-4 text-muted-foreground">{p.min}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Vergleich" && (
          <div className="glass-card p-6 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Vergleichs-Charts werden nach dem ersten Tracking verfügbar.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
