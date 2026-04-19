import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let job_id: string | undefined;

  try {
    const body = await req.json();
    const match_id = body.match_id;
    job_id = body.job_id;

    if (!match_id || !job_id) {
      return new Response(JSON.stringify({ error: "match_id and job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: match } = await supabase
      .from("matches")
      .select("*, fields(name)")
      .eq("id", match_id)
      .single();

    // Fetch manual match events (goals, cards, fouls, etc.)
    const { data: matchEvents } = await supabase
      .from("match_events")
      .select("*")
      .eq("match_id", match_id)
      .order("minute", { ascending: true });

    // Calculate actual half durations from timing columns
    let timingContext = "";
    if (match) {
      const h1Start = match.h1_started_at ? new Date(match.h1_started_at) : null;
      const h1End = match.h1_ended_at ? new Date(match.h1_ended_at) : null;
      const h2Start = match.h2_started_at ? new Date(match.h2_started_at) : null;
      const h2End = match.h2_ended_at ? new Date(match.h2_ended_at) : null;
      const recStart = match.recording_started_at ? new Date(match.recording_started_at) : null;
      const recEnd = match.recording_ended_at ? new Date(match.recording_ended_at) : null;

      const parts: string[] = [];
      if (h1Start && h1End) {
        const h1Min = Math.round((h1End.getTime() - h1Start.getTime()) / 60000);
        parts.push(`1. Halbzeit: ${h1Min} Minuten`);
      }
      if (h2Start && h2End) {
        const h2Min = Math.round((h2End.getTime() - h2Start.getTime()) / 60000);
        parts.push(`2. Halbzeit: ${h2Min} Minuten`);
      }
      if (recStart && recEnd) {
        const totalMin = Math.round((recEnd.getTime() - recStart.getTime()) / 60000);
        parts.push(`Gesamtaufnahme: ${totalMin} Minuten`);
      }
      if (parts.length > 0) {
        timingContext = `\n\nSPIELZEIT-DATEN (exakte Messung):\n${parts.join("\n")}`;
      }
    }
    const { data: results } = await supabase
      .from("analysis_results")
      .select("*")
      .eq("match_id", match_id);

    const relevantResults = results?.filter(r => r.job_id === job_id) ?? results ?? [];

    if (!relevantResults.length) {
      await supabase.from("analysis_jobs").update({
        status: "failed",
        error_message: "Keine Analyseergebnisse gefunden",
      }).eq("id", job_id);
      return new Response(JSON.stringify({ error: "No analysis results" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      await supabase.from("analysis_jobs").update({
        status: "failed",
        error_message: "AI gateway not configured",
      }).eq("id", job_id);
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Detect low-vision frames (camera coverage poor) — used to downweight vision-only claims
    const camPersp = relevantResults.find((r: any) => r.result_type === "camera_perspective")?.data;
    const lowVision = !!camPersp && (camPersp.estimated_pitch_coverage_pct ?? 100) < 80;
    const visionCaveat = lowVision
      ? `\n\nKAMERA-QUALITÄT: ${camPersp.coverage_description ?? "eingeschränkte Sicht"} (Pitch-Coverage ~${camPersp.estimated_pitch_coverage_pct}%). VISION-BASIERTE AUSSAGEN sind dadurch unsicher — VERLASSE DICH PRIMÄR auf manuell erfasste Events (Tore, Schüsse, Karten, Eckbälle) und das Endergebnis. Schreibe NIEMALS "schlechte Sicht macht Bewertung unmöglich" — interpretiere stattdessen die EVENTS und ziehe daraus konkrete taktische Schlüsse.`
      : "";

    const analysisContext = relevantResults.map(r => `${r.result_type}: ${JSON.stringify(r.data)}`).join("\n\n");
    const matchInfo = `${match?.away_club_name ? `Heim vs ${match.away_club_name}` : "Spiel"} am ${match?.date ?? "?"}`;

    // Detect simulated H2 — produced by analyze-match when no H2 frames available
    const h2Sim = relevantResults.find((r: any) => r.result_type === "h2_simulated")?.data;
    const h2SimNote = h2Sim
      ? `\n\nWICHTIG — H2 SIMULIERT: Es gibt KEINE realen Aufnahmen der 2. Halbzeit. Die folgenden H2-Werte wurden auf Basis der H1-Muster synthetisiert (Intensitätsdämpfung ~${h2Sim.intensity_drop_pct ?? 18}%, beide Teams etwas schwächer).\n\nH2-SIMULATIONS-DATEN:\n${JSON.stringify(h2Sim, null, 2)}\n\nFüge im executive_summary und in den key_insights MINDESTENS EINEN klaren Hinweis ein, dass H2 simuliert wurde und die Aussagen für die zweite Halbzeit Hochrechnungen sind. Confidence für H2-Aussagen MUSS "estimated" sein.`
      : "";

    // Build match events context
    let eventsContext = "";
    if (matchEvents && matchEvents.length > 0) {
      const eventLines = matchEvents.map((e: any) =>
        `Min ${e.minute}: ${e.event_type} (${e.team})${e.player_name ? ` — ${e.player_name}` : ""}${e.notes ? ` [${e.notes}]` : ""}`
      );

      // Use manually corrected score (Ground Truth) if available, else count from events
      const hasGroundTruth = match?.home_score != null && match?.away_score != null;
      let homeGoals: number;
      let awayGoals: number;
      let scoreSource: string;

      if (hasGroundTruth) {
        homeGoals = match.home_score;
        awayGoals = match.away_score;
        scoreSource = "manuell korrigiertes Endergebnis (Ground Truth vom Trainer)";
      } else {
        homeGoals = matchEvents.filter((e: any) => e.event_type === "goal" && e.team === "home").length;
        awayGoals = matchEvents.filter((e: any) => e.event_type === "goal" && e.team === "away").length;
        scoreSource = "berechnet aus erfassten Tor-Events";
      }

      // Aggregate event facts per team — fact backbone when vision is poor
      const countBy = (type: string, team: string) =>
        matchEvents.filter((e: any) => e.event_type === type && e.team === team).length;
      const homeShotsOn = countBy("shot_on_target", "home");
      const awayShotsOn = countBy("shot_on_target", "away");
      const homeShotsOff = countBy("shot_off_target", "home");
      const awayShotsOff = countBy("shot_off_target", "away");
      const homeShots = homeShotsOn + homeShotsOff;
      const awayShots = awayShotsOn + awayShotsOff;
      const homeCorners = countBy("corner", "home");
      const awayCorners = countBy("corner", "away");
      const homeFouls = countBy("foul", "home");
      const awayFouls = countBy("foul", "away");
      const homeYellow = countBy("yellow_card", "home");
      const awayYellow = countBy("yellow_card", "away");
      const homeRed = countBy("red_card", "home");
      const awayRed = countBy("red_card", "away");
      const homeConv = homeShots > 0 ? Math.round((homeGoals / homeShots) * 100) : 0;
      const awayConv = awayShots > 0 ? Math.round((awayGoals / awayShots) * 100) : 0;
      const homeOnRate = homeShots > 0 ? Math.round((homeShotsOn / homeShots) * 100) : 0;
      const awayOnRate = awayShots > 0 ? Math.round((awayShotsOn / awayShots) * 100) : 0;
      const goalMins = matchEvents
        .filter((e: any) => e.event_type === "goal")
        .map((e: any) => `${e.team === "home" ? "Heim" : "Gast"} ${e.minute}'`);

      const factSheet = `\nTEAM-EVENT-BILANZ (manuell erfasst — GROUND TRUTH):\n` +
        `                 Heim |  Gast\n` +
        `Tore:            ${String(homeGoals).padStart(4)} | ${String(awayGoals).padStart(5)}\n` +
        `Schüsse gesamt:  ${String(homeShots).padStart(4)} | ${String(awayShots).padStart(5)}\n` +
        `Schüsse aufs Tor:${String(homeShotsOn).padStart(4)} | ${String(awayShotsOn).padStart(5)}\n` +
        `Eckbälle:        ${String(homeCorners).padStart(4)} | ${String(awayCorners).padStart(5)}\n` +
        `Fouls:           ${String(homeFouls).padStart(4)} | ${String(awayFouls).padStart(5)}\n` +
        `Gelb / Rot:      ${homeYellow}/${homeRed}  | ${awayYellow}/${awayRed}\n\n` +
        `EFFIZIENZ:\n` +
        `Heim — ${homeOnRate}% Schussgenauigkeit, ${homeConv}% Verwertung\n` +
        `Gast — ${awayOnRate}% Schussgenauigkeit, ${awayConv}% Verwertung\n\n` +
        `TOR-VERTEILUNG: ${goalMins.length > 0 ? goalMins.join(", ") : "keine Tore erfasst"}\n`;

      eventsContext = `\n\nMANUELL ERFASSTE EREIGNISSE (vom Trainer während des Spiels eingetragen — diese sind FAKTEN, nicht Schätzungen):\n${eventLines.join("\n")}\n\nENDERGEBNIS (${scoreSource}): Heim ${homeGoals} : ${awayGoals} Gast\n${factSheet}\nKRITISCH: Diese Zahlen sind GROUND TRUTH. Verwerte ALLE Werte aus der Team-Event-Bilanz in 'chance_quality_analysis', 'tactical_blueprint' und 'match_rating'. Schreibe NIE "0 Chancen", "keine Daten" oder "schlechte Sicht macht Bewertung unmöglich" wenn Schüsse, Eckbälle oder Tore erfasst sind. Die team-Angabe (home=Heimteam, away=Gast) bestimmt eindeutig, wem ein Event gehört.`;
    }
    await supabase.from("analysis_jobs").update({ progress: 90 }).eq("id", job_id);

    const insightsResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `Du bist ein Elite-Fußball-Analyst (UEFA-Pro-Niveau), der für einen Cheftrainer das Spielresümee verfasst. Dein Stil: präzise, datengestützt, handlungsleitend — wie ein Match-Briefing eines Performance-Departments.

DATEN-HIERARCHIE (zwingend einzuhalten):
1. MANUELL ERFASSTE EVENTS (Tore, Schüsse, Eckbälle, Karten, Fouls) sind GROUND TRUTH und IMMER zu verwenden.
2. Endergebnis und Tor-Verteilung kommen aus dem TEAM-EVENT-BILANZ-Block.
3. Vision-Daten (frame_positions, formation_timeline, danger_zones) sind ergänzend — bei eingeschränkter Kamera-Coverage NIEMALS dominant.
4. NIEMALS schreiben "keine Daten", "0 Chancen", "schlechte Sicht macht Bewertung unmöglich" wenn Events vorliegen — interpretiere Events stattdessen taktisch.

DEINE AUFGABE: Erstelle ein hochprofessionelles Coaching-Cockpit:

1. EXECUTIVE_SUMMARY (3 Absätze): Endstand mit Tor-Minuten nennen, Spielverlauf in Phasen erzählen, taktische Kernerkenntnis. KEINE Floskeln.
2. MATCH RATING (1-10 + Sub-Scores für offense/defense/transitions/discipline) — discipline aus Karten/Fouls ableiten.
3. CHANCE_QUALITY_ANALYSIS: Schussqualität pro Team — Schussgenauigkeit, Verwertungsquote, dominante Phase, Standard-Effizienz (Eckbälle vs. Tore aus Standards).
4. TACTICAL_BLUEPRINT: 4 konkrete taktische Bausteine (jeweils {dimension, headline, observation, recommendation, evidence}) — KEINE Schulnoten, sondern handlungsleitende Aussagen wie "Spielaufbau über rechte Seite — 65% der Eckbälle aus dieser Zone, in der nächsten Sitzung Doppelpass-Sequenzen Außenverteidiger/Achter trainieren".
5. SHAPE_RECOMMENDATION: Empfohlene Formation für nächstes Spiel + Begründung aus dem Spielverlauf.
6. SET_PIECE_BREAKDOWN: Standards-Bilanz (gewonnen/verteidigt) + Empfehlung.
7. MOMENTUM_PHASES (6-10 Punkte, -100..+100). Tor-Minuten MÜSSEN als Spitzen erscheinen.
8. RISK_MATRIX (3-5 spezifische Schwachstellen mit Severity 1-5 + Urgency).
9. PLAYER_SPOTLIGHT (MVP + Concern, basierend auf Mustern, ohne Namen wenn nicht eindeutig).
10. OPPONENT_DNA (6 Spider-Werte 0-100 + Style-Label).
11. NEXT_MATCH_ACTIONS (3 DO + 3 DON'T, sehr konkret).
12. COACHING_CONCLUSIONS (2-3 Absätze, deep tactical).
13. TRAINING_MICRO_CYCLE (3 Sessions: recovery/intensity/tactical mit Drills).
14. TRAINING_RECOMMENDATIONS (3-5 Items).

REGELN:
- Beziehe konkrete Zahlen aus der TEAM-EVENT-BILANZ in JEDE Aussage ein (z.B. "5 von 7 Schüssen aufs Tor — 71% Genauigkeit").
- TACTICAL_BLUEPRINT ersetzt das alte "Notensystem" — schreibe wie ein Performance-Coach, nicht wie ein Lehrer.
- Bei wenigen Events: Sage WAS du aus den vorhandenen Daten ableitest, nicht WAS FEHLT.
- Sprache: Deutsch, knapp, aktiv, kein Konjunktiv.
- Tor-Minuten und Endergebnis MÜSSEN exakt mit dem Ground-Truth-Fact-Sheet übereinstimmen.${visionCaveat ? "\n- Bei eingeschränkter Kamera-Sicht: VERLASSE DICH AUF EVENTS, schweige nicht." : ""}`,
          },
          {
            role: "user",
            content: `Erstelle das vollständige Coaching-Cockpit für: ${matchInfo}\n\nAnalyse-Ergebnisse:\n${analysisContext}${eventsContext}${timingContext}${h2SimNote}${visionCaveat}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_cockpit",
              description: "Submit the complete coaching cockpit data",
              parameters: {
                type: "object",
                properties: {
                  match_rating: {
                    type: "object",
                    description: "Overall match rating with sub-scores and final score",
                    properties: {
                      overall: { type: "number", description: "Overall match rating 1-10" },
                      offense: { type: "number", description: "Offense sub-score 1-10" },
                      defense: { type: "number", description: "Defense sub-score 1-10" },
                      transitions: { type: "number", description: "Transitions sub-score 1-10" },
                      discipline: { type: "number", description: "Discipline sub-score 1-10" },
                      home_goals: { type: "number", description: "Total goals scored by home team" },
                      away_goals: { type: "number", description: "Total goals scored by away team" },
                    },
                    required: ["overall", "offense", "defense", "transitions", "discipline", "home_goals", "away_goals"],
                  },
                  tactical_grades: {
                    type: "array",
                    description: "Tactical grade cards A-F for 6 dimensions",
                    items: {
                      type: "object",
                      properties: {
                        dimension: { type: "string", description: "e.g. pressing, build_up, final_third, defensive_shape, transitions, set_pieces" },
                        grade: { type: "string", description: "A, B, C, D, E, or F" },
                        reasoning: { type: "string", description: "1-2 sentence justification for the grade" },
                      },
                      required: ["dimension", "grade", "reasoning"],
                    },
                  },
                  momentum_phases: {
                    type: "array",
                    description: "Minute-by-minute momentum data for visualization",
                    items: {
                      type: "object",
                      properties: {
                        minute: { type: "number" },
                        score: { type: "number", description: "-100 to +100, positive = home dominance" },
                        event: { type: "string", description: "Optional key event at this minute" },
                      },
                      required: ["minute", "score"],
                    },
                  },
                  executive_summary: { type: "string", description: "3-paragraph executive match summary — Endstand mit Tor-Minuten, Spielverlauf in Phasen, taktische Kernerkenntnis. Keine 'schlechte Sicht'-Floskeln." },
                  chance_quality_analysis: {
                    type: "object",
                    description: "Schussqualität & Effizienz pro Team",
                    properties: {
                      home: { type: "object", properties: { shots_total: { type: "number" }, shots_on_target: { type: "number" }, accuracy_pct: { type: "number" }, conversion_pct: { type: "number" }, summary: { type: "string" } }, required: ["shots_total","shots_on_target","accuracy_pct","conversion_pct","summary"] },
                      away: { type: "object", properties: { shots_total: { type: "number" }, shots_on_target: { type: "number" }, accuracy_pct: { type: "number" }, conversion_pct: { type: "number" }, summary: { type: "string" } }, required: ["shots_total","shots_on_target","accuracy_pct","conversion_pct","summary"] },
                      verdict: { type: "string", description: "Wer hatte die qualitativ besseren Chancen und warum" },
                    },
                    required: ["home", "away", "verdict"],
                  },
                  tactical_blueprint: {
                    type: "array",
                    description: "4 handlungsleitende taktische Bausteine — ersetzt schwammige Schulnoten",
                    items: {
                      type: "object",
                      properties: {
                        dimension: { type: "string" },
                        headline: { type: "string" },
                        observation: { type: "string", description: "Was wurde beobachtet (mit Zahlen)" },
                        recommendation: { type: "string", description: "Konkrete Empfehlung" },
                        evidence: { type: "string", description: "Belegende Datenpunkte" },
                      },
                      required: ["dimension","headline","observation","recommendation","evidence"],
                    },
                  },
                  shape_recommendation: {
                    type: "object",
                    properties: {
                      formation: { type: "string" },
                      reasoning: { type: "string" },
                      key_roles: { type: "array", items: { type: "string" } },
                    },
                    required: ["formation","reasoning","key_roles"],
                  },
                  set_piece_breakdown: {
                    type: "object",
                    properties: {
                      home_corners: { type: "number" },
                      away_corners: { type: "number" },
                      goals_from_set_pieces: { type: "number" },
                      summary: { type: "string" },
                    },
                    required: ["home_corners","away_corners","goals_from_set_pieces","summary"],
                  },
                  key_insights: {
                    type: "array",
                    description: "5-7 key coaching insights with maximum depth",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string", description: "Detailed 3-4 sentence analysis" },
                        category: { type: "string", enum: ["offense", "defense", "transition", "set_piece", "general"] },
                        confidence: { type: "string", enum: ["high", "medium", "estimated"] },
                        impact_score: { type: "number", description: "1-10 impact on match outcome" },
                      },
                      required: ["title", "description", "category", "confidence", "impact_score"],
                    },
                  },
                  risk_matrix: {
                    type: "array",
                    description: "3-5 specific vulnerabilities",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        severity: { type: "number", description: "1-5" },
                        urgency: { type: "string", enum: ["immediate", "next_week", "monitor"] },
                        affected_zone: { type: "string", description: "e.g. right_defense, central_midfield" },
                      },
                      required: ["title", "description", "severity", "urgency"],
                    },
                  },
                  player_spotlight: {
                    type: "object",
                    description: "MVP and concern player",
                    properties: {
                      mvp: {
                        type: "object",
                        properties: {
                          description: { type: "string", description: "Who and why (based on patterns, not names)" },
                          key_actions: { type: "string" },
                          rating: { type: "number", description: "1-10" },
                        },
                        required: ["description", "key_actions", "rating"],
                      },
                      concern: {
                        type: "object",
                        properties: {
                          description: { type: "string" },
                          issues: { type: "string" },
                          recommendation: { type: "string" },
                        },
                        required: ["description", "issues", "recommendation"],
                      },
                    },
                    required: ["mvp", "concern"],
                  },
                  opponent_dna: {
                    type: "object",
                    description: "Opponent style fingerprint for radar chart",
                    properties: {
                      possession_control: { type: "number", description: "0-100" },
                      pressing_intensity: { type: "number", description: "0-100" },
                      counter_attack_threat: { type: "number", description: "0-100" },
                      defensive_discipline: { type: "number", description: "0-100" },
                      set_piece_danger: { type: "number", description: "0-100" },
                      transition_speed: { type: "number", description: "0-100" },
                      style_label: { type: "string", description: "e.g. Ballbesitz-Kontrolleur, Konter-Spezialist, Pressing-Monster" },
                    },
                    required: ["possession_control", "pressing_intensity", "counter_attack_threat", "defensive_discipline", "set_piece_danger", "transition_speed", "style_label"],
                  },
                  next_match_actions: {
                    type: "object",
                    description: "Concrete do and don't for the next match",
                    properties: {
                      do_actions: {
                        type: "array",
                        items: { type: "string" },
                        description: "3 specific things to DO",
                      },
                      dont_actions: {
                        type: "array",
                        items: { type: "string" },
                        description: "3 specific things to AVOID",
                      },
                    },
                    required: ["do_actions", "dont_actions"],
                  },
                  coaching_conclusions: { type: "string", description: "2-3 paragraphs of deep tactical conclusions" },
                  training_micro_cycle: {
                    type: "array",
                    description: "3-session training week plan",
                    items: {
                      type: "object",
                      properties: {
                        session_number: { type: "number", description: "1, 2, or 3" },
                        session_type: { type: "string", description: "recovery, intensity, or tactical" },
                        title: { type: "string" },
                        goal: { type: "string", description: "Session goal" },
                        drills: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              duration_min: { type: "number" },
                              description: { type: "string" },
                              linked_pattern: { type: "string" },
                            },
                            required: ["name", "duration_min", "description"],
                          },
                        },
                      },
                      required: ["session_number", "session_type", "title", "goal", "drills"],
                    },
                  },
                  training_recommendations: {
                    type: "array",
                    description: "3-5 specific training recommendations",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        category: { type: "string", enum: ["offense", "defense", "transition", "set_piece"] },
                        priority: { type: "number", description: "1-3" },
                        linked_pattern: { type: "string" },
                      },
                      required: ["title", "description", "category", "priority", "linked_pattern"],
                    },
                  },
                },
                required: [
                  "match_rating", "tactical_grades", "momentum_phases",
                  "executive_summary", "chance_quality_analysis", "tactical_blueprint",
                  "shape_recommendation", "set_piece_breakdown",
                  "key_insights", "risk_matrix",
                  "player_spotlight", "opponent_dna", "next_match_actions",
                  "coaching_conclusions", "training_micro_cycle", "training_recommendations",
                ],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_cockpit" } },
      }),
    });

    if (!insightsResponse.ok) {
      const errText = await insightsResponse.text();
      console.error("AI insights error:", insightsResponse.status, errText);

      const errorMsg = insightsResponse.status === 429
        ? "Rate limit erreicht. Bitte später erneut versuchen."
        : insightsResponse.status === 402
        ? "AI-Kontingent aufgebraucht."
        : `AI-Fehler: ${insightsResponse.status}`;

      await supabase.from("analysis_jobs").update({
        status: "failed",
        error_message: errorMsg,
      }).eq("id", job_id);

      return new Response(JSON.stringify({ error: errorMsg }), {
        status: insightsResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await insightsResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      await supabase.from("analysis_jobs").update({
        status: "failed",
        error_message: "AI hat keine strukturierte Antwort geliefert",
      }).eq("id", job_id);
      throw new Error("No tool call in insights response");
    }

    const insights = JSON.parse(toolCall.function.arguments);

    // Delete old report data for this match (reprocess case)
    await supabase.from("report_sections").delete().eq("match_id", match_id);
    await supabase.from("training_recommendations").delete().eq("match_id", match_id);

    // Store report sections — cockpit data as JSON in content
    const sections = [
      { section_type: "match_rating", title: "Match Rating", content: JSON.stringify(insights.match_rating), confidence: "high", sort_order: 0 },
      { section_type: "tactical_grades", title: "Taktische Bewertung", content: JSON.stringify(insights.tactical_grades), confidence: "high", sort_order: 5 },
      { section_type: "momentum", title: "Momentum-Verlauf", content: JSON.stringify(insights.momentum_phases), confidence: "medium", sort_order: 7 },
      { section_type: "summary", title: "Zusammenfassung", content: insights.executive_summary, confidence: "high", sort_order: 10 },
      ...insights.key_insights.map((ins: any, i: number) => ({
        section_type: "insight",
        title: ins.title,
        content: JSON.stringify({ description: ins.description, impact_score: ins.impact_score, category: ins.category }),
        confidence: ins.confidence,
        sort_order: 20 + i,
      })),
      { section_type: "risk_matrix", title: "Risiko-Matrix", content: JSON.stringify(insights.risk_matrix), confidence: "high", sort_order: 40 },
      { section_type: "player_spotlight", title: "Spieler-Spotlight", content: JSON.stringify(insights.player_spotlight), confidence: "medium", sort_order: 45 },
      { section_type: "opponent_dna", title: "Gegner-DNA", content: JSON.stringify(insights.opponent_dna), confidence: "medium", sort_order: 50 },
      { section_type: "next_match_actions", title: "Nächstes Spiel", content: JSON.stringify(insights.next_match_actions), confidence: "high", sort_order: 55 },
      { section_type: "coaching", title: "Coaching-Schlussfolgerungen", content: insights.coaching_conclusions, confidence: "high", sort_order: 60 },
      { section_type: "training_micro_cycle", title: "Trainings-Mikrozyklus", content: JSON.stringify(insights.training_micro_cycle), confidence: "high", sort_order: 65 },
      ...(insights.opponent_scouting ? [{
        section_type: "opponent_scouting",
        title: "Gegner-Scouting",
        content: JSON.stringify(insights.opponent_scouting),
        confidence: "medium",
        sort_order: 70,
      }] : []),
    ];

    for (const section of sections) {
      await supabase.from("report_sections").insert({ match_id, ...section });
    }

    // Store training recommendations
    const { data: matchForClub } = await supabase.from("matches").select("home_club_id").eq("id", match_id).single();
    const clubId = matchForClub?.home_club_id;

    if (clubId) {
      for (const rec of insights.training_recommendations) {
        await supabase.from("training_recommendations").insert({
          match_id,
          club_id: clubId,
          title: rec.title,
          description: rec.description,
          category: rec.category,
          priority: rec.priority,
          linked_pattern: rec.linked_pattern,
        });
      }
    }

    // Mark job complete
    await supabase.from("analysis_jobs").update({
      status: "complete",
      progress: 100,
      completed_at: new Date().toISOString(),
    }).eq("id", job_id);

    // Determine if this is a final job or intermediate (H1) analysis
    const { data: currentJob } = await supabase
      .from("analysis_jobs")
      .select("job_kind")
      .eq("id", job_id)
      .single();
    const isFinalJob = currentJob?.job_kind === "final";

    const { data: matchTiming } = await supabase
      .from("matches")
      .select("recording_ended_at")
      .eq("id", match_id)
      .single();
    const isMatchFinished = !!matchTiming?.recording_ended_at;
    const shouldCleanup = isFinalJob || isMatchFinished;

    if (shouldCleanup) {
      // Final analysis: set done + full cleanup
      await supabase.from("matches").update({ status: "done" }).eq("id", match_id);

      // Notify all club members
      if (clubId) {
        const { data: clubProfiles } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("club_id", clubId);

        const matchLabel = match?.away_club_name ?? "Spiel";
        for (const profile of clubProfiles ?? []) {
          await supabase.from("notifications").insert({
            user_id: profile.user_id,
            match_id: match_id,
            type: "report_ready",
            title: "Analyse fertig",
            body: `Der Report für "${matchLabel}" am ${match?.date ?? ""} ist verfügbar.`,
          });
        }
      }

      // Cleanup frames
      const cleanupPaths = [`${match_id}.json`];
      for (let i = 0; i < 50; i++) {
        cleanupPaths.push(`${match_id}_chunk_${i}.json`);
      }
      cleanupPaths.push(`${match_id}_h1.json`, `${match_id}_h2.json`);
      // Multi-camera cleanup
      for (let cam = 0; cam < 4; cam++) {
        cleanupPaths.push(`${match_id}_cam${cam}.json`);
        for (let i = 0; i < 50; i++) {
          cleanupPaths.push(`${match_id}_cam${cam}_chunk_${i}.json`);
        }
        cleanupPaths.push(`${match_id}_cam${cam}_h1.json`, `${match_id}_cam${cam}_h2.json`);
      }
      await supabase.storage.from("match-frames").remove(cleanupPaths);
      console.log(`Final cleanup: removed frames for match ${match_id}`);

      // Cleanup camera sessions for this match
      await supabase.from("camera_access_sessions").delete().eq("match_id", match_id);
      console.log(`Final cleanup: removed camera sessions for match ${match_id}`);

      // Mark tracking uploads as processed
      await supabase.from("tracking_uploads").update({ status: "processed" }).eq("match_id", match_id);

      // Deactivate camera codes that have no remaining active sessions
      if (clubId) {
        const { data: activeSessions } = await supabase
          .from("camera_access_sessions")
          .select("code_id")
          .eq("club_id", clubId);
        const activeCodeIds = new Set((activeSessions ?? []).map((s: any) => s.code_id));
        const { data: allCodes } = await supabase
          .from("camera_access_codes")
          .select("id")
          .eq("club_id", clubId)
          .eq("active", true);
        for (const code of allCodes ?? []) {
          if (!activeCodeIds.has(code.id)) {
            await supabase.from("camera_access_codes").update({ active: false }).eq("id", code.id);
          }
        }
        console.log(`Final cleanup: deactivated orphaned camera codes for club ${clubId}`);
      }
    } else {
      // Intermediate analysis (H1): keep match in "processing", NO cleanup
      console.log(`Intermediate analysis for match ${match_id} — skipping cleanup, match stays in processing`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-insights error:", error);

    if (job_id) {
      const supabase2 = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await supabase2.from("analysis_jobs").update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unbekannter Fehler bei der Insight-Generierung",
      }).eq("id", job_id);
    }

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
