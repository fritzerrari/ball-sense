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

    // Load match + analysis results
    const { data: match } = await supabase
      .from("matches")
      .select("*, fields(name)")
      .eq("id", match_id)
      .single();

    const { data: results } = await supabase
      .from("analysis_results")
      .select("*")
      .eq("match_id", match_id);

    // Filter results for this job or all match results
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

    const analysisContext = relevantResults.map(r => `${r.result_type}: ${JSON.stringify(r.data)}`).join("\n\n");
    const matchInfo = `${match?.away_club_name ? `Heim vs ${match.away_club_name}` : "Spiel"} am ${match?.date ?? "?"}`;

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
            content: `Du bist ein erfahrener Fußball-Trainer-Assistent. Erstelle aus der Spielanalyse verständliche, sofort nutzbare Coaching-Erkenntnisse und Trainingsempfehlungen.

Die Analyse enthält möglicherweise:
- pressing_data: Pressing-Linie und Kompaktheit pro Frame
- transitions: Umschaltmomente (Konter vs. Gegenpressing)
- pass_directions: Passrichtungs-Tendenzen
- formation_timeline: Formationswechsel im Spielverlauf

Nutze diese Daten, um KONKRETE taktische Empfehlungen zu geben.
Erstelle zusätzlich einen Gegner-Scouting-Report basierend auf den Away-Team-Daten.

REGELN:
- Schreibe für Trainer, nicht für Analysten
- Maximal 5 Key Insights, jeder in 2-3 Sätzen
- Trainingsempfehlungen MÜSSEN sich direkt auf erkannte Muster beziehen
- Keine fake-präzisen Zahlen
- Sprache: Deutsch
- Ton: professionell, direkt, hilfreich`,
          },
          {
            role: "user",
            content: `Erstelle Coaching-Insights und Trainingsempfehlungen für: ${matchInfo}\n\nAnalyse-Ergebnisse:\n${analysisContext}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_insights",
              description: "Submit coaching insights and training recommendations",
              parameters: {
                type: "object",
                properties: {
                  executive_summary: { type: "string", description: "1-2 paragraph executive match summary for the coach" },
                  key_insights: {
                    type: "array",
                    description: "3-5 key coaching insights",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        category: { type: "string", enum: ["offense", "defense", "transition", "set_piece", "general"] },
                        confidence: { type: "string", enum: ["high", "medium", "estimated"] },
                      },
                      required: ["title", "description", "category", "confidence"],
                    },
                  },
                  coaching_conclusions: { type: "string", description: "2-3 paragraphs of coaching conclusions and tactical takeaways" },
                  training_recommendations: {
                    type: "array",
                    description: "3-5 specific training recommendations",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Short title for the recommendation" },
                        description: { type: "string", description: "Detailed description of the training exercise" },
                        category: { type: "string", enum: ["offense", "defense", "transition", "set_piece"], description: "Category of the recommendation" },
                        priority: { type: "integer", description: "Priority level 1-3" },
                        linked_pattern: { type: "string", description: "Which detected pattern this addresses" },
                      },
                      required: ["title", "description", "category", "priority", "linked_pattern"],
                    },
                  },
                  opponent_scouting: {
                    type: "object",
                    description: "Structured opponent scouting report based on observed away team data",
                    properties: {
                      preferred_attack_side: { type: "string", description: "left, center, right, or mixed" },
                      formation_weaknesses: { type: "string", description: "Key weaknesses in opponent formation" },
                      recommended_counter_strategy: { type: "string", description: "Tactical recommendation for next encounter" },
                      pressing_behavior: { type: "string", description: "How the opponent presses: high, medium, low, situational" },
                      transition_speed: { type: "string", description: "How quickly the opponent transitions" },
                    },
                    required: ["preferred_attack_side", "formation_weaknesses", "recommended_counter_strategy"],
                  },
                },
                required: ["executive_summary", "key_insights", "coaching_conclusions", "training_recommendations"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_insights" } },
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

    // Store report sections
    const sections = [
      { section_type: "summary", title: "Zusammenfassung", content: insights.executive_summary, confidence: "high", sort_order: 0 },
      ...insights.key_insights.map((ins: any, i: number) => ({
        section_type: "insight",
        title: ins.title,
        content: ins.description,
        confidence: ins.confidence,
        sort_order: 10 + i,
      })),
      { section_type: "coaching", title: "Coaching-Schlussfolgerungen", content: insights.coaching_conclusions, confidence: "high", sort_order: 50 },
      ...(insights.opponent_scouting ? [{
        section_type: "opponent_scouting",
        title: "Gegner-Scouting",
        content: JSON.stringify(insights.opponent_scouting),
        confidence: "medium",
        sort_order: 60,
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

    // Update match status
    await supabase.from("matches").update({ status: "done" }).eq("id", match_id);

    // Notify all club members that the report is ready
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

    // Cleanup: delete frames from storage after successful analysis
    // Try to clean up all possible frame files
    const cleanupPaths = [`${match_id}.json`];
    for (let i = 0; i < 50; i++) {
      cleanupPaths.push(`${match_id}_chunk_${i}.json`);
    }
    cleanupPaths.push(`${match_id}_h1.json`, `${match_id}_h2.json`);
    await supabase.storage.from("match-frames").remove(cleanupPaths);
    console.log(`Cleaned up frames for match ${match_id}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-insights error:", error);

    // Always mark job as failed so UI shows retry
    if (job_id) {
      await supabase.from("analysis_jobs").update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unbekannter Fehler bei der Insight-Generierung",
      }).eq("id", job_id);
    }

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
