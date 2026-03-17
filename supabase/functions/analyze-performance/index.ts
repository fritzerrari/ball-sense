import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, playerId, matchId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let prompt = "";

    if (type === "player" && playerId) {
      // Get player info
      const { data: player } = await supabase.from("players").select("name, number, position").eq("id", playerId).single();
      // Get last 15 matches stats
      const { data: stats } = await supabase
        .from("player_match_stats")
        .select("distance_km, top_speed_kmh, avg_speed_kmh, sprint_count, sprint_distance_m, minutes_played, match_id, matches(date, away_club_name)")
        .eq("player_id", playerId)
        .order("match_id", { ascending: false })
        .limit(15);

      if (!stats?.length) {
        return new Response(JSON.stringify({ error: "Keine Statistiken vorhanden" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const statsTable = stats.map((s: any) => ({
        date: s.matches?.date,
        opponent: s.matches?.away_club_name,
        km: s.distance_km,
        topSpeed: s.top_speed_kmh,
        avgSpeed: s.avg_speed_kmh,
        sprints: s.sprint_count,
        sprintDistM: s.sprint_distance_m,
        minutes: s.minutes_played,
      }));

      prompt = `Du bist ein professioneller Fußball-Leistungsanalyst. Analysiere die folgenden GPS-Tracking-Daten des Spielers und erstelle eine detaillierte Leistungsanalyse auf Deutsch.

Spieler: ${player?.name ?? "Unbekannt"} (#${player?.number ?? "—"}, Position: ${player?.position ?? "—"})

Letzte ${stats.length} Spiele (neueste zuerst):
${JSON.stringify(statsTable, null, 2)}

Erstelle folgende Abschnitte mit Markdown-Überschriften:
## 📊 Leistungsübersicht
Zusammenfassung der wichtigsten Kennzahlen mit Durchschnittswerten.

## 📈 Trend-Analyse
Wie entwickeln sich Laufleistung, Geschwindigkeit und Sprints über die letzten Spiele? Gibt es positive oder negative Trends?

## 💪 Stärken
Was macht der Spieler besonders gut? Wo liegt er über dem Durchschnitt?

## ⚠️ Verbesserungspotential
Wo gibt es Schwächen oder Rückgänge? Was könnte verbessert werden?

## 🏋️ Trainingsempfehlungen
3-5 konkrete, umsetzbare Trainingsempfehlungen basierend auf den Daten.

## 🎯 Taktische Hinweise
Wie kann der Trainer den Spieler optimal einsetzen?

Sei konkret, datenbasiert und praxisorientiert. Verwende die tatsächlichen Zahlen aus den Daten.`;

    } else if (type === "team" && matchId) {
      const { data: match } = await supabase.from("matches").select("date, away_club_name, home_club_id").eq("id", matchId).single();
      const { data: teamStats } = await supabase.from("team_match_stats").select("*").eq("match_id", matchId);
      const { data: playerStats } = await supabase
        .from("player_match_stats")
        .select("distance_km, top_speed_kmh, avg_speed_kmh, sprint_count, sprint_distance_m, minutes_played, team, players(name, number, position)")
        .eq("match_id", matchId);

      // Get last 5 team stats for trend
      let recentTeamStats: any[] = [];
      if (match?.home_club_id) {
        const { data: recentMatches } = await supabase
          .from("matches")
          .select("id, date, away_club_name")
          .eq("home_club_id", match.home_club_id)
          .eq("status", "done")
          .order("date", { ascending: false })
          .limit(5);
        if (recentMatches?.length) {
          const { data: rts } = await supabase
            .from("team_match_stats")
            .select("match_id, total_distance_km, top_speed_kmh, possession_pct")
            .in("match_id", recentMatches.map(m => m.id))
            .eq("team", "home");
          recentTeamStats = rts ?? [];
        }
      }

      if (!playerStats?.length) {
        return new Response(JSON.stringify({ error: "Keine Spielstatistiken vorhanden" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      prompt = `Du bist ein professioneller Fußball-Leistungsanalyst. Analysiere die folgenden GPS-Tracking-Daten des Spiels und erstelle eine detaillierte Spielanalyse auf Deutsch.

Spiel: Heim vs ${match?.away_club_name ?? "Unbekannt"} am ${match?.date ?? "—"}

Team-Statistiken:
${JSON.stringify(teamStats, null, 2)}

Spieler-Statistiken:
${JSON.stringify(playerStats?.map((p: any) => ({
  name: p.players?.name, number: p.players?.number, position: p.players?.position, team: p.team,
  km: p.distance_km, topSpeed: p.top_speed_kmh, avgSpeed: p.avg_speed_kmh, sprints: p.sprint_count, minutes: p.minutes_played,
})), null, 2)}

Letzte 5 Heim-Spiele Team-Stats (für Trend):
${JSON.stringify(recentTeamStats, null, 2)}

Erstelle folgende Abschnitte mit Markdown-Überschriften:
## 📊 Spielübersicht
Zusammenfassung des Spiels anhand der physischen Leistungsdaten.

## 🏃 Top-Performer
Welche Spieler haben herausragend performed? Wer war am laufstärksten, schnellsten, sprintstärksten?

## ⚖️ Heim vs Auswärts
Vergleich der Team-Leistungsdaten beider Mannschaften.

## 📈 Saisontrend
Wie ordnet sich dieses Spiel im Vergleich zu den letzten Spielen ein?

## ⚠️ Auffälligkeiten
Spieler mit auffällig niedrigen/hohen Werten, mögliche Ermüdungszeichen.

## 🏋️ Trainingsempfehlungen
Konkrete Empfehlungen für die kommende Trainingswoche.

## 🎯 Taktische Anpassungen
Vorschläge zur Aufstellungs- oder Taktikoptimierung basierend auf den Daten.

Sei konkret, datenbasiert und praxisorientiert.`;

    } else {
      return new Response(JSON.stringify({ error: "Ungültige Parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Du bist ein erfahrener Fußball-Leistungsanalyst, spezialisiert auf GPS-Tracking-Daten. Antworte immer auf Deutsch." },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate-Limit erreicht" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "KI-Kontingent erschöpft" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "KI-Analyse fehlgeschlagen" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("analyze-performance error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
