import AppLayout from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Swords, Calendar, MapPin, Trash2, Dumbbell, Search, Radio, Clock3, History, Camera, Loader2, CheckCircle2, ArrowRight, BarChart3, Sparkles } from "lucide-react";
import { useMatches, useDeleteMatch } from "@/hooks/use-matches";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonTable } from "@/components/SkeletonCard";
import { useMemo, useState } from "react";
import { useTranslation, useLocale } from "@/lib/i18n";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type MatchTypeFilter = "all" | "match" | "training";
type TimelineFilter = "all" | "live" | "upcoming" | "past";
type SortFilter = "newest" | "oldest";

function getMatchTimestamp(match: any) {
  if (match.kickoff) {
    return new Date(`${match.date}T${match.kickoff}`).getTime();
  }
  return new Date(`${match.date}T12:00:00`).getTime();
}

function getTimeline(match: any) {
  if (["live", "tracking", "recording", "processing"].includes(match.status)) return "live";

  const now = Date.now();
  const matchTime = getMatchTimestamp(match);

  if (match.status === "done" || matchTime < now) return "past";
  return "upcoming";
}

function getTypeLabel(matchType: string | null | undefined) {
  return matchType === "training" ? "Training" : "Spiel";
}

function getTimelineLabel(timeline: TimelineFilter | "live" | "upcoming" | "past") {
  if (timeline === "live") return "Live";
  if (timeline === "upcoming") return "Zukünftig";
  if (timeline === "past") return "Vergangen";
  return "Alle";
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof Radio;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`glass-card flex w-full items-center justify-between gap-3 p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-muted/20 ${active ? "ring-1 ring-primary/30" : ""}`}
    >
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Übersicht</p>
        <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
        <p className="mt-2 font-display text-2xl font-bold text-foreground">{value}</p>
      </div>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary text-foreground">
        <Icon className="h-5 w-5" />
      </div>
    </button>
  );
}

