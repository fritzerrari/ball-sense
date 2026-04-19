// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { matchId, tone = "analytical" } = await req.json();
    if (!matchId) {
      return new Response(JSON.stringify({ error: "matchId erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY fehlt");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [matchRes, eventsRes] = await Promise.all([
      supabase.from("matches").select("home_score,away_score,date,away_club_name,home_formation,away_formation").eq("id", matchId).maybeSingle(),
      supabase.from("match_events").select("minute,team,event_type,player_name,event_cause,event_zone,notes,severity").eq("match_id", matchId).order("minute"),
    ]);

    const match = matchRes.data;
    const events = (eventsRes.data ?? []).slice(0, 30);

    const systemPrompt = `Du bist ein Sportkommentator und Storyteller. Erstelle ein Voice-Over-Skript für ein 90-Sekunden-Highlight-Reel in deutscher Sprache.
TONALITÄT: ${tone === "motivational" ? "Mitreißend, emotional, packend" : tone === "calm" ? "Ruhig, sachlich, würdigend" : "Analytisch, präzise, taktisch"}.

REGELN:
- Genau 6 Szenen, jede mit timestamp_sec (Position im Reel 0-90s), title (max 4 Wörter), narration (1-2 Sätze, gesprochen) und tag (z.B. "Tor", "Wende", "Schlüsselszene").
- Erste Szene = Intro (Setup, Score-Erwartung), letzte Szene = Outro (Fazit/Take-away).
- Beziehe dich auf konkrete Minuten und Spieler aus dem Kontext.
- Keine Disclaimer, keine Erklärung, nur das Skript-Objekt.`;

    const userPrompt = `SPIEL: ${match?.home_score ?? 0}:${match?.away_score ?? 0} vs. ${match?.away_club_name ?? "Gegner"}
FORMATIONEN: ${match?.home_formation ?? "?"} vs. ${match?.away_formation ?? "?"}
EVENTS:
${events.map((e) => `${e.minute}' [${e.team}] ${e.event_type} ${e.player_name ?? ""} ${e.event_cause ?? ""} ${e.event_zone ?? ""}`).join("\n")}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
              name: "build_story",
              description: "Erstellt ein 6-Szenen-Highlight-Storyboard.",
              parameters: {
                type: "object",
                properties: {
                  headline: { type: "string", description: "Titel des Reels (max 8 Wörter)" },
                  duration_sec: { type: "number" },
                  scenes: {
                    type: "array",
                    minItems: 6,
                    maxItems: 6,
                    items: {
                      type: "object",
                      properties: {
                        timestamp_sec: { type: "number" },
                        title: { type: "string" },
                        narration: { type: "string" },
                        tag: { type: "string" },
                        minute: { type: "number" },
                      },
                      required: ["timestamp_sec", "title", "narration", "tag"],
                    },
                  },
                  cta: { type: "string", description: "Abschluss-Aufruf an Trainer/Spieler" },
                },
                required: ["headline", "duration_sec", "scenes", "cta"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "build_story" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate-Limit erreicht." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI-Guthaben aufgebraucht." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI-Gateway Fehler" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Keine Story generiert" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const story = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ story }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("highlight-story error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
