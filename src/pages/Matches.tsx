import AppLayout from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Swords, Calendar, MapPin } from "lucide-react";
import { useMatches } from "@/hooks/use-matches";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonTable } from "@/components/SkeletonCard";
import { useState } from "react";

export default function Matches() {
  const { clubName } = useAuth();
  const { data: matches, isLoading } = useMatches();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = (matches ?? [])
    .filter(m => statusFilter === "all" || m.status === statusFilter)
    .sort((a, b) => {
      const d = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortAsc ? d : -d;
    });

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display">Spiele</h1>
          <Button variant="hero" size="sm" asChild>
            <Link to="/matches/new"><Plus className="h-4 w-4 mr-1" /> Neues Spiel</Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm"
          >
            <option value="all">Alle Status</option>
            <option value="setup">Einrichtung</option>
            <option value="live">Live</option>
            <option value="processing">Verarbeitung</option>
            <option value="done">Abgeschlossen</option>
          </select>
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm hover:bg-muted/80 transition-colors"
          >
            Datum {sortAsc ? "↑" : "↓"}
          </button>
        </div>

        {isLoading ? (
          <SkeletonTable rows={4} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Swords className="h-10 w-10" />}
            title="Noch keine Spiele angelegt"
            description={statusFilter !== "all" ? "Keine Spiele mit diesem Status." : "Lege dein erstes Spiel an."}
            action={statusFilter === "all" && (
              <Button variant="heroOutline" asChild>
                <Link to="/matches/new">Erstes Spiel anlegen</Link>
              </Button>
            )}
          />
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Datum</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Paarung</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">Platz</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">Status</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium text-xs">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((match: any) => (
                  <tr key={match.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {new Date(match.date).toLocaleDateString("de-DE")}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {clubName} vs {match.away_club_name || "TBD"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {match.fields?.name ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={match.status} /></td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/matches/${match.id}`}>Details</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
