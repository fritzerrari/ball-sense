import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface Priority {
  rank: 1 | 2 | 3;
  impact_type: "kostet_tore" | "bringt_tore" | "risiko" | "staerke";
  title: string;
  evidence: string;
  linked_event_minutes: number[];
  linked_drill_key: string | null;
  recommendation: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { match_id, force_refresh = false } = await req.json();
    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cache
    const { data: matchRow } = await supabase
      .from("matches")
      .select("*, fields(name)")
      .eq("id", match_id)
      .single();

    if (!matchRow) {
      return new Response(JSON.stringify({ error: "match not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!force_refresh && matchRow.cockpit_cache?.priorities) {
      return new Response(JSON.stringify({ cockpit: matchRow.cockpit_cache, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather context: events, sections, videos
    const [eventsRes, sectionsRes, videosRes, statsRes] = await Promise.all([
      supabase.from("match_events").select("*").eq("match_id", match_id).order("minute"),
      supabase.from("report_sections").select("*").eq("match_id", match_id),
      supabase
        .from("match_videos")
        .select("id, event_type, event_minute, duration_sec")
        .eq("match_id", match_id)
        .eq("video_type", "highlight"),
      supabase.from("team_match_stats").select("*").eq("match_id", match_id),
    ]);

    const events = eventsRes.data ?? [];
    const sections = sectionsRes.data ?? [];
    const videos = videosRes.data ?? [];
    const stats = statsRes.data ?? [];

    const teamIdentity = matchRow.team_identity ?? "unbekannt";
    const homeScore = matchRow.home_score ?? 0;
    const awayScore = matchRow.away_score ?? 0;
    const opponent = matchRow.away_club_name ?? "Gegner";

    // Build compact context for AI
    const eventsSummary = events
      .map((e: any) => `Min ${e.minute} ${e.team}: ${e.event_type}${e.player_name ? ` (${e.player_name})` : ""}${e.event_zone ? ` [${e.event_zone}]` : ""}`)
      .join("\n");

    const sectionsCompact = sections
      .filter((s: any) => ["summary", "coaching", "tactical_blueprint", "risk_matrix", "next_match_actions"].includes(s.section_type))
      .map((s: any) => `## ${s.title}\n${s.content.slice(0, 800)}`)
      .join("\n\n");

    const videoMap = videos
      .map((v: any) => `Min ${v.event_minute} → ${v.event_type} (id:${v.id})`)
      .join("\n");

    const systemPrompt = `Du bist ein Profi-Trainer-Coach. Aufgabe: Aus den Spieldaten die EXAKT 3 wichtigsten Entscheidungs-Punkte für den Trainer extrahieren — keine schönen Texte, sondern harte Priorisierung nach Impact.

Regeln:
- Rank 1 = das, was Tore gekostet hat oder am meisten Verbesserung bringt
- Rank 2 = nächst-größtes Risiko oder Stärke zum Ausbauen
- Rank 3 = drittwichtigster Punkt
- Jede Aussage MUSS auf konkreten Spielminuten basieren (linked_event_minutes)
- Verknüpfe wo möglich mit Highlight-Videos (linked_video_id)
- Berücksichtige die Spielidentität: ${teamIdentity}
- Sei brutal ehrlich, kein Marketing-Sprech, kein "Champions-League-Niveau"`;

    const userPrompt = `SPIEL: ${homeScore}:${awayScore} gegen ${opponent}
SPIEL-IDENTITÄT (gewählt): ${teamIdentity}

EVENTS:
${eventsSummary || "(keine Events erfasst)"}

VERFÜGBARE HIGHLIGHT-VIDEOS:
${videoMap || "(keine)"}

ANALYSE-SEKTIONEN:
${sectionsCompact || "(noch keine)"}

TEAM-STATS: ${JSON.stringify(stats).slice(0, 500)}

Liefere Top 3 Entscheidungen + DNA-Match-Score (0-100, wie nah am gewählten Stil gespielt).`;

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
              name: "set_cockpit_decisions",
              description: "Liefert Top-3-Entscheidungen + DNA-Bewertung",
              parameters: {
                type: "object",
                properties: {
                  dna_match_score: {
                    type: "number",
                    description: "0-100: wie nah am gewählten Spielstil",
                  },
                  dna_comment: { type: "string" },
                  priorities: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        rank: { type: "integer", enum: [1, 2, 3] },
                        impact_type: {
                          type: "string",
                          enum: ["kostet_tore", "bringt_tore", "risiko", "staerke"],
                        },
                        title: { type: "string", description: "kurz, max 60 Zeichen" },
                        evidence: {
                          type: "string",
                          description: "Konkreter Beleg mit Minute(n), z.B. 'Min 23, 67: Gegentor nach Ballverlust im Zentrum'",
                        },
                        linked_event_minutes: {
                          type: "array",
                          items: { type: "integer" },
                        },
                        linked_video_id: {
                          type: "string",
                          description: "ID eines passenden Highlight-Videos oder leer",
                        },
                        linked_drill_key: {
                          type: "string",
                          description: "Slug der passenden Übung, z.B. '6v6_umschalt' oder leer",
                        },
                        recommendation: {
                          type: "string",
                          description: "Eine konkrete Handlung",
                        },
                      },
                      required: ["rank", "impact_type", "title", "evidence", "linked_event_minutes", "linked_video_id", "linked_drill_key", "recommendation"],
                    },
                  },
                },
                required: ["dna_match_score", "dna_comment", "priorities"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "set_cockpit_decisions" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht, bitte gleich nochmal versuchen." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI-Guthaben aufgebraucht. Bitte in Lovable Cloud aufladen." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway failed");
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Kein Tool-Call von der KI");

    const cockpit = JSON.parse(toolCall.function.arguments);

    // Sort priorities by rank
    if (cockpit.priorities) {
      cockpit.priorities.sort((a: Priority, b: Priority) => a.rank - b.rank);
    }

    cockpit.generated_at = new Date().toISOString();
    cockpit.team_identity = teamIdentity;

    // Cache
    await supabase
      .from("matches")
      .update({ cockpit_cache: cockpit })
      .eq("id", match_id);

    return new Response(JSON.stringify({ cockpit, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("decision-cockpit error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
