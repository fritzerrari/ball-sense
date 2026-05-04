// AdminAiUsage — Übersicht über AI-Token-Verbrauch pro Verein/Funktion (Cost-Observability)
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Coins, TrendingUp, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface UsageRow {
  id: string;
  created_at: string;
  club_id: string | null;
  match_id: string | null;
  function_name: string;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  duration_ms: number | null;
  status: string;
}

interface ClubAgg { club_id: string; total_tokens: number; calls: number; errors: number }
interface FuncAgg { function_name: string; total_tokens: number; calls: number; avg_duration: number }

export default function AdminAiUsage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-ai-usage"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: rows } = await supabase
        .from("ai_usage_log")
        .select("id, created_at, club_id, match_id, function_name, model, prompt_tokens, completion_tokens, total_tokens, duration_ms, status")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      const { data: clubs } = await supabase.from("clubs").select("id, name");
      return { rows: (rows ?? []) as UsageRow[], clubs: clubs ?? [] };
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Lade…</div>;
  const rows = data?.rows ?? [];
  const clubMap = new Map((data?.clubs ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));

  const totalTokens = rows.reduce((s, r) => s + (r.total_tokens ?? 0), 0);
  const totalCalls = rows.length;
  const errorCount = rows.filter(r => r.status !== "ok").length;

  // Aggregations
  const byClub = new Map<string, ClubAgg>();
  const byFunc = new Map<string, FuncAgg>();
  for (const r of rows) {
    const ck = r.club_id ?? "unknown";
    const c = byClub.get(ck) ?? { club_id: ck, total_tokens: 0, calls: 0, errors: 0 };
    c.total_tokens += r.total_tokens ?? 0;
    c.calls += 1;
    if (r.status !== "ok") c.errors += 1;
    byClub.set(ck, c);

    const f = byFunc.get(r.function_name) ?? { function_name: r.function_name, total_tokens: 0, calls: 0, avg_duration: 0 };
    f.total_tokens += r.total_tokens ?? 0;
    f.calls += 1;
    f.avg_duration = ((f.avg_duration * (f.calls - 1)) + (r.duration_ms ?? 0)) / f.calls;
    byFunc.set(r.function_name, f);
  }

  const topClubs = [...byClub.values()].sort((a, b) => b.total_tokens - a.total_tokens).slice(0, 10);
  const topFuncs = [...byFunc.values()].sort((a, b) => b.total_tokens - a.total_tokens);

  return (
    <div className="space-y-4">
      {/* KPI-Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Coins className="h-3.5 w-3.5" /> Tokens (30d)</div>
          <div className="text-2xl font-bold mt-1">{totalTokens.toLocaleString("de-DE")}</div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><TrendingUp className="h-3.5 w-3.5" /> Calls</div>
          <div className="text-2xl font-bold mt-1">{totalCalls.toLocaleString("de-DE")}</div>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><AlertCircle className="h-3.5 w-3.5" /> Fehler</div>
          <div className="text-2xl font-bold mt-1 text-destructive">{errorCount}</div>
        </div>
      </div>

      {/* Top Clubs */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold mb-3">Top-Clubs (30 Tage)</h3>
        {topClubs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Noch keine Nutzungsdaten erfasst. Edge Functions müssen mit dem Logging-Helper instrumentiert werden.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="text-left pb-2">Verein</th><th className="text-right pb-2">Tokens</th><th className="text-right pb-2">Calls</th><th className="text-right pb-2">Fehler</th></tr>
            </thead>
            <tbody>
              {topClubs.map(c => (
                <tr key={c.club_id} className="border-t border-border/50">
                  <td className="py-1.5">{clubMap.get(c.club_id) ?? <span className="text-muted-foreground italic">unbekannt</span>}</td>
                  <td className="py-1.5 text-right font-mono">{c.total_tokens.toLocaleString("de-DE")}</td>
                  <td className="py-1.5 text-right">{c.calls}</td>
                  <td className="py-1.5 text-right">{c.errors > 0 ? <span className="text-destructive">{c.errors}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Top Functions */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold mb-3">Funktionen</h3>
        {topFuncs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Keine Daten.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="text-left pb-2">Funktion</th><th className="text-right pb-2">Tokens</th><th className="text-right pb-2">Calls</th><th className="text-right pb-2">Ø Dauer</th></tr>
            </thead>
            <tbody>
              {topFuncs.map(f => (
                <tr key={f.function_name} className="border-t border-border/50">
                  <td className="py-1.5 font-mono">{f.function_name}</td>
                  <td className="py-1.5 text-right font-mono">{f.total_tokens.toLocaleString("de-DE")}</td>
                  <td className="py-1.5 text-right">{f.calls}</td>
                  <td className="py-1.5 text-right">{Math.round(f.avg_duration)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent calls */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold mb-3">Letzte Aufrufe</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="text-left pb-2">Zeit</th><th className="text-left pb-2">Funktion</th><th className="text-left pb-2">Modell</th><th className="text-right pb-2">Tokens</th><th className="text-left pb-2">Status</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 30).map(r => (
                <tr key={r.id} className="border-t border-border/50">
                  <td className="py-1.5 text-muted-foreground">{format(new Date(r.created_at), "dd.MM HH:mm", { locale: de })}</td>
                  <td className="py-1.5 font-mono">{r.function_name}</td>
                  <td className="py-1.5 text-muted-foreground">{r.model}</td>
                  <td className="py-1.5 text-right font-mono">{r.total_tokens?.toLocaleString("de-DE") ?? "—"}</td>
                  <td className="py-1.5">{r.status === "ok" ? <span className="text-emerald-600">ok</span> : <span className="text-destructive">{r.status}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
