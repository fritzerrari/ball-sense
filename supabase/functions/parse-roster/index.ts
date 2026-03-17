import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { image_base64 } = await req.json();
    if (!image_base64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Du bist ein OCR-Spezialist für Fußball-Spielerbögen und Kaderlisten.
Extrahiere alle Spieler aus dem Bild. Für jeden Spieler ermittle:
- name: Vollständiger Name
- number: Trikotnummer (als Zahl oder null)
- position: Position in einem dieser Codes: TW (Torwart), IV (Innenverteidiger), LV (Linker Verteidiger), RV (Rechter Verteidiger), LIV (Linker IV), RIV (Rechter IV), ZDM (Zentrales def. Mittelfeld), ZM (Zentrales Mittelfeld), LM (Linkes Mittelfeld), RM (Rechtes Mittelfeld), ZOM (Zentrales off. Mittelfeld), LA (Linksaußen), RA (Rechtsaußen), ST (Stürmer), HS (Hängende Spitze). Wenn die Position nicht klar ist, setze null.

Antworte NUR mit dem JSON-Array, keine weiteren Erklärungen.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                image_url: { url: `data:image/jpeg;base64,${image_base64}` },
              },
              {
                type: "text",
                text: "Extrahiere alle Spieler aus diesem Spielerbogen/Kaderliste als JSON-Array mit den Feldern name, number, position.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_players",
              description: "Extract player roster from image",
              parameters: {
                type: "object",
                properties: {
                  players: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        number: { type: ["integer", "null"] },
                        position: {
                          type: ["string", "null"],
                          enum: [null, "TW", "IV", "LV", "RV", "LIV", "RIV", "ZDM", "ZM", "LM", "RM", "ZOM", "LA", "RA", "ST", "HS"],
                        },
                      },
                      required: ["name", "number", "position"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["players"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_players" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Zu viele Anfragen, bitte versuche es später erneut." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-Kontingent aufgebraucht." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    let players = [];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      players = parsed.players || [];
    }

    return new Response(JSON.stringify({ players }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-roster error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
