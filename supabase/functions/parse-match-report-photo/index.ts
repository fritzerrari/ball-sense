import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { image_base64, match_id } = await req.json();
    if (!image_base64) throw new Error("image_base64 is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Du bist ein Fußball-Spielbericht-Scanner. Analysiere das Foto eines offiziellen Spielberichts und extrahiere alle erkennbaren Events.

Gib NUR ein JSON-Array zurück mit Objekten der Form:
{
  "event_type": "goal" | "yellow_card" | "red_card" | "yellow_red_card" | "substitution" | "penalty",
  "minute": <Zahl>,
  "team": "home" | "away",
  "player_name": "<Name wenn erkennbar>",
  "related_player_name": "<Bei Auswechslung: eingewechselter Spieler>",
  "notes": "<Zusatzinfo>"
}

Regeln:
- Nur Events extrahieren die klar erkennbar sind
- Bei Auswechslungen: player_name = raus, related_player_name = rein
- Wenn Team nicht klar: "home" als Default
- Minute muss eine Zahl sein
- Antworte NUR mit dem JSON-Array, kein anderer Text`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${image_base64}`,
                  },
                },
                {
                  type: "text",
                  text: "Analysiere diesen Spielbericht und extrahiere alle Events als JSON-Array.",
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Zu viele Anfragen. Bitte warte einen Moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "KI-Kontingent aufgebraucht." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "[]";

    // Parse JSON from response (may be wrapped in markdown code block)
    let events: any[] = [];
    try {
      const cleaned = content.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
      events = JSON.parse(cleaned);
      if (!Array.isArray(events)) events = [];
    } catch {
      console.error("Failed to parse AI response:", content);
      events = [];
    }

    // Validate and sanitize
    const validTypes = new Set([
      "goal", "yellow_card", "red_card", "yellow_red_card",
      "substitution", "penalty", "own_goal", "corner", "free_kick",
      "foul", "offside", "injury",
    ]);

    const sanitized = events
      .filter((e: any) => validTypes.has(e.event_type) && typeof e.minute === "number")
      .map((e: any) => ({
        event_type: e.event_type,
        minute: e.minute,
        team: e.team === "away" ? "away" : "home",
        player_name: e.player_name || null,
        related_player_name: e.related_player_name || null,
        notes: e.notes || null,
      }));

    return new Response(JSON.stringify({ events: sanitized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("parse-match-report-photo error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
