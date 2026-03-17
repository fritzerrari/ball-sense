import AppLayout from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Swords, Calendar, MapPin, Trash2, Dumbbell } from "lucide-react";
import { useMatches, useDeleteMatch } from "@/hooks/use-matches";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonTable } from "@/components/SkeletonCard";
import { useState } from "react";
import { useTranslation, useLocale } from "@/lib/i18n";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function Matches() {
  const { clubName } = useAuth();
  const { data: matches, isLoading } = useMatches();
  const deleteMatch = useDeleteMatch();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const { t } = useTranslation();
  const locale = useLocale();

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
          <h1 className="text-2xl font-bold font-display">{t("matches.title")}</h1>
          <Button variant="hero" size="sm" asChild>
            <Link to="/matches/new"><Plus className="h-4 w-4 mr-1" /> {t("matches.new")}</Link>
          </Button>
        </div>

        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm"
          >
            <option value="all">{t("matches.allStatus")}</option>
            <option value="setup">{t("matches.setup")}</option>
            <option value="live">{t("matches.live")}</option>
            <option value="processing">{t("matches.processing")}</option>
            <option value="done">{t("matches.completed")}</option>
          </select>
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm hover:bg-muted/80 transition-colors"
          >
            {t("matches.dateSort")} {sortAsc ? "↑" : "↓"}
          </button>
        </div>

        {isLoading ? (
          <SkeletonTable rows={4} cols={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Swords className="h-10 w-10" />}
            title={t("matches.noMatches")}
            description={statusFilter !== "all" ? t("matches.noMatchesFilter") : t("matches.createFirst")}
            action={statusFilter === "all" && (
              <Button variant="heroOutline" asChild>
                <Link to="/matches/new">{t("matches.firstMatch")}</Link>
              </Button>
            )}
          />
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">{t("common.date")}</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">{t("matches.matchup")}</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs hidden sm:table-cell">{t("matches.field")}</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium text-xs">{t("common.status")}</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium text-xs">{t("matches.action")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((match: any) => (
                  <tr key={match.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {new Date(match.date).toLocaleDateString(locale)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">
                      <span className="flex items-center gap-1.5">
                        {match.match_type === "training"
                          ? <Dumbbell className="h-3.5 w-3.5 text-primary shrink-0" />
                          : <Swords className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        {match.match_type === "training"
                          ? `Training`
                          : `${clubName} vs ${match.away_club_name || "TBD"}`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {match.fields?.name ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={match.status} /></td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/matches/${match.id}`}>{t("common.details")}</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({
                              id: match.id,
                              label: `${clubName} vs ${match.away_club_name || "TBD"} (${new Date(match.date).toLocaleDateString(locale)})`,
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          title="Spiel löschen?"
          description={`Möchtest du „${deleteTarget?.label}" wirklich unwiderruflich löschen? Alle zugehörigen Daten (Lineups, Tracking, Statistiken) gehen verloren.`}
          onConfirm={() => {
            if (deleteTarget) {
              deleteMatch.mutate(deleteTarget.id);
              setDeleteTarget(null);
            }
          }}
          destructive
        />
      </div>
    </AppLayout>
  );
}
