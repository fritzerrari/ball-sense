import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-camera-session-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Tool definition for structured output — forces the model to return
 * valid JSON matching our detection schema. No more parse errors.
 */
const DETECTION_TOOL = {
  type: "function" as const,
  function: {
    name: "report_detections",
    description: "Report all detected players and ball positions in the football match frame.",
    parameters: {
      type: "object",
      properties: {
        detections: {
          type: "array",
          description: "Array of detected objects (players and ball)",
          items: {
            type: "object",
            properties: {
              x: { type: "number", description: "Normalized x coordinate 0-1 (left=0, right=1)" },
              y: { type: "number", description: "Normalized y coordinate 0-1 (top=0, bottom=1)" },
              team: { type: "string", enum: ["home", "away", "referee"], description: "Team assignment based on jersey color" },
              label: { type: "string", enum: ["person", "ball"], description: "Object type" },
              confidence: { type: "number", description: "Detection confidence 0-1" },
            },
            required: ["x", "y", "label", "confidence"],
          },
        },
        field_coverage: {
          type: "number",
          description: "Estimated fraction of the full pitch visible (0.0-1.0)",
        },
        player_count: {
          type: "integer",
          description: "Total number of persons detected",
        },
      },
      required: ["detections", "field_coverage", "player_count"],
    },
  },
};

function cleanBase64(raw: string): string {
  let b64 = raw;
  if (b64.startsWith("data:")) {
    b64 = b64.split(",")[1] ?? "";
  }
  return b64;
}

function validateBase64(b64: string): string | null {
  if (b64.length > 700_000) return "image_too_large";
  if (!/^[A-Za-z0-9+/=]+$/.test(b64.slice(0, 100))) return "invalid_base64";
  return null;
}

function emptyResult(error?: string) {
  return {
    detections: [],
    field_coverage: 0.5,
    player_count: 0,
    timestamp: Date.now(),
    ...(error ? { error } : {}),
  };
}

function sanitizeDetections(raw: any[]): any[] {
  return raw
    .filter((d: any) =>
      typeof d.x === "number" && typeof d.y === "number" &&
      d.x >= 0 && d.x <= 1 && d.y >= 0 && d.y <= 1
    )
    .map((d: any, i: number) => ({
      id: i,
      x: d.x,
      y: d.y,
      w: 0.03,
      h: 0.06,
      confidence: Math.min(1, Math.max(0, d.confidence ?? 0.5)),
      label: d.label === "ball" ? "ball" : "person",
      team: d.team === "home" ? "home" : d.team === "away" ? "away" : d.team === "referee" ? undefined : undefined,
    }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, matchId, cameraIndex } = await req.json();

    if (!imageBase64 || !matchId) {
      return new Response(JSON.stringify({ error: "imageBase64 and matchId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const b64 = cleanBase64(imageBase64);
    const validationError = validateBase64(b64);
    if (validationError) {
      return new Response(JSON.stringify(emptyResult(validationError)), {
        status: validationError === "invalid_base64" ? 400 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Analyze this football/soccer match video frame. Detect all visible players and the ball.

Rules:
- x, y are normalized 0-1 coordinates (left=0, right=1, top=0, bottom=1)
- "team": "home" for darker/colored jerseys, "away" for lighter jerseys, "referee" for officials
- "label": "person" for players/referees, "ball" for the ball
- "confidence": 0.0-1.0 how certain you are
- "field_coverage": estimated fraction of the full pitch visible
- Only return ACTUALLY VISIBLE players. Do NOT fabricate hidden players.
- If no players visible, return empty detections array.`;

    // Use tool calling for guaranteed structured output
    const model = "google/gemini-2.5-flash";

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
              ],
            },
          ],
          tools: [DETECTION_TOOL],
          tool_choice: { type: "function", function: { name: "report_detections" } },
          max_tokens: 2000,
        }),
      });

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded", retryAfter: 5 }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[analyze-frame] ${model} failed (${response.status}):`, errText.slice(0, 200));
        return new Response(JSON.stringify(emptyResult("model_error")), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiResult = await response.json();

      // Extract structured data from tool call response
      let parsed: any = null;

      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          parsed = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          console.warn("[analyze-frame] Tool call JSON parse failed:", (e as Error).message);
        }
      }

      // Fallback: try content field (some models return content instead of tool_calls)
      if (!parsed) {
        const content = aiResult.choices?.[0]?.message?.content ?? "";
        if (content) {
          try {
            parsed = JSON.parse(content);
          } catch {
            const braceMatch = content.match(/\{[\s\S]*\}/);
            if (braceMatch) {
              try { parsed = JSON.parse(braceMatch[0]); } catch { /* ignore */ }
            }
          }
        }
      }

      if (!parsed) {
        console.error("[analyze-frame] Could not extract structured data from response");
        return new Response(JSON.stringify(emptyResult("parse_failed")), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const detections = sanitizeDetections(parsed.detections ?? []);

      const result = {
        detections,
        field_coverage: Math.min(1, Math.max(0, parsed.field_coverage ?? 0.5)),
        player_count: parsed.player_count ?? detections.filter((d: any) => d.label === "person").length,
        timestamp: Date.now(),
        model,
      };

      console.log(`[analyze-frame] Match ${matchId} cam ${cameraIndex ?? 0}: ${result.detections.length} detections, ${Math.round(result.field_coverage * 100)}% coverage (${model})`);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (modelErr) {
      console.error(`[analyze-frame] ${model} error:`, modelErr instanceof Error ? modelErr.message : String(modelErr));
      return new Response(JSON.stringify(emptyResult("model_exception")), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("[analyze-frame] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
