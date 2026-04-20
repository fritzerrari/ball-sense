import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCENARIO_PRESETS: Record<string, string> = {
  no_early_fouls: "Was wäre, wenn die frühen Fouls (Min 1–20) vermieden worden wären?",
  switch_formation: "Was wäre, wenn die Mannschaft mit einer anderen Formation gespielt hätte?",
  high_press: "Was wäre, wenn die Mannschaft konsequent hoch gepresst hätte?",
  deep_block: "Was wäre, wenn die Mannschaft tiefer gestanden und auf Konter gespielt hätte?",
  no_concession: "Was wäre, wenn das frühe Gegentor vermieden worden wäre?",
  more_possession: "Was wäre, wenn die Mannschaft mehr Ballbesitz gehabt hätte?",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const auth = req.headers.get("Authorization") ?? "";

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await authClient.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const matchId: string | undefined = body.match_id;
    const scenarioKey: string | undefined = body.scenario_key;
    const customPrompt: string | undefined = body.custom_prompt;
    if (!matchId || (!scenarioKey && !customPrompt)) {
      return new Response(JSON.stringify({ error: "match_id and scenario required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Load match summary
    const { data: match } = await admin
      .from("matches")
      .select("id, home_score, away_score, home_formation, away_formation, away_club_name, team_identity, context_cache")
      .eq("id", matchId)
      .single();
    if (!match) {
      return new Response(JSON.stringify({ error: "match not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: events } = await admin
      .from("match_events")
      .select("minute, event_type, team, event_zone, event_cause, severity")
      .eq("match_id", matchId)
      .order("minute", { ascending: true })
      .limit(100);

    const { data: stats } = await admin
      .from("team_match_stats")
      .select("team, possession_pct, total_distance_km, top_speed_kmh")
      .eq("match_id", matchId);

    const scenarioText = customPrompt || SCENARIO_PRESETS[scenarioKey!] || scenarioKey!;

    const systemPrompt = `Du bist ein erfahrener Fußballtrainer und Spielanalyst. Du erhältst Spieldaten und ein hypothetisches Szenario.

Aufgabe: Bewerte realistisch, wie sich das Szenario auf den Spielausgang ausgewirkt hätte. Sei konkret und ehrlich — kein Wunschdenken.

Gib zurück:
- predicted_outcome: kurze Spielergebnis-Prognose (z. B. "1:1 statt 0:2")
- confidence: low | medium | high
- key_changes: 2–4 konkrete Veränderungen im Spielverlauf
- risks: 1–2 Risiken oder Nebenwirkungen des Szenarios
- training_focus: 1 Trainingsempfehlung, um das Szenario realistischer umzusetzen`;

    const userPrompt = `Spiel: ${match.away_club_name ?? "Gegner"}
Ergebnis: ${match.home_score ?? "?"}:${match.away_score ?? "?"}
Formation eigene: ${match.home_formation ?? "?"} | gegnerisch: ${match.away_formation ?? "?"}
Team-Identität: ${match.team_identity ?? "nicht gesetzt"}
Team-Stats: ${JSON.stringify(stats ?? [])}
Wichtige Events: ${JSON.stringify((events ?? []).slice(0, 30))}

Szenario: ${scenarioText}`;

    let result: any;

    if (lovableKey) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "what_if_result",
                  description: "Strukturiertes Was-wäre-wenn-Resultat",
                  parameters: {
                    type: "object",
                    properties: {
                      predicted_outcome: { type: "string" },
                      confidence: { type: "string", enum: ["low", "medium", "high"] },
                      key_changes: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                      risks: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
                      training_focus: { type: "string" },
                    },
                    required: ["predicted_outcome", "confidence", "key_changes", "risks", "training_focus"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "what_if_result" } },
          }),
        });

        if (aiRes.status === 429 || aiRes.status === 402) {
          return new Response(
            JSON.stringify({ error: aiRes.status === 429 ? "rate_limited" : "credits_required" }),
            { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (aiRes.ok) {
          const data = await aiRes.json();
          const tc = data.choices?.[0]?.message?.tool_calls?.[0];
          if (tc?.function?.arguments) {
            result = JSON.parse(tc.function.arguments);
          }
        } else {
          console.error("AI gateway non-ok", aiRes.status, await aiRes.text());
        }
      } catch (aiErr) {
        console.error("what-if AI error", aiErr);
      }
    }

    if (!result) {
      // Fallback heuristic
      result = {
        predicted_outcome: "Leicht verbessertes Ergebnis möglich",
        confidence: "low",
        key_changes: [
          "Weniger Druck-Situationen in der eigenen Hälfte",
          "Kontrolliertere Spielphasen im Mittelfeld",
        ],
        risks: ["Szenario-Annahme schwer messbar ohne KI-Auswertung"],
        training_focus: "Situationstraining zum Szenario im nächsten Microcycle einplanen",
      };
    }

    return new Response(
      JSON.stringify({
        scenario: scenarioText,
        scenario_key: scenarioKey ?? "custom",
        result,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("what-if-scenario error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
