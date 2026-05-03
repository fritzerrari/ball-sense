// Tactical AI chat — streams Gemini responses for in-report coaching Q&A.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { matchId, messages } = await req.json();
    if (!matchId || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "matchId und messages erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY fehlt");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Lade Match-Kontext kompakt
    const [matchRes, eventsRes, statsRes, sectionsRes] = await Promise.all([
      supabase.from("matches").select("*").eq("id", matchId).maybeSingle(),
      supabase.from("match_events").select("minute,team,event_type,player_name,event_cause,event_zone,notes").eq("match_id", matchId).order("minute"),
      supabase.from("player_match_stats").select("team,player_id,distance_km,top_speed_kmh,duels_won,duels_total,passes_completed,passes_total,shots_total,shots_on_target,goals,assists,ball_recoveries").eq("match_id", matchId),
      supabase.from("report_sections").select("section_type,title,content").eq("match_id", matchId),
    ]);

    const match = matchRes.data;
    const events = eventsRes.data ?? [];
    const stats = statsRes.data ?? [];
    const sections = sectionsRes.data ?? [];

    const home = stats.filter((s: { team?: string }) => s.team === "home");
    const away = stats.filter((s: { team?: string }) => s.team === "away");

    const sumNum = (arr: Array<Record<string, unknown>>, key: string) =>
      arr.reduce((acc, x) => acc + (Number(x[key]) || 0), 0);

    const ctx = {
      score: `${match?.home_score ?? 0}:${match?.away_score ?? 0}`,
      formation_home: match?.home_formation ?? "?",
      formation_away: match?.away_formation ?? "?",
      events_count: events.length,
      goals: events
        .filter((e: { event_type?: string }) => e.event_type === "goal")
        .map((e: { minute?: number; team?: string; event_cause?: string | null }) => `${e.minute}' ${e.team} ${e.event_cause ?? ""}`),
      home_totals: {
        goals: sumNum(home, "goals"),
        shots: sumNum(home, "shots_total"),
        shots_on: sumNum(home, "shots_on_target"),
        passes: sumNum(home, "passes_completed"),
        duels_won: sumNum(home, "duels_won"),
        duels_total: sumNum(home, "duels_total"),
        distance_km: sumNum(home, "distance_km"),
      },
      away_totals: {
        goals: sumNum(away, "goals"),
        shots: sumNum(away, "shots_total"),
        shots_on: sumNum(away, "shots_on_target"),
        passes: sumNum(away, "passes_completed"),
        duels_won: sumNum(away, "duels_won"),
        duels_total: sumNum(away, "duels_total"),
        distance_km: sumNum(away, "distance_km"),
      },
      report_excerpts: sections.slice(0, 4).map((s: { title?: string; content?: string | null }) => `${s.title}: ${(s.content ?? "").slice(0, 280)}`),
    };

    const systemPrompt = `Du bist ein erfahrener Fußball-Co-Trainer und Datenanalyst. Antworte kurz, konkret und datenbasiert auf Deutsch (max. 6 Sätze pro Antwort).
Verwende den folgenden Spielkontext als einzige Wahrheit. Wenn Daten fehlen, sag das ehrlich und gib eine plausible szenariobasierte Einschätzung mit dem Hinweis "(Hypothese)".

SPIELKONTEXT:
${JSON.stringify(ctx, null, 2)}

REGELN:
- Sprich den Trainer direkt an ("Du", "dein Team")
- Beziehe dich auf konkrete Minuten, Spieler oder Werte
- Bei "Was wäre wenn"-Fragen: simuliere kurz, nenne 1-2 Konsequenzen
- Keine Floskeln, keine Disclaimer, keine Wiederholung der Frage`;

    type ChatMsg = { role: "system" | "user" | "assistant"; content: string };
    const aiMessages: ChatMsg[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: ChatMsg) => ({ role: m.role, content: m.content })),
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate-Limit erreicht. Bitte später erneut versuchen." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI-Guthaben aufgebraucht. Bitte im Workspace aufladen." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI-Gateway Fehler" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("tactical-ai-chat error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
