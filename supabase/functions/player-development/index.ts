import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { match_id } = await req.json();
    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [statsRes, eventsRes, lineupRes] = await Promise.all([
      supabase
        .from("player_match_stats")
        .select("*, players(name, position, number)")
        .eq("match_id", match_id)
        .eq("team", "home")
        .eq("period", "full"),
      supabase.from("match_events").select("*").eq("match_id", match_id).eq("team", "home"),
      supabase
        .from("match_lineups")
        .select("*, players(name, position, number)")
        .eq("match_id", match_id)
        .eq("team", "home"),
    ]);

    const stats = statsRes.data ?? [];
    const events = eventsRes.data ?? [];
    const lineup = lineupRes.data ?? [];

    if (!stats.length && !lineup.length) {
      return new Response(JSON.stringify({ players: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compact roster for AI
    const roster = stats.length
      ? stats.map((s: any) => ({
          name: s.players?.name ?? "Unbekannt",
          position: s.players?.position ?? "—",
          minutes: s.minutes_played ?? 0,
          distance_km: s.corrected_distance_km ?? s.distance_km ?? 0,
          top_speed: s.corrected_top_speed_kmh ?? s.top_speed_kmh ?? 0,
          passes: `${s.passes_completed ?? 0}/${s.passes_total ?? 0}`,
          duels_won: `${s.duels_won ?? 0}/${s.duels_total ?? 0}`,
          goals: s.goals ?? 0,
          assists: s.assists ?? 0,
          rating: s.rating,
          player_id: s.player_id,
        }))
      : lineup.map((l: any) => ({
          name: l.players?.name ?? l.player_name ?? "Unbekannt",
          position: l.players?.position ?? "—",
          player_id: l.player_id,
        }));

    const eventsByPlayer: Record<string, any[]> = {};
    events.forEach((e: any) => {
      if (e.player_name) {
        eventsByPlayer[e.player_name] = eventsByPlayer[e.player_name] || [];
        eventsByPlayer[e.player_name].push({ min: e.minute, type: e.event_type });
      }
    });

    const systemPrompt = `Du bist Trainer-Coach. Erstelle für jeden Spieler eine Entwicklungs-Karte: 2 Stärken (datenbasiert) + 2 Entwicklungsfelder + 1 konkrete Übungsempfehlung. Sei spezifisch, nutze Minuten-Belege.`;

    const userPrompt = `KADER (Heim):
${JSON.stringify(roster, null, 2)}

EVENTS PRO SPIELER:
${JSON.stringify(eventsByPlayer, null, 2)}

Liefere für die Top 5 Spieler (nach Spielzeit oder Rating) je eine Karte.`;

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
              name: "set_player_development",
              parameters: {
                type: "object",
                properties: {
                  players: {
                    type: "array",
                    minItems: 1,
                    maxItems: 8,
                    items: {
                      type: "object",
                      properties: {
                        player_name: { type: "string" },
                        position: { type: "string" },
                        rating: { type: "number" },
                        strengths: {
                          type: "array",
                          minItems: 2,
                          maxItems: 2,
                          items: {
                            type: "object",
                            properties: {
                              text: { type: "string" },
                              evidence_minute: { type: "integer" },
                            },
                            required: ["text"],
                          },
                        },
                        development_areas: {
                          type: "array",
                          minItems: 2,
                          maxItems: 2,
                          items: {
                            type: "object",
                            properties: {
                              text: { type: "string" },
                              situation: { type: "string" },
                            },
                            required: ["text"],
                          },
                        },
                        recommended_drill: { type: "string" },
                      },
                      required: ["player_name", "strengths", "development_areas", "recommended_drill"],
                    },
                  },
                },
                required: ["players"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "set_player_development" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit, bitte gleich nochmal." }), {
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
      throw new Error("AI gateway failed");
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Kein Tool-Call");
    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("player-development error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
