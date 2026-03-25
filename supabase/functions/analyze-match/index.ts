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
    const { match_id, job_id, frames, duration_sec } = await req.json();
    if (!match_id || !job_id) {
      return new Response(JSON.stringify({ error: "match_id and job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      await supabase.from("analysis_jobs").update({
        status: "failed",
        error_message: "Keine Frames empfangen",
      }).eq("id", job_id);
      return new Response(JSON.stringify({ error: "No frames provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update job status
    await supabase.from("analysis_jobs").update({
      status: "analyzing",
      started_at: new Date().toISOString(),
      progress: 10,
    }).eq("id", job_id);

    // Get match info for context
    const { data: match } = await supabase
      .from("matches")
      .select("*, fields(name, width_m, height_m)")
      .eq("id", match_id)
      .single();

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

    // Select subset of frames if too many (max ~20 for API limits)
    const maxFrames = 20;
    let selectedFrames = frames as string[];
    if (selectedFrames.length > maxFrames) {
      const step = selectedFrames.length / maxFrames;
      selectedFrames = Array.from({ length: maxFrames }, (_, i) =>
        frames[Math.min(Math.floor(i * step), frames.length - 1)]
      );
    }

    await supabase.from("analysis_jobs").update({ progress: 25 }).eq("id", job_id);

    // Build multi-image message content
    const userContent: any[] = [
      {
        type: "text",
        text: `Analysiere diese ${selectedFrames.length} Standbilder eines Fußballspiels (alle ${Math.round((duration_sec ?? 0) / selectedFrames.length)} Sekunden aufgenommen).

Kontext:
- ${match?.away_club_name ? `Heim vs ${match.away_club_name}` : "Spiel"}
- Datum: ${match?.date ?? "unbekannt"}
- Platzgröße: ${match?.fields?.width_m ?? 105}x${match?.fields?.height_m ?? 68}m
- Gesamtdauer: ca. ${duration_sec ? Math.round(duration_sec / 60) : "?"} Minuten

Analysiere was du auf den Bildern TATSÄCHLICH siehst:
- Spielerverteilung und Formationen
- Angriffsrichtungen und Raumbesetzung
- Erkennbare Muster und Spielphasen
- Ballpositionen und Druckzonen

WICHTIG: Beschreibe NUR was du siehst. Wenn ein Bild unklar ist, sage das ehrlich.`,
      },
    ];

    // Add frames as images
    for (const frame of selectedFrames) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${frame}`,
        },
      });
    }

    await supabase.from("analysis_jobs").update({ progress: 40 }).eq("id", job_id);

    const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Du bist ein erfahrener Fußball-Analyst. Du analysierst Standbilder eines Fußballspiels.
Fokussiere dich auf das, was du TATSÄCHLICH auf den Bildern erkennst:
- Spielerverteilung auf dem Feld
- Angriffsrichtungen und Raumbesetzung
- Ballposition (wenn sichtbar)
- Formationsstruktur
- Druckphasen und Momentum

Sei ehrlich über die Grenzen deiner Analyse. Markiere geschätzte Werte als solche.`,
          },
          {
            role: "user",
            content: userContent,
          },
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
                  visual_quality: {
                    type: "string",
                    description: "How well could you actually see the game in the frames? good/moderate/poor",
                    enum: ["good", "moderate", "poor"],
                  },
                  confidence: {
                    type: "number",
                    description: "Overall confidence 0-1 in the analysis based on what was visible",
                  },
                },
                required: ["match_structure", "danger_zones", "chances", "ball_loss_patterns", "visual_quality", "confidence"],
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

    // Store analysis results
    const resultTypes = [
      { type: "match_structure", data: analysis.match_structure },
      { type: "danger_zones", data: analysis.danger_zones },
      { type: "chances", data: analysis.chances },
      { type: "ball_loss_patterns", data: analysis.ball_loss_patterns },
    ];

    for (const result of resultTypes) {
      await supabase.from("analysis_results").insert({
        job_id,
        match_id,
        result_type: result.type,
        data: result.data,
        confidence: analysis.confidence ?? 0.5,
      });
    }

    await supabase.from("analysis_jobs").update({ progress: 85, status: "interpreting" }).eq("id", job_id);

    // Trigger insights generation
    const insightsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-insights`;
    await fetch(insightsUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ match_id, job_id }),
    });

    return new Response(JSON.stringify({ success: true, frames_analyzed: selectedFrames.length, visual_quality: analysis.visual_quality }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-match error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
