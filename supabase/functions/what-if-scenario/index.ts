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

    const systemPrompt = `Du bist ein erfahrener Fußballtrainer und Spielanalyst auf Profi-Niveau. Du erhältst Spieldaten und ein hypothetisches Szenario.

Aufgabe: Bewerte fundiert und differenziert, wie sich das Szenario tendenziell auf den Spielverlauf ausgewirkt hätte. Sei analytisch ehrlich — kein Wunschdenken, aber auch keine Scheingenauigkeit.

WICHTIGE ANALYSE-LEITPLANKEN (zwingend einhalten):
1. **KEINE deterministischen Endergebnisse**: Sage NIEMALS "2:0 statt 3:0" oder ähnlich konkrete Score-Prognosen. Stattdessen: Wahrscheinlichkeiten und Tendenzen ("geringere Wahrscheinlichkeit für frühes Gegentor", "stabilerer Spielverlauf wahrscheinlich", "Tendenz zu kontrollierterem Aufbau").
2. **Kausalitäten IMMER absichern**: Jede Folge mit einer Bedingung formulieren ("falls das Gegentor aus einer Standardsituation entstand", "abhängig von der eigenen Positionsstruktur", "sofern der Gegner nicht umstellt").
3. **Gegenrisiken zwingend benennen**: Jedes Szenario hat Nebenwirkungen. Beispiel: "weniger Fouls" → evtl. weniger taktische Aggressivität, Gegner bekommt mehr Raum im offenen Spiel.
4. **Vereinfachungen vermeiden**: Keine 1:1-Ableitungen wie "weniger Fouls = mehr Ballbesitz". Ballbesitz hängt von vielen Faktoren ab.
5. **Sprache präzise heben**: Statt "mehr Kontrolle" → "mehr kontinuierliche Spielphasen mit Potenzial zur Kontrolle, abhängig von der Positionsstruktur".
6. **Confidence-Disziplin**: Default ist "low" oder "medium". "high" NUR bei sehr klarer Datenlage (z. B. mehrere konkrete Events stützen die Hypothese eindeutig).

Gib zurück (über tool call):
- predicted_tendency: qualitative Tendenz, KEIN konkretes Ergebnis (z. B. "stabilerer Spielverlauf mit reduziertem Risiko für frühes Gegentor")
- confidence: low | medium | high — bevorzugt low/medium
- assumptions: 1–3 explizite Bedingungen, unter denen die Prognose gilt (z. B. "Annahme: frühes Gegentor entstand aus Standardsituation")
- key_changes: 2–4 Veränderungen, jede MUSS mit einem Wahrscheinlichkeits-Adverb beginnen ("Wahrscheinlich …", "Tendenziell …", "Potenziell …")
- risks: 2–3 Gegenrisiken, Nebeneffekte oder Abhängigkeiten
- training_focus: 1 konkrete Trainingsempfehlung, um das Szenario realistischer abrufen zu können`;

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
                  description: "Strukturiertes Was-wäre-wenn-Resultat mit qualitativen Tendenzen statt deterministischer Endergebnisse",
                  parameters: {
                    type: "object",
                    properties: {
                      predicted_tendency: {
                        type: "string",
                        description: "Qualitative Spielverlauf-Tendenz, KEIN konkretes Ergebnis. Schlecht: '2:0 statt 3:0'. Gut: 'stabilerer Spielverlauf mit reduziertem Risiko für frühes Gegentor'.",
                      },
                      confidence: {
                        type: "string",
                        enum: ["low", "medium", "high"],
                        description: "Bevorzugt low/medium. 'high' nur bei sehr klarer Datenlage.",
                      },
                      assumptions: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 1,
                        maxItems: 3,
                        description: "Explizite Bedingungen, unter denen die Prognose gilt.",
                      },
                      key_changes: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 2,
                        maxItems: 4,
                        description: "Jedes Item MUSS mit Wahrscheinlichkeits-Adverb beginnen ('Wahrscheinlich …', 'Tendenziell …', 'Potenziell …').",
                      },
                      risks: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 2,
                        maxItems: 3,
                        description: "Gegenrisiken, Nebeneffekte oder Abhängigkeiten des Szenarios.",
                      },
                      training_focus: { type: "string" },
                    },
                    required: ["predicted_tendency", "confidence", "assumptions", "key_changes", "risks", "training_focus"],
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
      // Fallback heuristic — bewusst vorsichtig formuliert
      result = {
        predicted_tendency: "Tendenz zu stabilerem Spielverlauf — konkrete Wirkung ohne KI-Auswertung nicht belastbar quantifizierbar",
        confidence: "low",
        assumptions: [
          "Annahme: Spielstruktur und Gegnerverhalten bleiben weitgehend vergleichbar",
        ],
        key_changes: [
          "Tendenziell weniger Druck-Situationen in der eigenen Hälfte, abhängig von der Pressing-Höhe des Gegners",
          "Potenziell kontinuierlichere Spielphasen im Mittelfeld, sofern die Positionsstruktur stabil bleibt",
        ],
        risks: [
          "Szenario-Annahme schwer messbar ohne vollständige KI-Auswertung",
          "Reduzierte Aggressivität könnte dem Gegner mehr Raum im offenen Spiel geben",
        ],
        training_focus: "Situationstraining zum Szenario im nächsten Microcycle einplanen",
      };
    }

    // Backwards-Compat: Legacy 'predicted_outcome' auf 'predicted_tendency' mappen
    if (result.predicted_outcome && !result.predicted_tendency) {
      result.predicted_tendency = result.predicted_outcome;
    }
    if (!result.assumptions || !Array.isArray(result.assumptions) || result.assumptions.length === 0) {
      result.assumptions = ["Annahme basiert auf vorhandenen Spieldaten, ohne weitere Kontextprüfung"];
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