/** Prominent banner for active/processing/done matches */
function ActiveMatchBanner({ match, clubName }: { match: any; clubName: string | null }) {
  const locale = useLocale();
  const isTraining = match.match_type === "training";
  const label = isTraining ? "Training" : `${clubName} vs ${match.away_club_name || "TBD"}`;
  const dateStr = new Date(match.date).toLocaleDateString(locale);

  if (match.status === "live" || match.status === "tracking" || match.status === "recording") {
    return (
      <Link to={`/matches/${match.id}`} className="block">
        <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-5 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Live</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15">
              <Camera className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold font-display truncate">{label}</p>
              <p className="text-sm text-muted-foreground">{dateStr}{match.kickoff && ` · ${match.kickoff}`}{match.fields?.name && ` · ${match.fields.name}`}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </div>
        </div>
      </Link>
    );
  }

  if (match.status === "processing") {
    const progress = match.processing_progress as any;
    const pct = progress?.percent ?? null;
    return (
      <Link to={`/matches/${match.id}/processing`} className="block">
        <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 transition-all hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
              <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold font-display truncate">{label}</p>
              <p className="text-sm text-muted-foreground">
                Analyse wird verarbeitet…
                {pct != null && ` (${Math.round(pct)}%)`}
              </p>
              {pct != null && (
                <div className="mt-2 h-1.5 w-full rounded-full bg-amber-500/10 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              )}
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </div>
        </div>
      </Link>
    );
  }

  if (match.status === "done") {
    return (
      <Link to={`/matches/${match.id}`} className="block">
        <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4 sm:p-5 transition-all hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold font-display truncate">{label}</p>
              <p className="text-sm text-muted-foreground">{dateStr} · Analyse fertig — Ergebnisse ansehen</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-3.5 w-3.5" /> Ergebnisse
              </span>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return null;
}

export default function Matches() {
  const { clubName } = useAuth();
  const { data: matches, isLoading } = useMatches();
  const deleteMatch = useDeleteMatch();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<MatchTypeFilter>("all");
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortFilter>("newest");
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const { t } = useTranslation();
  const locale = useLocale();

  // Matches that need prominent display
  const activeMatches = useMemo(() => {
    return (matches ?? []).filter((m) =>
      ["live", "tracking", "recording", "processing", "done"].includes(m.status)
    ).sort((a, b) => {
      // Priority: live > processing > done
      const priority: Record<string, number> = { live: 0, tracking: 0, recording: 0, processing: 1, done: 2 };
      const pa = priority[a.status] ?? 3;
      const pb = priority[b.status] ?? 3;
      if (pa !== pb) return pa - pb;
      return getMatchTimestamp(b) - getMatchTimestamp(a);
    }).slice(0, 3); // Show max 3 banners
  }, [matches]);

  const summary = useMemo(() => {
    const list = matches ?? [];
    return {
      live: list.filter((match) => getTimeline(match) === "live").length,
      upcoming: list.filter((match) => getTimeline(match) === "upcoming").length,
      past: list.filter((match) => getTimeline(match) === "past").length,
      training: list.filter((match) => match.match_type === "training").length,
      match: list.filter((match) => match.match_type !== "training").length,
    };
  }, [matches]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return (matches ?? [])
      .filter((match) => {
        const type = match.match_type === "training" ? "training" : "match";
        const timeline = getTimeline(match);
        const searchValues = [
          clubName,
          match.away_club_name,
          match.fields?.name,
          match.status,
          getTypeLabel(match.match_type),
          getTimelineLabel(timeline),
          match.match_type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (statusFilter === "all" || match.status === statusFilter) &&
          (typeFilter === "all" || type === typeFilter) &&
          (timelineFilter === "all" || timeline === timelineFilter) &&
          (!query || searchValues.indexOf(query) >= 0)
        );
      })
      .sort((a, b) => {
        const diff = getMatchTimestamp(a) - getMatchTimestamp(b);
        return sortOrder === "oldest" ? diff : -diff;
      });
  }, [matches, statusFilter, typeFilter, timelineFilter, sortOrder, searchTerm, clubName]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold font-display">{t("matches.title")}</h1>
            <p className="text-sm text-muted-foreground">
              Bessere Übersicht für Spiele und Training mit Suche, Status- und Zeitfiltern.
            </p>
          </div>
          <Button variant="hero" size="sm" asChild>
            <Link to="/matches/new"><Plus className="mr-1 h-4 w-4" /> {t("matches.new")}</Link>
          </Button>
        </div>

        {/* ── Prominent Active Match Banners ── */}
        {activeMatches.length > 0 && (
          <div className="space-y-3">
            {activeMatches.map((match) => (
              <ActiveMatchBanner key={match.id} match={match} clubName={clubName} />
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Live-Sessions" value={summary.live} icon={Radio} active={timelineFilter === "live"} onClick={() => setTimelineFilter("live")} />
          <SummaryCard label="Zukünftige Termine" value={summary.upcoming} icon={Clock3} active={timelineFilter === "upcoming"} onClick={() => setTimelineFilter("upcoming")} />
          <SummaryCard label="Vergangene Spiele" value={summary.past} icon={History} active={timelineFilter === "past"} onClick={() => setTimelineFilter("past")} />
          <SummaryCard label="Trainingseinheiten" value={summary.training} icon={Dumbbell} active={typeFilter === "training"} onClick={() => setTypeFilter("training")} />
          <SummaryCard label="Spiele" value={summary.match} icon={Swords} active={typeFilter === "match"} onClick={() => setTypeFilter("match")} />
        </div>

        <div className="glass-card space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1.4fr,1fr,1fr,1fr,1fr]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Suche nach Gegner, Feld, Typ oder Status"
                className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </label>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as MatchTypeFilter)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="all">Alle Typen</option>
              <option value="match">Nur Spiele</option>
              <option value="training">Nur Training</option>
            </select>

            <select
              value={timelineFilter}
              onChange={(e) => setTimelineFilter(e.target.value as TimelineFilter)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="all">Alle Zeiträume</option>
              <option value="live">Live</option>
              <option value="upcoming">Zukünftig</option>
              <option value="past">Vergangen</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="all">{t("matches.allStatus")}</option>
              <option value="setup">{t("matches.setup")}</option>
              <option value="live">{t("matches.live")}</option>
              <option value="processing">{t("matches.processing")}</option>
              <option value="done">{t("matches.completed")}</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortFilter)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="newest">Neueste zuerst</option>
              <option value="oldest">Älteste zuerst</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{filtered.length} Einträge gefunden</span>
            {(searchTerm || typeFilter !== "all" || timelineFilter !== "all" || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setTypeFilter("all");
                  setTimelineFilter("all");
                  setStatusFilter("all");
                }}
                className="rounded-full border border-border bg-secondary px-2.5 py-1 text-foreground transition-colors hover:bg-muted"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Swords className="h-10 w-10" />}
            title="Keine passenden Einträge"
            description="Passe Suche oder Filter an, um Spiele, Trainings, Live- oder zukünftige Termine schneller zu finden."
            action={
              <Button variant="heroOutline" asChild>
                <Link to="/matches/new">Neuen Eintrag anlegen</Link>
              </Button>
            }
          />
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{t("common.date")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Typ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Eintrag</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground lg:table-cell">Zeitraum</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground sm:table-cell">{t("matches.field")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{t("common.status")}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">{t("matches.action")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((match: any) => {
                  const isTraining = match.match_type === "training";
                  const timeline = getTimeline(match);
                  const label = isTraining ? "Training" : `${clubName} vs ${match.away_club_name || "TBD"}`;
                  const isActive = ["live", "tracking", "recording", "processing"].includes(match.status);
                  const isDone = match.status === "done";

                  return (
                    <tr key={match.id} className={`border-b border-border/50 transition-colors hover:bg-muted/20 ${isActive ? "bg-primary/[0.03]" : isDone ? "bg-emerald-500/[0.03]" : ""}`}>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {new Date(match.date).toLocaleDateString(locale)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                          {isTraining ? <Dumbbell className="h-3.5 w-3.5" /> : <Swords className="h-3.5 w-3.5" />}
                          {getTypeLabel(match.match_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="min-w-0 flex items-center gap-2">
                          <p className="truncate">{label}</p>
                          {isActive && (
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                            </span>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground lg:hidden">{getTimelineLabel(timeline)}</p>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span className="inline-flex rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                          {getTimelineLabel(timeline)}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {match.fields?.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={match.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant={isDone ? "hero" : "ghost"} size="sm" asChild>
                            <Link to={`/matches/${match.id}`}>
                              {isDone ? <><BarChart3 className="mr-1 h-3.5 w-3.5" /> Ergebnisse</> : t("common.details")}
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({
                                id: match.id,
                                label: `${label} (${new Date(match.date).toLocaleDateString(locale)})`,
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          title="Eintrag löschen?"
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
