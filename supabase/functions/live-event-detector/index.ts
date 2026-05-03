// supabase/functions/live-event-detector/index.ts
// Lightweight 30s-trigger event detector that scans recent frames and writes
// auto-detected events into match_events with confidence scores.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Allowed event types must match the public.event_type enum used by match_events.
// Common types: goal, shot_on_target, shot_off_target, big_chance, corner, throw_in,
// free_kick, penalty, header_duel, tackle_won, tackle_lost, interception, foul,
// yellow_card, red_card, offside, save, missed_pass, pressing_action.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return j({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const matchId: string = body.match_id;
    const half: number = body.half ?? 1;
    const minute: number = body.minute ?? 0;
    const frames: Array<{ url?: string; base64?: string; ts?: number }> = body.frames ?? [];

    if (!matchId) return j({ error: "match_id required" }, 400);
    if (frames.length === 0) return j({ events: [], note: "no frames" });

    // Fetch jersey colors for context
    const { data: match } = await supabase
      .from("matches")
      .select("home_jersey_color, away_jersey_color, home_club_id, away_club_name")
      .eq("id", matchId)
      .single();

    if (!match) return j({ error: "Match not found" }, 404);

    const { data: club } = await supabase
      .from("clubs")
      .select("name")
      .eq("id", match.home_club_id)
      .single();

    // Build vision request with frames
    const imageContent = frames
      .filter((f) => f.url || f.base64)
      .map((f) => ({
        type: "image_url" as const,
        image_url: { url: f.base64 ? `data:image/jpeg;base64,${f.base64}` : f.url! },
      }));

    if (imageContent.length === 0) return j({ events: [] });

    const sysPrompt = `Du bist ein Fußball-Event-Detector. Analysiere die Frame-Sequenz (~30s Spielzeit) und identifiziere ALLE klar erkennbaren Spielereignisse.

Heimteam-Trikot: ${match.home_jersey_color ?? "unbekannt"} (${club?.name ?? "Heim"})
Auswärtsteam-Trikot: ${match.away_jersey_color ?? "unbekannt"} (${match.away_club_name ?? "Gegner"})

Erkenne nur Events mit hoher visueller Sicherheit. Lieber weniger und sicherer als viele unsichere.

Verfügbare event_types:
- goal: Ball klar im Tor + Jubel-Cluster
- shot_on_target / shot_off_target: Schussversuch Richtung Tor
- big_chance: Klare Torchance aus Strafraum mit freier Schussbahn
- corner: Ball verlässt Grundlinie + Eckfahnen-Cluster
- throw_in: Spieler an Seitenlinie mit Ball über Kopf
- free_kick / penalty: Ruhender Ball, Spieler-Aufstellung
- header_duel: Zwei Spieler springen, Ball auf Kopfhöhe
- tackle_won / tackle_lost: 1v1 Zweikampf mit Ballwechsel
- foul: Erkennbares Foul (Halten, Stoßen, Beinstellen)
- offside: Schiri-Geste oder klare Abseitsstellung
- save: Torwart hält Ball
- missed_pass: Pass landet bei Gegner ohne Druck
- pressing_action: ≥3 Heimspieler in 15m-Radius um ballführenden Gegner

Für jedes erkannte Event:
- minute: aktuelle Spielminute (Eingabe: ${minute})
- team: "home" oder "away"
- event_type: einer der obigen
- confidence: 0.0–1.0 (sei ehrlich – <0.7 wird vom Trainer geprüft)
- notes: kurze deutsche Beschreibung der visuellen Indizien (max 80 Zeichen)`;

    const aiResp = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: sysPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Spielzeit: Halbzeit ${half}, Minute ${minute}. Analysiere die Frame-Sequenz.` },
              ...imageContent,
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_events",
              description: "Liste der erkannten Events",
              parameters: {
                type: "object",
                properties: {
                  events: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        minute: { type: "integer" },
                        team: { type: "string", enum: ["home", "away"] },
                        event_type: { type: "string" },
                        confidence: { type: "number", minimum: 0, maximum: 1 },
                        notes: { type: "string" },
                      },
                      required: ["minute", "team", "event_type", "confidence"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["events"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_events" } },
      }),
    });

    if (aiResp.status === 429) return j({ error: "Rate limit", events: [] }, 429);
    if (aiResp.status === 402) return j({ error: "Credits exhausted", events: [] }, 402);
    if (!aiResp.ok) {
      console.error("AI error", aiResp.status, await aiResp.text());
      return j({ events: [] });
    }

    const ai = await aiResp.json();
    const tc = ai.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) return j({ events: [] });

    let parsed: any;
    try {
      parsed = JSON.parse(tc.function.arguments);
    } catch {
      return j({ events: [] });
    }

    const events = (parsed.events ?? []).filter((e: any) => e.event_type && e.confidence >= 0.5);

    if (events.length === 0) return j({ events: [] });

    // Insert with auto_detected flag
    const rows = events.map((e: any) => ({
      match_id: matchId,
      team: e.team,
      minute: e.minute,
      event_type: e.event_type,
      notes: e.notes ?? null,
      auto_detected: true,
      confidence: e.confidence,
      verified: false,
    }));

    const { data: inserted, error: insErr } = await supabase
      .from("match_events")
      .insert(rows)
      .select();

    if (insErr) {
      console.error("insert events error", insErr);
      return j({ events: [], error: insErr.message }, 500);
    }

    return j({ events: inserted ?? rows, count: rows.length });
  } catch (e) {
    console.error("live-event-detector error", e);
    return j({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function j(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
