import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Try to load frames from storage with fallback chain. Camera-files are time-merged. */
async function loadFramesFromStorage(supabase: any, matchId: string): Promise<{ frames: string[]; duration_sec: number } | null> {
  const listChunkFiles = async (prefix: string): Promise<string[]> => {
    const { data } = await supabase.storage.from("match-frames").list("", {
      limit: 500,
      search: prefix,
    });
    return (data ?? [])
      .map((entry: { name: string }) => entry.name)
      .filter((name: string) => name.startsWith(prefix));
  };

  // 1. Try canonical file (already time-merged across all cameras by camera-ops)
  const { data: mainFile } = await supabase.storage.from("match-frames").download(`${matchId}.json`);
  if (mainFile) {
    try {
      const parsed = JSON.parse(await mainFile.text());
      if (parsed.frames?.length) return { frames: parsed.frames, duration_sec: parsed.duration_sec ?? 0 };
    } catch { /* corrupt */ }
  }

  // 2. Re-merge camera-specific canonical files (cam0-3) by timestamp.
  type Tagged = { frame: string; ts: number };
  const taggedCam: Tagged[] = [];
  let camDuration = 0;
  for (let cam = 0; cam < 4; cam++) {
    const { data: camFile } = await supabase.storage.from("match-frames").download(`${matchId}_cam${cam}.json`);
    if (!camFile) continue;
    try {
      const parsed = JSON.parse(await camFile.text());
      const fr: string[] = parsed.frames ?? [];
      const ts: number[] = parsed.timestamps ?? [];
      camDuration += parsed.duration_sec ?? 0;
      for (let i = 0; i < fr.length; i++) {
        // Stable synthetic ts if missing: order frames per cam, slightly offset by cam id.
        taggedCam.push({ frame: fr[i], ts: ts[i] ?? i * 30_000 + cam * 1_000 });
      }
    } catch { /* skip */ }
  }
  if (taggedCam.length > 0) {
    taggedCam.sort((a, b) => a.ts - b.ts);
    return { frames: taggedCam.map((t) => t.frame), duration_sec: camDuration };
  }

  // 3. Try half files (_h1 + _h2) — these are trainer self-recording snapshots.
  const allHalfFrames: string[] = [];
  let totalDuration = 0;
  for (const suffix of ["_h1", "_h2"]) {
    const { data: halfFile } = await supabase.storage.from("match-frames").download(`${matchId}${suffix}.json`);
    if (halfFile) {
      try {
        const parsed = JSON.parse(await halfFile.text());
        if (parsed.frames?.length) {
          allHalfFrames.push(...parsed.frames);
          totalDuration += parsed.duration_sec ?? 0;
        }
      } catch { /* skip */ }
    }
  }
  if (allHalfFrames.length > 0) return { frames: allHalfFrames, duration_sec: totalDuration };

  // 4. Try chunk files (camera-specific first, then legacy) — also time-merge if timestamps present.
  const taggedChunks: Tagged[] = [];
  for (let cam = 0; cam < 4; cam++) {
    const chunkNames = (await listChunkFiles(`${matchId}_cam${cam}_chunk_`))
      .sort((a: string, b: string) => {
        const aIdx = Number(a.match(/_chunk_(\d+)\.json$/)?.[1] ?? -1);
        const bIdx = Number(b.match(/_chunk_(\d+)\.json$/)?.[1] ?? -1);
        return aIdx - bIdx;
      });
    for (const chunkName of chunkNames) {
      try {
        const { data: chunkFile } = await supabase.storage.from("match-frames").download(chunkName);
        if (!chunkFile) continue;
        const parsed = JSON.parse(await chunkFile.text());
        const fr: string[] = parsed.frames ?? [];
        const ts: number[] = parsed.timestamps ?? [];
        const chunkIndex = Number(chunkName.match(/_chunk_(\d+)\.json$/)?.[1] ?? 0);
        for (let j = 0; j < fr.length; j++) {
          taggedChunks.push({ frame: fr[j], ts: ts[j] ?? (chunkIndex * 100 + j) * 30_000 + cam * 1_000 });
        }
      } catch { /* skip corrupt */ }
    }
  }
  // Then try legacy non-camera chunks
  const legacyChunkNames = (await listChunkFiles(`${matchId}_chunk_`))
    .sort((a: string, b: string) => {
      const aIdx = Number(a.match(/_chunk_(\d+)\.json$/)?.[1] ?? -1);
      const bIdx = Number(b.match(/_chunk_(\d+)\.json$/)?.[1] ?? -1);
      return aIdx - bIdx;
    });
  for (const chunkName of legacyChunkNames) {
    try {
      const { data: chunkFile } = await supabase.storage.from("match-frames").download(chunkName);
      if (!chunkFile) continue;
      const parsed = JSON.parse(await chunkFile.text());
      const fr: string[] = parsed.frames ?? [];
      const chunkIndex = Number(chunkName.match(/_chunk_(\d+)\.json$/)?.[1] ?? 0);
      for (let j = 0; j < fr.length; j++) {
        taggedChunks.push({ frame: fr[j], ts: (chunkIndex * 100 + j) * 30_000 });
      }
    } catch { /* skip corrupt */ }
  }
  if (taggedChunks.length > 0) {
    taggedChunks.sort((a, b) => a.ts - b.ts);
    return { frames: taggedChunks.map((t) => t.frame), duration_sec: taggedChunks.length * 30 };
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let job_id: string | undefined;

  try {
    const body = await req.json();
    const { match_id, job_id: bodyJobId, frames: inlineFrames, duration_sec: inlineDuration, phase } = body;
    job_id = bodyJobId;

    if (!match_id || !job_id) {
      return new Response(JSON.stringify({ error: "match_id and job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let frames = inlineFrames as string[] | undefined;
    let duration_sec = inlineDuration as number | undefined;
    const isLivePartial = phase === "live_partial";

    // If no inline frames, load from Storage with fallback chain
    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      console.log("No inline frames, loading from storage...");
      const storageResult = await loadFramesFromStorage(supabase, match_id);

      if (!storageResult) {
        await supabase.from("analysis_jobs").update({
          status: "failed",
          error_message: "Keine Frames gefunden. Bitte Video erneut hochladen.",
        }).eq("id", job_id);
        return new Response(JSON.stringify({ error: "No frames available" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      frames = storageResult.frames;
      duration_sec = storageResult.duration_sec;
    }

    if (!frames || frames.length === 0) {
      await supabase.from("analysis_jobs").update({
        status: "failed",
        error_message: "Gespeicherte Frames sind leer.",
      }).eq("id", job_id);
      return new Response(JSON.stringify({ error: "Stored frames empty" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
- Für JEDEN Frame: Schätze die Positionen (x,y in 0-100% des Spielfelds) ALLER Spieler beider Teams und des Balls. x=0 ist die linke Torlinie, x=100 die rechte. y=0 oben, y=100 unten. WICHTIG: Du MUSST für JEDES Team die volle Spieleranzahl liefern (z.B. 11 pro Team bei 11v11, 7 bei 7v7). Wenn Spieler nicht direkt sichtbar sind, schätze ihre Position basierend auf der erkannten Formation und Spielsituation und markiere sie mit "estimated": true. Gib auch Trikotnummern an, wenn erkennbar.
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
    const isLightweight = isLivePartial || selectedFrames.length < 5;
    const modelName = isLightweight ? "google/gemini-2.5-flash-lite" : "google/gemini-2.5-flash";
    console.log(`Using model: ${modelName} (${selectedFrames.length} frames, lightweight: ${isLightweight})`);

    const aiRequestBody = JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "system",
            content: `Du bist ein erfahrener Fußball-Analyst. Du analysierst Standbilder eines Fußballspiels.
Fokussiere dich auf das, was du TATSÄCHLICH auf den Bildern erkennst.
Sei ehrlich über die Grenzen deiner Analyse. Markiere geschätzte Werte als solche.

WICHTIGE REGELN ZUR SPIELERERKENNUNG:
- Das Spielformat ist UNBEKANNT. Es kann 3v3, 4v4, 5v5, 7v7, 9v9, 11v11 oder jede andere Variante sein (auch Trainingsspiele).
- Zähle die tatsächliche Anzahl erkannter Spieler pro Team. Gehe NICHT von 11v11 aus.
- SCHLIESSE Schiedsrichter, Linienrichter und andere Offizielle AUS. Diese tragen typischerweise schwarze/dunkle Einheitskleidung, bewegen sich isoliert entlang der Seitenlinien oder stehen abseits des Spielgeschehens.
- Wenn weniger Spieler sichtbar sind als logisch (z.B. 4 von geschätzt 7), notiere wie viele du SIEHST und schätze die Gesamtzahl basierend auf Formation und sichtbarem Feldausschnitt.

KAMERA-PERSPEKTIVE ERKENNEN:
- Bestimme die Kameraausrichtung: QUER (Seitenansicht von der Mittellinie), LÄNGS (hinter dem Tor), SCHRÄG (von der Eckfahne oder diagonal), TEILAUSSCHNITT (nur ein Bereich des Feldes sichtbar).
- Die Perspektive beeinflusst massiv, wie x/y Koordinaten zu interpretieren sind.
- Melde die erkannte Perspektive im Feld camera_perspective.`,
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
                          description: "ALL players of BOTH teams. You MUST include estimated positions for players not directly visible. For a detected 11v11 match, provide exactly 11 home + 11 away players. Mark non-visible players with estimated=true.",
                          items: {
                            type: "object",
                            properties: {
                              team: { type: "string", enum: ["home", "away"] },
                              x: { type: "number" },
                              y: { type: "number" },
                              role: { type: "string", description: "GK, DEF, MID, or FWD" },
                              number: { type: "integer", description: "Jersey number if identifiable" },
                              estimated: { type: "boolean", description: "true if this player position is estimated (not directly visible). Default false." },
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
                    description: "For each analyzed frame, estimate pressing line heights and team compactness.",
                    items: {
                      type: "object",
                      properties: {
                        frame_index: { type: "integer" },
                        pressing_line_home: { type: "number" },
                        pressing_line_away: { type: "number" },
                        compactness_home: { type: "number" },
                        compactness_away: { type: "number" },
                      },
                      required: ["frame_index", "pressing_line_home", "pressing_line_away", "compactness_home", "compactness_away"],
                    },
                  },
                  transitions: {
                    type: "array",
                    description: "Detected transition moments.",
                    items: {
                      type: "object",
                      properties: {
                        frame_index: { type: "integer" },
                        type: { type: "string", enum: ["ball_win_counter", "ball_loss_gegenpressing"] },
                        speed: { type: "string", enum: ["fast", "medium", "slow"] },
                        players_in_new_phase: { type: "integer" },
                        description: { type: "string" },
                      },
                      required: ["frame_index", "type", "speed", "players_in_new_phase", "description"],
                    },
                  },
                  pass_directions: {
                    type: "object",
                    description: "Estimated passing tendencies for both teams.",
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
                    description: "Formation changes detected throughout the match.",
                    items: {
                      type: "object",
                      properties: {
                        frame_index: { type: "integer" },
                        minute_approx: { type: "integer" },
                        home_formation: { type: "string" },
                        away_formation: { type: "string" },
                        change_trigger: { type: "string" },
                      },
                      required: ["frame_index", "minute_approx", "home_formation", "away_formation"],
                    },
                  },
                  camera_perspective: {
                    type: "object",
                    description: "Detected camera orientation and coverage",
                    properties: {
                      orientation: { type: "string", enum: ["landscape_side", "landscape_behind_goal", "diagonal", "partial"], description: "landscape_side=Seitenansicht von Mittellinie, landscape_behind_goal=hinter dem Tor, diagonal=Eckfahne/schräg, partial=nur Teilausschnitt" },
                      coverage_description: { type: "string", description: "e.g. 'Volle Seitenansicht von der Mittellinie' oder 'Hälfte des Feldes von schräg links'" },
                      estimated_pitch_coverage_pct: { type: "number", description: "Estimated percentage of pitch visible 0-100" },
                    },
                    required: ["orientation", "coverage_description", "estimated_pitch_coverage_pct"],
                  },
                  team_size_detected: {
                    type: "object",
                    description: "Detected team sizes (excluding referees)",
                    properties: {
                      home: { type: "integer", description: "Estimated total players in home team (e.g. 7 for 7v7)" },
                      away: { type: "integer", description: "Estimated total players in away team" },
                      format_label: { type: "string", description: "e.g. '7v7', '11v11', '5v5'" },
                      officials_excluded: { type: "integer", description: "Number of officials/referees identified and excluded" },
                    },
                    required: ["home", "away", "format_label"],
                  },
                  visual_quality: { type: "string", enum: ["good", "moderate", "poor"] },
                  confidence: { type: "number" },
                },
                required: ["match_structure", "danger_zones", "chances", "ball_loss_patterns", "frame_positions", "pressing_data", "transitions", "pass_directions", "formation_timeline", "camera_perspective", "team_size_detected", "visual_quality", "confidence"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_analysis" } },
      });

    // Retry logic for transient network errors (connection reset, timeout)
    const MAX_RETRIES = 3;
    let analysisResponse: Response | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: aiRequestBody,
        });
        break; // success — exit retry loop
      } catch (fetchErr) {
        console.error(`AI fetch attempt ${attempt}/${MAX_RETRIES} failed:`, fetchErr);
        if (attempt === MAX_RETRIES) throw fetchErr;
        // Exponential backoff: 2s, 4s
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }

    if (!analysisResponse) throw new Error("AI gateway fetch failed after retries");

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

    // ── H2 side-swap normalization ──
    // If this is the second-half analysis and teams swapped sides at halftime,
    // mirror x-coordinates so all positions stay consistent with H1's perspective.
    const isH2 = phase === "h2";
    const sidesSwapped = isH2 && match?.h2_sides_swapped === true;
    if (sidesSwapped && Array.isArray(analysis.frame_positions)) {
      console.log(`[H2-SWAP] Mirroring x-coordinates for ${analysis.frame_positions.length} frames`);
      for (const fr of analysis.frame_positions) {
        if (Array.isArray(fr.players)) {
          for (const p of fr.players) {
            if (typeof p.x === "number") p.x = 100 - p.x;
          }
        }
        if (fr.ball && typeof fr.ball.x === "number") fr.ball.x = 100 - fr.ball.x;
      }
      // Mirror danger_zones x if present
      if (Array.isArray(analysis.danger_zones)) {
        for (const z of analysis.danger_zones) {
          if (typeof z.x === "number") z.x = 100 - z.x;
        }
      }
    }

    // For live_partial: don't delete old results, just add new ones
    if (!isLivePartial) {
      await supabase.from("analysis_results").delete().eq("match_id", match_id);
    }

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
      ...(analysis.camera_perspective ? [{ type: "camera_perspective", data: analysis.camera_perspective }] : []),
      ...(analysis.team_size_detected ? [{ type: "team_size_detected", data: analysis.team_size_detected }] : []),
    ];

    // ── H2 SIMULATION (only for final jobs without H2 frames) ──
    // If the match recording has no H2 data (no h2_started_at OR no H2-tagged frames),
    // synthesize a plausible second half by dampening H1 metrics ~15-25% and
    // mirroring patterns. The result is clearly flagged so the UI can warn the trainer.
    const hasH2Recording = !!match?.h2_started_at && !!match?.h2_ended_at;
    const isFinalJob = !isLivePartial;
    const shouldSimulateH2 = isFinalJob && !hasH2Recording;

    if (shouldSimulateH2) {
      console.log("[H2-SIM] No H2 recording detected — synthesizing dampened second half");
      const simulated = synthesizeSecondHalf(analysis);
      resultTypes.push({ type: "h2_simulated", data: simulated });
    }

    for (const result of resultTypes) {
      await supabase.from("analysis_results").insert({
        job_id, match_id,
        result_type: result.type,
        data: result.data,
        confidence: analysis.confidence ?? 0.5,
      });
    }

    // For live_partial: mark complete without triggering insights
    if (isLivePartial) {
      await supabase.from("analysis_jobs").update({
        status: "complete",
        progress: 100,
        completed_at: new Date().toISOString(),
      }).eq("id", job_id);

      return new Response(JSON.stringify({
        success: true,
        frames_analyzed: selectedFrames.length,
        phase: "live_partial",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
