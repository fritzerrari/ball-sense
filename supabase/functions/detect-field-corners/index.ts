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
  isRealPitch: boolean;
  isPartialView: boolean;
  visiblePortion: string | null;
  inferredFullDimensions: SuggestedDimensions | null;
  pitchRejectionReason: string | null;
};

const FALLBACK_RESPONSE: LayoutResponse = {
  corners: null,
  suggestedDimensions: null,
  fieldType: null,
  confidence: null,
  detectedFeatures: [],
  isRealPitch: false,
  isPartialView: false,
  visiblePortion: null,
  inferredFullDimensions: null,
  pitchRejectionReason: null,
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
    isRealPitch: candidate.isRealPitch === true,
    isPartialView: candidate.isPartialView === true,
    visiblePortion: typeof candidate.visiblePortion === "string" ? candidate.visiblePortion : null,
    inferredFullDimensions: sanitizeDimensions(candidate.inferredFullDimensions),
    pitchRejectionReason: typeof candidate.pitchRejectionReason === "string" ? candidate.pitchRejectionReason : null,
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
                text: `Analyze this image. Your primary tasks:

Task 0 (CRITICAL): Determine if this is a REAL football/soccer pitch.
- A real pitch has: grass (natural or artificial), painted white lines, goals or goal posts, recognizable field markings (penalty area, center circle, touchlines).
- If this is NOT a real pitch (e.g. a living room, parking lot, random photo, indoor non-sport area, diagram, screenshot of a game), set isRealPitch=false and pitchRejectionReason to a short explanation (e.g. "No grass or field markings visible", "This appears to be a video game screenshot").
- If isRealPitch=false, set all other fields to null/empty and return immediately.

Task 1: Determine if the image shows the FULL pitch or only a PARTIAL view.
- Full view: all 4 corners (touchline × goal line intersections) are visible or clearly inferable.
- Partial view: only part of the pitch is visible (e.g. one half, one third, a zoomed section).
- Set isPartialView=true if partial. Set visiblePortion to describe what's visible (e.g. "left_half", "right_half", "left_third", "penalty_area_only", "center_section").

Task 2: Identify the 4 field corners (touchline × goal line intersections).
- Return as percentages 0-100 relative to image size, order: top-left, top-right, bottom-right, bottom-left.
- For PARTIAL views: return the 4 corners of the VISIBLE playing area (not the full pitch corners), so the user can calibrate the visible section.
- Only return corners when they are reasonably visible or inferable from line geometry.

Task 3: Estimate field dimensions.
- suggestedDimensions: dimensions of the VISIBLE area in meters.
- inferredFullDimensions: estimated FULL pitch dimensions based on visible markings.
  - Use reference measurements: penalty area = 16.5m deep × 40.3m wide, goal area = 5.5m × 18.3m, center circle radius = 9.15m, penalty spot = 11m from goal line.
  - Example: if only penalty area is visible → inferred full pitch ≈ 105×68m.
  - For youth/small pitches, scale proportionally.
- If only a partial view: suggestedDimensions = visible area size, inferredFullDimensions = estimated full pitch.
- If full view: both should be the same.

Task 4: List visible reference features.
- detectedFeatures: only these values: goal, penalty_area, goal_area, center_circle, halfway_line, corner_flag, touchline, goal_line.

Rules:
- Confidence must be one of: high, medium, low.
- fieldType examples: "Full pitch", "Half pitch", "Penalty area", "Small-sided pitch", "Futsal court".

Return ONLY a JSON object with this exact shape:
{
  "isRealPitch": true,
  "pitchRejectionReason": null,
  "isPartialView": false,
  "visiblePortion": null,
  "corners": [{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0}] | null,
  "suggestedDimensions": {"width":105,"height":68} | null,
  "inferredFullDimensions": {"width":105,"height":68} | null,
  "fieldType": "Full pitch" | null,
  "confidence": "high" | "medium" | "low" | null,
  "detectedFeatures": ["goal", "penalty_area"]
}

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
        max_tokens: 800,
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
