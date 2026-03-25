import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-camera-session-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const prompt = `Analyze this football/soccer match video frame. Detect all visible players and the ball.

Return ONLY valid JSON (no markdown, no backticks) with this structure:
{
  "detections": [
    {"x": 0.5, "y": 0.3, "team": "home", "label": "person", "confidence": 0.9},
    {"x": 0.7, "y": 0.6, "team": "away", "label": "person", "confidence": 0.85},
    {"x": 0.45, "y": 0.5, "label": "ball", "confidence": 0.7}
  ],
  "field_coverage": 0.6,
  "player_count": 12
}

Rules:
- x, y are normalized 0-1 coordinates in the image (left=0, right=1, top=0, bottom=1)
- "team": "home" for darker/colored jerseys, "away" for lighter jerseys, "referee" for officials
- "label": "person" for players/referees, "ball" for the ball
- "confidence": 0.0-1.0 how certain you are
- "field_coverage": estimated fraction of the full pitch visible (0.0-1.0)
- "player_count": total persons detected
- Only return ACTUALLY VISIBLE players. Do NOT fabricate or estimate hidden players.
- If no players visible, return empty detections array.
- Referees should have label "person" and team "referee"`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[analyze-frame] AI error ${response.status}:`, errText);
      
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
      
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "";
    
    // Parse JSON from response (handle possible markdown wrapping)
    let parsed: any;
    try {
      // Try direct parse
      parsed = JSON.parse(content);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try finding JSON object in text
        const braceMatch = content.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          parsed = JSON.parse(braceMatch[0]);
        } else {
          console.error("[analyze-frame] Could not parse AI response:", content);
          parsed = { detections: [], field_coverage: 0.5, player_count: 0 };
        }
      }
    }

    // Validate and sanitize detections
    const detections = (parsed.detections ?? [])
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

    const result = {
      detections,
      field_coverage: Math.min(1, Math.max(0, parsed.field_coverage ?? 0.5)),
      player_count: parsed.player_count ?? detections.filter((d: any) => d.label === "person").length,
      timestamp: Date.now(),
    };

    console.log(`[analyze-frame] Match ${matchId} cam ${cameraIndex ?? 0}: ${result.detections.length} detections, ${Math.round(result.field_coverage * 100)}% coverage`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[analyze-frame] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
