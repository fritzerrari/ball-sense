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

  try {
    const { match_id, job_id, frames: inlineFrames, duration_sec: inlineDuration } = await req.json();
    if (!match_id || !job_id) {
      return new Response(JSON.stringify({ error: "match_id and job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let frames = inlineFrames as string[] | undefined;
    let duration_sec = inlineDuration as number | undefined;

    // If no inline frames, load from Storage (retry/reprocess case)
    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      console.log("No inline frames, loading from storage...");
      const { data: fileData, error: dlError } = await supabase.storage
        .from("match-frames")
        .download(`${match_id}.json`);

      if (dlError || !fileData) {
        await supabase.from("analysis_jobs").update({
          status: "failed",
          error_message: "Keine Frames gefunden. Bitte Video erneut hochladen.",
        }).eq("id", job_id);
        return new Response(JSON.stringify({ error: "No frames available" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const parsed = JSON.parse(await fileData.text());
      frames = parsed.frames;
      duration_sec = parsed.duration_sec;

      if (!frames || frames.length === 0) {
        await supabase.from("analysis_jobs").update({
          status: "failed",
          error_message: "Gespeicherte Frames sind leer.",
        }).eq("id", job_id);
        return new Response(JSON.stringify({ error: "Stored frames empty" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update job status
    await supabase.from("analysis_jobs").update({
      status: "analyzing",
      started_at: new Date().toISOString(),
      progress: 10,
    }).eq("id", job_id);

    // Get match info with field calibration data
    const { data: match } = await supabase
      .from("matches")
      .select("*, fields(name, width_m, height_m, calibration)")
      .eq("id", match_id)
      .single();

    // Extract calibration context for better analysis
    const fieldCalibration = match?.fields?.calibration as any;
    const coverage = fieldCalibration?.coverage ?? "full";
    const fieldType = fieldCalibration?.field_type ?? "unknown";
    const calibrationNote = coverage !== "full"
      ? `\nWICHTIG: Die Kamera zeigt nur einen Teilausschnitt des Feldes (${coverage === "left_half" ? "linke Hälfte" : coverage === "right_half" ? "rechte Hälfte" : "individueller Ausschnitt"}). Positionsangaben normalisieren auf das GESAMTE Feld.`
      : "";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      await supabase.from("analysis_jobs").update({
        status: "failed",
        error_message: "AI gateway not configured",
      }).eq("id", job_id);
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Select subset of frames (max ~20)
    const maxFrames = 20;
    let selectedFrames = frames!;
    if (selectedFrames.length > maxFrames) {
      const step = selectedFrames.length / maxFrames;
      selectedFrames = Array.from({ length: maxFrames }, (_, i) =>
        frames![Math.min(Math.floor(i * step), frames!.length - 1)]
      );
    }

    await supabase.from("analysis_jobs").update({ progress: 25 }).eq("id", job_id);

    // Build multi-image message
    const userContent: any[] = [
      {
        type: "text",
        text: `Analysiere diese ${selectedFrames.length} Standbilder eines Fußballspiels (alle ${Math.round((duration_sec ?? 0) / selectedFrames.length)} Sekunden aufgenommen).

Kontext:
- ${match?.away_club_name ? `Heim vs ${match.away_club_name}` : "Spiel"}
- Datum: ${match?.date ?? "unbekannt"}
- Platzgröße: ${match?.fields?.width_m ?? 105}x${match?.fields?.height_m ?? 68}m
- Feldtyp: ${fieldType !== "unknown" ? fieldType : "Standard-Großfeld"}
- Gesamtdauer: ca. ${duration_sec ? Math.round(duration_sec / 60) : "?"} Minuten${calibrationNote}

Analysiere was du auf den Bildern TATSÄCHLICH siehst:
- Spielerverteilung und Formationen
- Angriffsrichtungen und Raumbesetzung
- Erkennbare Muster und Spielphasen
- Ballpositionen und Druckzonen
- Für JEDEN Frame: Schätze die ungefähren Positionen (x,y in 0-100% des Spielfelds) aller erkennbaren Spieler beider Teams und des Balls. x=0 ist die linke Torlinie, x=100 die rechte. y=0 oben, y=100 unten. Gib auch eine kurze Beschreibung der Szene pro Frame.
- Für JEDEN Frame: Schätze den sichtbaren Feldausschnitt (visible_area). Wenn die Kamera geschwenkt oder gezoomt wurde, zeigen verschiedene Frames unterschiedliche Bereiche.
- Für JEDEN Frame: Schätze die Pressing-Linie beider Teams (y-Koordinate des höchsten Verteidigungsspielers, 0=oben, 100=unten) und die Kompaktheit (Abstand zwischen höchstem und tiefstem Feldspieler).
- Erkenne Umschaltmomente: Wann gewinnt ein Team den Ball und kontert? Wann verliert ein Team den Ball und presst sofort nach?
- Schätze die Passrichtungs-Tendenzen: Bevorzugt das Team lange oder kurze Bälle? Spielaufbau über links, zentral oder rechts?
- Erkenne Formationswechsel im Spielverlauf: Wann ändert sich die Grundordnung? Was war der Auslöser?

WICHTIG: 
- Beschreibe NUR was du siehst. Wenn ein Bild unklar ist, sage das ehrlich.
- Wenn ein Frame eine Nahaufnahme zeigt (< 30% Feldabdeckung), markiere ihn als "detail" Frame.
- Frames mit schlechter Qualität oder ohne erkennbares Spielfeld als "unusable" markieren.`,
      },
    ];

    for (const frame of selectedFrames) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${frame}` },
      });
    }

    await supabase.from("analysis_jobs").update({ progress: 40 }).eq("id", job_id);

    // Use lighter model for live partial analysis or very few frames
    const isLightweight = (inlineFrames && inlineFrames.length < 5) || 
      (await req.clone().json().catch(() => ({}))).phase === "live_partial";
    const modelName = isLightweight ? "google/gemini-2.5-flash-lite" : "google/gemini-2.5-flash";
    console.log(`Using model: ${modelName} (${selectedFrames.length} frames, lightweight: ${isLightweight})`);

    const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "system",
            content: `Du bist ein erfahrener Fußball-Analyst. Du analysierst Standbilder eines Fußballspiels.
Fokussiere dich auf das, was du TATSÄCHLICH auf den Bildern erkennst.
Sei ehrlich über die Grenzen deiner Analyse. Markiere geschätzte Werte als solche.`,
          },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_analysis",
              description: "Submit structured match analysis based on observed frames",
              parameters: {
                type: "object",
                properties: {
                  match_structure: {
                    type: "object",
                    properties: {
                      dominant_team: { type: "string", enum: ["home", "away", "balanced"] },
                      tempo: { type: "string", enum: ["high", "medium", "low"] },
                      phases: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            period: { type: "string" },
                            description: { type: "string" },
                            momentum: { type: "string", enum: ["home", "away", "neutral"] },
                          },
                          required: ["period", "description", "momentum"],
                        },
                      },
                    },
                    required: ["dominant_team", "tempo", "phases"],
                  },
                  danger_zones: {
                    type: "object",
                    properties: {
                      home_attack_zones: { type: "array", items: { type: "string", enum: ["left", "center", "right"] } },
                      away_attack_zones: { type: "array", items: { type: "string", enum: ["left", "center", "right"] } },
                      home_vulnerable_zones: { type: "array", items: { type: "string" } },
                      away_vulnerable_zones: { type: "array", items: { type: "string" } },
                    },
                    required: ["home_attack_zones", "away_attack_zones"],
                  },
                  chances: {
                    type: "object",
                    properties: {
                      home_chances: { type: "integer" },
                      away_chances: { type: "integer" },
                      home_shots: { type: "integer" },
                      away_shots: { type: "integer" },
                      pattern_notes: { type: "string" },
                    },
                    required: ["home_chances", "away_chances"],
                  },
                  ball_loss_patterns: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        zone: { type: "string" },
                        frequency: { type: "string", enum: ["frequent", "occasional", "rare"] },
                        description: { type: "string" },
                      },
                      required: ["zone", "frequency", "description"],
                    },
                  },
                  frame_positions: {
                    type: "array",
                    description: "For each analyzed frame, estimate approximate player and ball positions on the pitch (0-100 coordinate system). Only include players you can clearly see.",
                    items: {
                      type: "object",
                      properties: {
                      frame_index: { type: "integer", description: "0-based index of the frame" },
                        label: { type: "string", description: "Short description of what happens in this frame, e.g. 'Angriff über links'" },
                        frame_type: { type: "string", enum: ["tactical", "detail", "unusable"], description: "tactical = full field view, detail = close-up/zoom, unusable = blurry or no field visible" },
                        visible_area: {
                          type: "object",
                          description: "Estimated visible portion of the pitch in this frame",
                          properties: {
                            description: { type: "string", description: "e.g. 'Full pitch', 'Left half + center', 'Penalty area close-up'" },
                            estimated_coverage_pct: { type: "number", description: "Estimated percentage of total pitch visible (0-100)" },
                          },
                          required: ["description", "estimated_coverage_pct"],
                        },
                        ball: {
                          type: "object",
                          properties: {
                            x: { type: "number", description: "0=left goal line, 100=right goal line" },
                            y: { type: "number", description: "0=top touchline, 100=bottom touchline" },
                          },
                          required: ["x", "y"],
                        },
                        players: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              team: { type: "string", enum: ["home", "away"] },
                              x: { type: "number" },
                              y: { type: "number" },
                              role: { type: "string", description: "Optional: GK, DEF, MID, FWD if identifiable" },
                            },
                            required: ["team", "x", "y"],
                          },
                        },
                      },
                      required: ["frame_index", "ball", "players", "frame_type", "visible_area"],
                    },
                  },
                  pressing_data: {
                    type: "array",
                    description: "For each analyzed frame, estimate pressing line heights and team compactness. pressing_line = y-coordinate (0-100) of the highest defensive line player. compactness = distance between highest and deepest outfield player.",
                    items: {
                      type: "object",
                      properties: {
                        frame_index: { type: "integer" },
                        pressing_line_home: { type: "number", description: "y-coordinate (0-100) of highest home defensive player" },
                        pressing_line_away: { type: "number", description: "y-coordinate (0-100) of highest away defensive player" },
                        compactness_home: { type: "number", description: "Distance (0-100) between highest and deepest home outfield player" },
                        compactness_away: { type: "number", description: "Distance (0-100) between highest and deepest away outfield player" },
                      },
                      required: ["frame_index", "pressing_line_home", "pressing_line_away", "compactness_home", "compactness_away"],
                    },
                  },
                  transitions: {
                    type: "array",
                    description: "Detected transition moments: ball wins leading to counters or ball losses leading to gegenpressing.",
                    items: {
                      type: "object",
                      properties: {
                        frame_index: { type: "integer" },
                        type: { type: "string", enum: ["ball_win_counter", "ball_loss_gegenpressing"] },
                        speed: { type: "string", enum: ["fast", "medium", "slow"] },
                        players_in_new_phase: { type: "integer", description: "How many players transitioned within ~5 seconds" },
                        description: { type: "string" },
                      },
                      required: ["frame_index", "type", "speed", "players_in_new_phase", "description"],
                    },
                  },
                  pass_directions: {
                    type: "object",
                    description: "Estimated passing tendencies for both teams based on observed build-up patterns.",
                    properties: {
                      home: {
                        type: "object",
                        properties: {
                          long_pct: { type: "number" },
                          short_pct: { type: "number" },
                          build_up_left_pct: { type: "number" },
                          build_up_center_pct: { type: "number" },
                          build_up_right_pct: { type: "number" },
                        },
                        required: ["long_pct", "short_pct", "build_up_left_pct", "build_up_center_pct", "build_up_right_pct"],
                      },
                      away: {
                        type: "object",
                        properties: {
                          long_pct: { type: "number" },
                          short_pct: { type: "number" },
                          build_up_left_pct: { type: "number" },
                          build_up_center_pct: { type: "number" },
                          build_up_right_pct: { type: "number" },
                        },
                        required: ["long_pct", "short_pct", "build_up_left_pct", "build_up_center_pct", "build_up_right_pct"],
                      },
                    },
                    required: ["home", "away"],
                  },
                  formation_timeline: {
                    type: "array",
                    description: "Formation changes detected throughout the match. Include at least one entry for the starting formation.",
                    items: {
                      type: "object",
                      properties: {
                        frame_index: { type: "integer" },
                        minute_approx: { type: "integer" },
                        home_formation: { type: "string", description: "e.g. 4-4-2, 4-3-3, 3-5-2" },
                        away_formation: { type: "string", description: "e.g. 4-4-2, 4-3-3, 3-5-2" },
                        change_trigger: { type: "string", description: "What triggered the change, e.g. 'substitution', 'tactical adjustment', 'losing'" },
                      },
                      required: ["frame_index", "minute_approx", "home_formation", "away_formation"],
                    },
                  },
                  visual_quality: { type: "string", enum: ["good", "moderate", "poor"] },
                  confidence: { type: "number" },
                },
                required: ["match_structure", "danger_zones", "chances", "ball_loss_patterns", "frame_positions", "pressing_data", "transitions", "pass_directions", "formation_timeline", "visual_quality", "confidence"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_analysis" } },
      }),
    });

    if (!analysisResponse.ok) {
      const errText = await analysisResponse.text();
      console.error("AI gateway error:", analysisResponse.status, errText);
      const errorMessages: Record<number, string> = {
        429: "Rate limit erreicht. Bitte später erneut versuchen.",
        402: "AI-Kontingent aufgebraucht.",
      };
      if (errorMessages[analysisResponse.status]) {
        await supabase.from("analysis_jobs").update({
          status: "failed",
          error_message: errorMessages[analysisResponse.status],
        }).eq("id", job_id);
        return new Response(JSON.stringify({ error: errorMessages[analysisResponse.status] }), {
          status: analysisResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${analysisResponse.status}`);
    }

    const aiResult = await analysisResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call response from AI");

    const analysis = JSON.parse(toolCall.function.arguments);
    await supabase.from("analysis_jobs").update({ progress: 70 }).eq("id", job_id);

    // Delete old analysis results for this match before inserting new ones (reprocess case)
    await supabase.from("analysis_results").delete().eq("match_id", match_id);

    // Store analysis results
    const resultTypes = [
      { type: "match_structure", data: analysis.match_structure },
      { type: "danger_zones", data: analysis.danger_zones },
      { type: "chances", data: analysis.chances },
      { type: "ball_loss_patterns", data: analysis.ball_loss_patterns },
      ...(analysis.frame_positions?.length ? [{ type: "frame_positions", data: { frames: analysis.frame_positions, interval_sec: Math.round((duration_sec ?? 0) / selectedFrames.length) } }] : []),
      ...(analysis.pressing_data?.length ? [{ type: "pressing_data", data: analysis.pressing_data }] : []),
      ...(analysis.transitions?.length ? [{ type: "transitions", data: analysis.transitions }] : []),
      ...(analysis.pass_directions ? [{ type: "pass_directions", data: analysis.pass_directions }] : []),
      ...(analysis.formation_timeline?.length ? [{ type: "formation_timeline", data: analysis.formation_timeline }] : []),
    ];

    for (const result of resultTypes) {
      await supabase.from("analysis_results").insert({
        job_id, match_id,
        result_type: result.type,
        data: result.data,
        confidence: analysis.confidence ?? 0.5,
      });
    }

    // Set status to interpreting and trigger generate-insights SERVER-SIDE
    await supabase.from("analysis_jobs").update({ progress: 85, status: "interpreting" }).eq("id", job_id);

    // Fire-and-forget: trigger generate-insights from server (no client dependency)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    fetch(`${supabaseUrl}/functions/v1/generate-insights`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ match_id, job_id }),
    }).catch((err) => console.error("generate-insights server trigger error:", err));

    return new Response(JSON.stringify({
      success: true,
      frames_analyzed: selectedFrames.length,
      visual_quality: analysis.visual_quality,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-match error:", error);
    const errMsg = error instanceof Error ? error.message : "Unbekannter Fehler bei der Analyse";
    // Always mark job as failed so UI shows retry
    if (job_id) {
      await supabase.from("analysis_jobs").update({
        status: "failed",
        error_message: errMsg,
      }).eq("id", job_id);
    }
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
