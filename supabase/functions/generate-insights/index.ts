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

    // Load match + analysis results
    const { data: match } = await supabase
      .from("matches")
      .select("*, fields(name)")
      .eq("id", match_id)
      .single();

    const { data: results } = await supabase
      .from("analysis_results")
      .select("*")
      .eq("job_id", job_id);

    if (!results?.length) {
      await supabase.from("analysis_jobs").update({
        status: "failed",
        error_message: "Keine Analyseergebnisse gefunden",
      }).eq("id", job_id);
      return new Response(JSON.stringify({ error: "No analysis results" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const analysisContext = results.map(r => `${r.result_type}: ${JSON.stringify(r.data)}`).join("\n\n");
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
                  executive_summary: {
                    type: "string",
                    description: "1-2 paragraph executive match summary for the coach",
                  },
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
                  coaching_conclusions: {
                    type: "string",
                    description: "2-3 paragraphs of coaching conclusions and tactical takeaways",
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
                        priority: { type: "integer", enum: [1, 2, 3] },
                        linked_pattern: { type: "string", description: "Which detected pattern this addresses" },
                      },
                      required: ["title", "description", "category", "priority", "linked_pattern"],
                    },
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

      if (insightsResponse.status === 429) {
        await supabase.from("analysis_jobs").update({ status: "failed", error_message: "Rate limit" }).eq("id", job_id);
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (insightsResponse.status === 402) {
        await supabase.from("analysis_jobs").update({ status: "failed", error_message: "Payment required" }).eq("id", job_id);
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`AI error: ${insightsResponse.status}`);
    }

    const aiResult = await insightsResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in insights response");

    const insights = JSON.parse(toolCall.function.arguments);

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

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-insights error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
