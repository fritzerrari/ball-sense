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

/**
 * Complete missing corners using standard pitch aspect ratio (105:68).
 */
const completeCorners = (corners: DetectedCorner[]): DetectedCorner[] | null => {
  if (corners.length === 4) return corners;
  if (corners.length < 2) return null;

  if (corners.length === 2) {
    const dx = corners[1].x - corners[0].x;
    const dy = corners[1].y - corners[0].y;
    const ratio = 68 / 105;
    const perpX = -dy * ratio;
    const perpY = dx * ratio;
    return [
      corners[0],
      corners[1],
      { x: Math.max(0, Math.min(100, corners[1].x + perpX)), y: Math.max(0, Math.min(100, corners[1].y + perpY)) },
      { x: Math.max(0, Math.min(100, corners[0].x + perpX)), y: Math.max(0, Math.min(100, corners[0].y + perpY)) },
    ];
  }

  if (corners.length === 3) {
    // Infer 4th corner: p4 = p1 + (p3 - p2)
    const p4x = corners[0].x + (corners[2].x - corners[1].x);
    const p4y = corners[0].y + (corners[2].y - corners[1].y);
    return [
      ...corners,
      { x: Math.max(0, Math.min(100, p4x)), y: Math.max(0, Math.min(100, p4y)) },
    ];
  }

  return null;
};

const normalizeResponse = (value: unknown): LayoutResponse => {
  if (!value || typeof value !== "object") return FALLBACK_RESPONSE;

  const candidate = value as Record<string, unknown>;
  let corners = Array.isArray(candidate.corners)
    ? candidate.corners.map(sanitizeCorner).filter((corner): corner is DetectedCorner => !!corner)
    : null;

  // Try to complete partial corners
  if (corners && corners.length >= 2 && corners.length < 4) {
    corners = completeCorners(corners);
  }

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
                text: `Analyze this image of a potential football/soccer pitch. Your tasks:

Task 0 (CRITICAL): Is this a REAL football/soccer pitch?
- Real pitch: grass (natural/artificial), white lines, goals, field markings.
- NOT a real pitch: living room, parking lot, screenshot, diagram → set isRealPitch=false with pitchRejectionReason.

Task 1: Full or partial view?
- Full: all 4 corners visible/inferable. Partial: only part visible.

Task 2: Identify field corners (touchline × goal line intersections).
- Return as percentages 0-100 relative to image dimensions.
- Order: top-left, top-right, bottom-right, bottom-left.
- IMPORTANT: Always try to return at least 2-3 corners even if some are estimated/inferred.
- For partial views: return corners of the VISIBLE playing area.

Task 3: Estimate dimensions.
- suggestedDimensions: visible area in meters.
- inferredFullDimensions: full pitch estimate (standard: 105×68m).
- Reference: penalty area=16.5m×40.3m, center circle radius=9.15m, penalty spot=11m.

Task 4: List visible features from: goal, penalty_area, goal_area, center_circle, halfway_line, corner_flag, touchline, goal_line.

Return ONLY a JSON object:
{
  "isRealPitch": true,
  "pitchRejectionReason": null,
  "isPartialView": false,
  "visiblePortion": null,
  "corners": [{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0},{"x":0,"y":0}],
  "suggestedDimensions": {"width":105,"height":68},
  "inferredFullDimensions": {"width":105,"height":68},
  "fieldType": "Full pitch",
  "confidence": "high",
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
