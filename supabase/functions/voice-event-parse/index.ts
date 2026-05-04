// Voice-Event Parser — transkribiert Audio (Gemini multimodal) und extrahiert Event-Vorschlag.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EVENT_TYPES = [
  "goal", "own_goal", "shot_on_target", "shot_off_target", "corner",
  "foul", "yellow_card", "red_card", "substitution", "offside", "save", "free_kick", "penalty",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { audio_base64, mime_type, match_id, current_minute, home_team, away_team, roster } = await req.json();
    if (!audio_base64 || !match_id) {
      return new Response(JSON.stringify({ error: "audio_base64 und match_id erforderlich" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY fehlt");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Falls roster nicht mitgegeben: lade aus DB
    let rosterText = "";
    if (Array.isArray(roster) && roster.length) {
      rosterText = roster.map((r: { number?: number; name?: string; team?: string }) =>
        `${r.team ?? "?"} #${r.number ?? "-"} ${r.name ?? ""}`).join("\n");
    } else {
      const { data: lineups } = await supabase
        .from("match_lineups")
        .select("team, shirt_number, player_name, players(name, number)")
        .eq("match_id", match_id);
      rosterText = (lineups ?? []).map((l: { team?: string; shirt_number?: number | null; player_name?: string | null; players?: { name?: string; number?: number } }) =>
        `${l.team} #${l.shirt_number ?? l.players?.number ?? "-"} ${l.player_name ?? l.players?.name ?? ""}`).join("\n");
    }

    const systemPrompt = `Du bist ein Fußball-Assistent. Höre die Audio-Notiz eines Trainers/Helpers an und extrahiere genau EIN Spiel-Event.
Verfügbare Event-Typen: ${EVENT_TYPES.join(", ")}.
Teams: home="${home_team ?? "Heim"}", away="${away_team ?? "Gast"}".
Aktuelle Spielminute (falls Sprecher nichts sagt): ${current_minute ?? "?"}.
Roster:
${rosterText || "(unbekannt)"}

Antworte NUR über das Tool extract_event. Wenn kein Event erkennbar ist, setze confidence < 0.3.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Transkribiere und extrahiere das Event aus dieser Sprachnotiz." },
              { type: "input_audio", input_audio: { data: audio_base64, format: (mime_type ?? "audio/webm").includes("mp4") ? "mp4" : "webm" } },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_event",
            description: "Extrahiert ein einzelnes Fußball-Event aus der Sprachnotiz.",
            parameters: {
              type: "object",
              properties: {
                transcript: { type: "string", description: "Wörtliches Transkript der Sprachnotiz." },
                event_type: { type: "string", enum: EVENT_TYPES },
                team: { type: "string", enum: ["home", "away"] },
                minute: { type: "number", description: "Spielminute (1-120)" },
                player_name: { type: "string", description: "Spielername falls erwähnt, sonst leer." },
                shirt_number: { type: "number", description: "Trikotnummer falls erwähnt." },
                confidence: { type: "number", description: "0-1 Sicherheit der Erkennung." },
                notes: { type: "string", description: "Zusatzkontext (z.B. 'Kopfball nach Ecke')." },
              },
              required: ["transcript", "event_type", "team", "minute", "confidence"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_event" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate-Limit erreicht." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI-Guthaben aufgebraucht." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      console.error("voice-event AI error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI-Gateway Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Keine Erkennung" }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ event: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-event-parse error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
