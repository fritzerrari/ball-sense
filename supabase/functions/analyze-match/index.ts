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
    const { match_id, job_id } = await req.json();
    if (!match_id || !job_id) {
      return new Response(JSON.stringify({ error: "match_id and job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update job status to analyzing
    await supabase.from("analysis_jobs").update({
      status: "analyzing",
      started_at: new Date().toISOString(),
      progress: 10,
    }).eq("id", job_id);

    // Get match info
    const { data: match } = await supabase
      .from("matches")
      .select("*, fields(name, width_m, height_m)")
      .eq("id", match_id)
      .single();

    // Get video
    const { data: video } = await supabase
      .from("match_videos")
      .select("*")
      .eq("match_id", match_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!video) {
      await supabase.from("analysis_jobs").update({
        status: "failed",
        error_message: "Kein Video gefunden",
      }).eq("id", job_id);
      return new Response(JSON.stringify({ error: "No video found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("analysis_jobs").update({ progress: 25, video_id: video.id }).eq("id", job_id);

    // Call Lovable AI Gateway for match analysis
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

    const matchContext = `
Match: ${match?.away_club_name ? `Heim vs ${match.away_club_name}` : "Spiel"}
Datum: ${match?.date ?? "unbekannt"}
Anstoß: ${match?.kickoff ?? "unbekannt"}
Platz: ${match?.fields?.name ?? "unbekannt"} (${match?.fields?.width_m ?? 105}x${match?.fields?.height_m ?? 68}m)
Video-Dauer: ca. ${video.duration_sec ? Math.round(video.duration_sec / 60) : "?"} Minuten
Video-Größe: ${video.file_size_bytes ? Math.round(video.file_size_bytes / 1048576) : "?"} MB
`;

    await supabase.from("analysis_jobs").update({ progress: 40 }).eq("id", job_id);

    // Use tool calling for structured output
    const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `Du bist ein erfahrener Fußball-Analyst. Analysiere das Spiel basierend auf den verfügbaren Informationen.
Erstelle eine realistische, nützliche Analyse für einen Trainer. Fokussiere dich auf:
- Spielstruktur und Momentum
- Angriffsrichtungen und Gefährdungszonen
- Taktische Muster
- Chancen und Abschlüsse

WICHTIG: Generiere KEINE fake-präzisen Metriken. Wenn du etwas nicht sicher weißt, markiere es als geschätzt.
Alle Bewertungen sollen plausibel und hilfreich für die Trainingsplanung sein.`,
          },
          {
            role: "user",
            content: `Analysiere folgendes Fußballspiel und erstelle strukturierte Ergebnisse:\n\n${matchContext}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_analysis",
              description: "Submit structured match analysis results",
              parameters: {
                type: "object",
                properties: {
                  match_structure: {
                    type: "object",
                    description: "Overall match structure analysis",
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
                    description: "Areas of danger and opportunity",
                    properties: {
                      home_attack_zones: {
                        type: "array",
                        items: { type: "string", enum: ["left", "center", "right"] },
                      },
                      away_attack_zones: {
                        type: "array",
                        items: { type: "string", enum: ["left", "center", "right"] },
                      },
                      home_vulnerable_zones: {
                        type: "array",
                        items: { type: "string" },
                      },
                      away_vulnerable_zones: {
                        type: "array",
                        items: { type: "string" },
                      },
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
                  confidence: {
                    type: "number",
                    description: "Overall confidence 0-1 in the analysis quality",
                  },
                },
                required: ["match_structure", "danger_zones", "chances", "ball_loss_patterns", "confidence"],
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

      if (analysisResponse.status === 429) {
        await supabase.from("analysis_jobs").update({
          status: "failed",
          error_message: "Rate limit erreicht. Bitte später erneut versuchen.",
        }).eq("id", job_id);
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (analysisResponse.status === 402) {
        await supabase.from("analysis_jobs").update({
          status: "failed",
          error_message: "AI-Kontingent aufgebraucht.",
        }).eq("id", job_id);
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI gateway error: ${analysisResponse.status}`);
    }

    const aiResult = await analysisResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("No tool call response from AI");
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    await supabase.from("analysis_jobs").update({ progress: 70 }).eq("id", job_id);

    // Store analysis results by type
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
        confidence: analysis.confidence ?? 0.6,
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

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-match error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
