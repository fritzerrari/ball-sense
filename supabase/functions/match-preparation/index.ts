import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { opponent_name, club_id } = await req.json();
    if (!opponent_name || !club_id) {
      return new Response(JSON.stringify({ error: "opponent_name and club_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Get all matches against this opponent
    const { data: matches } = await supabase
      .from("matches")
      .select("id, date, status, away_club_name, home_formation, away_formation")
      .eq("home_club_id", club_id)
      .eq("status", "done")
      .order("date", { ascending: false })
      .limit(20);

    const opponentMatches = (matches ?? []).filter(
      (m: any) => m.away_club_name?.toLowerCase().trim() === opponent_name.toLowerCase().trim()
    );
    const recentMatches = (matches ?? []).slice(0, 5);
    const recentMatchIds = recentMatches.map((m: any) => m.id);
    const opponentMatchIds = opponentMatches.map((m: any) => m.id);
    const allRelevantIds = [...new Set([...recentMatchIds, ...opponentMatchIds])];

    // 2. Fetch report sections for relevant matches
    const { data: sections } = await supabase
      .from("report_sections")
      .select("match_id, section_type, title, content, confidence")
      .in("match_id", allRelevantIds.length ? allRelevantIds : ["__none__"]);

    // 3. Fetch analysis results
    const { data: analysisResults } = await supabase
      .from("analysis_results")
      .select("match_id, result_type, data, confidence")
      .in("match_id", allRelevantIds.length ? allRelevantIds : ["__none__"])
      .in("result_type", ["tactical_insights", "pressing_data", "transitions"]);

    // 4. Fetch player form (last 5 matches stats)
    const { data: playerStats } = await supabase
      .from("player_match_stats")
      .select("match_id, player_id, distance_km, top_speed_kmh, sprint_count, rating, goals, assists, passes_total, pass_accuracy, duels_won, duels_total, tackles, interceptions, ball_recoveries, minutes_played")
      .in("match_id", recentMatchIds.length ? recentMatchIds : ["__none__"])
      .eq("team", "home");

    // 5. Fetch player names
    const { data: players } = await supabase
      .from("players")
      .select("id, name, number, position")
      .eq("club_id", club_id)
      .eq("active", true);

    // Build context for AI
    const opponentContext = opponentMatches.map((m: any) => {
      const matchSections = (sections ?? []).filter((s: any) => s.match_id === m.id);
      const riskMatrix = matchSections.find((s: any) => s.section_type === "risk_matrix");
      const tacticalGrades = matchSections.find((s: any) => s.section_type === "tactical_grades");
      const opponentDna = matchSections.find((s: any) => s.section_type === "opponent_dna");
      const momentum = matchSections.find((s: any) => s.section_type === "momentum");
      return {
        date: m.date,
        formation: m.home_formation,
        opponent_formation: m.away_formation,
        tactical_grades: tacticalGrades?.content,
        risk_matrix: riskMatrix?.content,
        opponent_dna: opponentDna?.content,
        momentum: momentum?.content,
      };
    });

    const ownFormContext = recentMatches.map((m: any) => {
      const matchSections = (sections ?? []).filter((s: any) => s.match_id === m.id);
      const tacticalGrades = matchSections.find((s: any) => s.section_type === "tactical_grades");
      const riskMatrix = matchSections.find((s: any) => s.section_type === "risk_matrix");
      return {
        date: m.date,
        opponent: m.away_club_name,
        tactical_grades: tacticalGrades?.content,
        risk_matrix: riskMatrix?.content,
      };
    });

    // Player form aggregation
    const playerFormMap: Record<string, any[]> = {};
    for (const stat of (playerStats ?? [])) {
      if (!stat.player_id) continue;
      if (!playerFormMap[stat.player_id]) playerFormMap[stat.player_id] = [];
      playerFormMap[stat.player_id].push(stat);
    }

    const playerFormSummary = (players ?? []).map((p: any) => {
      const stats = playerFormMap[p.id] ?? [];
      if (stats.length === 0) return { name: p.name, number: p.number, position: p.position, games: 0 };
      const avgRating = stats.filter((s: any) => s.rating).reduce((sum: number, s: any) => sum + s.rating, 0) / (stats.filter((s: any) => s.rating).length || 1);
      const avgDistance = stats.reduce((sum: number, s: any) => sum + (s.distance_km ?? 0), 0) / stats.length;
      const totalGoals = stats.reduce((sum: number, s: any) => sum + (s.goals ?? 0), 0);
      const totalAssists = stats.reduce((sum: number, s: any) => sum + (s.assists ?? 0), 0);
      return {
        name: p.name, number: p.number, position: p.position,
        games: stats.length, avg_rating: Math.round(avgRating * 10) / 10,
        avg_distance_km: Math.round(avgDistance * 10) / 10,
        goals: totalGoals, assists: totalAssists,
      };
    }).filter((p: any) => p.games > 0);

    // AI Prompt
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Du bist ein Elite-Fußball-Analyst. Erstelle eine taktische SPIELVORBEREITUNG gegen den nächsten Gegner.

Du erhältst:
- Bisherige Spiele gegen diesen Gegner (Tactical Grades, Risk Matrix, Opponent DNA, Momentum)
- Eigene Formkurve der letzten 5 Spiele (Tactical Grades, Risk Matrix)
- Spieler-Formkurven (Rating, Distanz, Tore, Assists)

ERSTELLE:
1. FORMATIONS-EMPFEHLUNG: Welche Formation gegen diesen Gegner? Basiert auf Gegner-DNA und eigener Stärke.
2. TAKTISCHE SCHWERPUNKTE: 3-5 konkrete taktische Anweisungen (z.B. "Pressing auf deren rechte Seite", "Lange Bälle vermeiden")
3. GEGNER-WARNUNG: 2-3 spezifische Stärken/Muster des Gegners, auf die reagiert werden muss
4. AUFSTELLUNGS-TIPPS: Welche Spieler sind in Form? Wer sollte starten? Basiert auf Formkurven.
5. SET-PIECE PLAN: Wie bei Standards gegen diesen Gegner agieren?
6. RISIKO-BEWERTUNG: Eigene Schwächen die besonders gegen diesen Gegner gefährlich werden könnten

Sprache: Deutsch. Ton: professionell, direkt, datenbasiert.
Wenn keine Gegner-Historie vorhanden ist, basiere die Vorbereitung NUR auf eigener Formkurve und generischen taktischen Prinzipien.`,
          },
          {
            role: "user",
            content: `Spielvorbereitung gegen: ${opponent_name}

GEGNER-HISTORIE (${opponentMatches.length} bisherige Spiele):
${JSON.stringify(opponentContext, null, 1)}

EIGENE FORM (letzte 5 Spiele):
${JSON.stringify(ownFormContext, null, 1)}

SPIELER-FORM:
${JSON.stringify(playerFormSummary, null, 1)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_preparation",
              description: "Submit the tactical match preparation",
              parameters: {
                type: "object",
                properties: {
                  recommended_formation: { type: "string", description: "e.g. 4-3-3, 4-2-3-1" },
                  formation_reasoning: { type: "string", description: "Why this formation" },
                  tactical_priorities: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        priority: { type: "number", description: "1-5, 1=highest" },
                      },
                      required: ["title", "description", "priority"],
                    },
                  },
                  opponent_warnings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        severity: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: ["title", "description", "severity"],
                    },
                  },
                  lineup_suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        player_name: { type: "string" },
                        recommendation: { type: "string", enum: ["start", "bench", "monitor"] },
                        reasoning: { type: "string" },
                      },
                      required: ["player_name", "recommendation", "reasoning"],
                    },
                  },
                  set_piece_plan: { type: "string", description: "Set piece strategy" },
                  own_risk_factors: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["title", "description"],
                    },
                  },
                  confidence_note: { type: "string", description: "How confident is this preparation and why" },
                  match_history_count: { type: "number", description: "How many previous matches were used" },
                },
                required: ["recommended_formation", "formation_reasoning", "tactical_priorities", "opponent_warnings", "lineup_suggestions", "set_piece_plan", "own_risk_factors", "confidence_note", "match_history_count"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_preparation" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      const errorMsg = aiResponse.status === 429 ? "Rate limit erreicht" : aiResponse.status === 402 ? "AI-Kontingent aufgebraucht" : `AI-Fehler: ${aiResponse.status}`;
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: aiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured response from AI");

    const preparation = JSON.parse(toolCall.function.arguments);

    // Store in DB
    const { data: stored, error: storeError } = await supabase
      .from("match_preparations")
      .insert({
        club_id,
        opponent_name,
        preparation_data: preparation,
      })
      .select()
      .single();

    if (storeError) throw storeError;

    return new Response(JSON.stringify({ success: true, preparation: stored }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("match-preparation error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
