import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GENERAL_RULES = `Allgemeine Regeln:
- Antworte immer auf Deutsch.
- Schreibe fachlich, nüchtern, klar und ohne Floskeln.
- Keine Begrüßung und kein werblicher Ton.
- Erfinde nichts; benenne Datenlücken offen.
- Top-Speed-Werte deutlich über ca. 45 km/h im Fußball als wahrscheinlichen Tracking-Ausreißer markieren.
- Kleine Stichproben und niedrige Einsatzzeiten nur vorsichtig interpretieren.
- Formuliere konkrete Ableitungen für Training, Einsatzprofil und Belastungssteuerung.`;

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

    if ((type === "player" || type === "training") && playerId) {
      const { data: player } = await supabase.from("players").select("name, number, position").eq("id", playerId).single();
      const { data: stats } = await supabase
        .from("player_match_stats")
        .select("distance_km, top_speed_kmh, avg_speed_kmh, sprint_count, sprint_distance_m, minutes_played, match_id, passes_total, passes_completed, pass_accuracy, duels_total, duels_won, tackles, interceptions, ball_recoveries, shots_total, shots_on_target, goals, assists, ball_contacts, fouls_committed, fouls_drawn, yellow_cards, red_cards, dribbles_success, aerial_won, rating, crosses, matches(date, away_club_name)")
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
        passesTotal: s.passes_total,
        passesCompleted: s.passes_completed,
        passAccuracy: s.pass_accuracy,
        duelsTotal: s.duels_total,
        duelsWon: s.duels_won,
        tackles: s.tackles,
        interceptions: s.interceptions,
        ballRecoveries: s.ball_recoveries,
        shotsTotal: s.shots_total,
        shotsOnTarget: s.shots_on_target,
        goals: s.goals,
        assists: s.assists,
        ballContacts: s.ball_contacts,
        fouls: s.fouls_committed,
        foulsDrawn: s.fouls_drawn,
        yellowCards: s.yellow_cards,
        redCards: s.red_cards,
        dribbles: s.dribbles_success,
        aerialWon: s.aerial_won,
        rating: s.rating,
        crosses: s.crosses,
      }));

      if (type === "training") {
        prompt = `${GENERAL_RULES}

Du bist ein professioneller Fußball-Fitnesstrainer und Individualcoach.
Erstelle einen hochwertigen, positionsspezifischen Wochentrainingsplan auf Basis echter Leistungsdaten.

Spieler: ${player?.name ?? "Unbekannt"} (#${player?.number ?? "—"}, Position: ${player?.position ?? "—"})
Letzte ${stats.length} Spiele:
${JSON.stringify(statsTable, null, 2)}

Pflichtstruktur:
## Kurzdiagnose
- 4-6 Sätze mit belastbaren Kernaussagen

## Leistungsprofil
- Physik
- Aktionseffizienz
- Verhalten gegen den Ball
- Verhalten mit Ball

## Priorisierte Entwicklungsfelder
- 3 Felder mit Begründung aus den Daten

## Wochentrainingsplan (Mo-Fr)
Für jeden Tag:
- Ziel
- Inhalt / Übungen
- Umfang / Dauer
- Intensität
- Coachingpunkte

## Individuelle Coachingpunkte
- 5 klare, positionsbezogene Hinweise

## Belastungssteuerung
- Risiko, Regeneration, Steuerung der nächsten 7 Tage

## 4-Wochen-Ziele
- messbar und realistisch`; 
      } else {
        prompt = `${GENERAL_RULES}

Du bist ein leitender Individualanalyst im Profifußball.
Analysiere die Leistungsentwicklung dieses Spielers tiefgehend und trainerrelevant.

Spieler: ${player?.name ?? "Unbekannt"} (#${player?.number ?? "—"}, Position: ${player?.position ?? "—"})
Letzte ${stats.length} Spiele:
${JSON.stringify(statsTable, null, 2)}

Pflichtstruktur:
## Kurzfazit
## Belastbare Erkenntnisse
## Trendanalyse
## Stärkenprofil
## Verbesserungsfelder
## Taktische Einordnung
## Belastungsmanagement
## Konkrete Trainingsmaßnahmen

Zusatzregeln:
- Nicht nur Werte aufzählen, sondern einordnen.
- Zweikampf-, Pass-, Lauf- und Aktionsprofile zusammenführen.
- Falls Werte unplausibel wirken, separat als Datenrisiko markieren.`;
      }
    } else if (type === "team" && matchId) {
      const { data: match } = await supabase.from("matches").select("date, away_club_name, home_club_id, home_formation, away_formation, status").eq("id", matchId).single();
      const { data: teamStats } = await supabase.from("team_match_stats").select("*").eq("match_id", matchId);
      const { data: playerStats } = await supabase
        .from("player_match_stats")
        .select("distance_km, top_speed_kmh, avg_speed_kmh, sprint_count, sprint_distance_m, minutes_played, team, passes_total, passes_completed, pass_accuracy, duels_total, duels_won, tackles, interceptions, goals, assists, shots_total, shots_on_target, ball_contacts, rating, players(name, number, position)")
        .eq("match_id", matchId);
      const { data: apiMatchStats } = await supabase.from("api_football_match_stats").select("*").eq("match_id", matchId).maybeSingle();

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
            .select("match_id, total_distance_km, top_speed_kmh, possession_pct, avg_distance_km")
            .in("match_id", recentMatches.map((m) => m.id))
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

      prompt = `${GENERAL_RULES}

Du bist ein leitender Match-Analyst für Fußball.
Erstelle eine fachlich starke Team- und Spielanalyse.

Spiel: Heim vs ${match?.away_club_name ?? "Unbekannt"} am ${match?.date ?? "—"}
Status: ${match?.status ?? "—"}
Formation Heim: ${match?.home_formation ?? "—"}
Formation Gast: ${match?.away_formation ?? "—"}

Team-Statistiken:
${JSON.stringify(teamStats, null, 2)}

Spieler-Statistiken:
${JSON.stringify(
  playerStats.map((p: any) => ({
    name: p.players?.name,
    number: p.players?.number,
    position: p.players?.position,
    team: p.team,
    km: p.distance_km,
    topSpeed: p.top_speed_kmh,
    avgSpeed: p.avg_speed_kmh,
    sprints: p.sprint_count,
    minutes: p.minutes_played,
    passesTotal: p.passes_total,
    passAccuracy: p.pass_accuracy,
    duelsWon: p.duels_won,
    duelsTotal: p.duels_total,
    tackles: p.tackles,
    interceptions: p.interceptions,
    goals: p.goals,
    assists: p.assists,
    shots: p.shots_total,
    shotsOnTarget: p.shots_on_target,
    ballContacts: p.ball_contacts,
    rating: p.rating,
  })),
  null,
  2,
)}

API-Matchstats:
${JSON.stringify(apiMatchStats, null, 2)}

Letzte 5 Heim-Spiele Team-Stats:
${JSON.stringify(recentTeamStats, null, 2)}

Pflichtstruktur:
## Kurzfazit
## Belastbare Team-Erkenntnisse
## Taktische Bewertung
## Spieler mit Wirkung auf den Spielverlauf
## Datenqualität / Ausreißer
## Vergleich zu den letzten Spielen
## Konkrete Trainings- und Matchplan-Ableitungen`; 
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
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "Du bist ein Top-Analyst im Fußball mit Fokus auf Matchanalyse, Individualdiagnostik und Trainingssteuerung." },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate-Limit erreicht" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "KI-Kontingent erschöpft" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "KI-Analyse fehlgeschlagen" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-performance error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});