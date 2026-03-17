import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type DetectedCorner = { x: number; y: number };
type SuggestedDimensions = { width: number; height: number };

type LayoutResponse = {
  corners: DetectedCorner[] | null;
  suggestedDimensions: SuggestedDimensions | null;
  fieldType: string | null;
  confidence: "high" | "medium" | "low" | null;
  detectedFeatures: string[];
};

const FALLBACK_RESPONSE: LayoutResponse = {
  corners: null,
  suggestedDimensions: null,
  fieldType: null,
  confidence: null,
  detectedFeatures: [],
};

const sanitizeCorner = (corner: unknown): DetectedCorner | null => {
  if (!corner || typeof corner !== "object") return null;

  const candidate = corner as Record<string, unknown>;
  const x = Number(candidate.x);
  const y = Number(candidate.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  };
};

const sanitizeDimensions = (value: unknown): SuggestedDimensions | null => {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  const width = Number(candidate.width);
  const height = Number(candidate.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
};

const sanitizeConfidence = (value: unknown): LayoutResponse["confidence"] => {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return null;
};

const sanitizeFeatures = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
};

const normalizeResponse = (value: unknown): LayoutResponse => {
  if (!value || typeof value !== "object") return FALLBACK_RESPONSE;

  const candidate = value as Record<string, unknown>;
  const corners = Array.isArray(candidate.corners)
    ? candidate.corners.map(sanitizeCorner).filter((corner): corner is DetectedCorner => !!corner)
    : null;

  return {
    corners: corners && corners.length === 4 ? corners : null,
    suggestedDimensions: sanitizeDimensions(candidate.suggestedDimensions),
    fieldType: typeof candidate.fieldType === "string" ? candidate.fieldType : null,
    confidence: sanitizeConfidence(candidate.confidence),
    detectedFeatures: sanitizeFeatures(candidate.detectedFeatures),
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { image, mimeType } = await req.json();
    if (!image) throw new Error("No image provided");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this football / soccer field image taken from an elevated sideline position.

Task 1: identify the 4 field corners where touchline and goal line meet.
Task 2: estimate the most likely field type and standard dimensions based on visible markings.
Task 3: list which reference features are visible.

Use these rules:
- Corners must be returned as percentages from 0-100 relative to the image size.
- Corner order must be: top-left, top-right, bottom-right, bottom-left.
- Only return corners when all 4 are reasonably visible or inferable from line geometry.
- Suggested dimensions must reflect the most likely standard template only, not a made-up custom measurement.
- Confidence must be one of: high, medium, low.
- detectedFeatures should include only short strings such as: goal, penalty_area, goal_area, center_circle, halfway_line, corner_flag, touchline, goal_line.

Return ONLY a JSON object with this exact shape:
{
  "corners": [{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0}] | null,
  "suggestedDimensions": {"width":105,"height":68} | null,
  "fieldType": "Full pitch" | null,
  "confidence": "high" | "medium" | "low" | null,
  "detectedFeatures": ["goal", "penalty_area"]
}

If field dimensions cannot be estimated reliably, set suggestedDimensions, fieldType and confidence to null.
Do NOT include markdown or any text outside the JSON object.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/jpeg"};base64,${image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded", ...FALLBACK_RESPONSE }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required", ...FALLBACK_RESPONSE }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content?.trim() || "";

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    const normalized = normalizeResponse(parsed);

    return new Response(JSON.stringify(normalized), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-field-corners error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", ...FALLBACK_RESPONSE }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
