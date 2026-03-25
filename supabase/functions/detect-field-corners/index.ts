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
  fieldRect: { x: number; y: number; w: number; h: number } | null;
  coveragePercent: number | null;
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
  fieldRect: null,
  coveragePercent: null,
};

const sanitizeCorner = (corner: unknown): DetectedCorner | null => {
  if (!corner || typeof corner !== "object") return null;
  const candidate = corner as Record<string, unknown>;
  const x = Number(candidate.x);
  const y = Number(candidate.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
};

const sanitizeDimensions = (value: unknown): SuggestedDimensions | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const width = Number(candidate.width);
  const height = Number(candidate.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
};

const sanitizeConfidence = (value: unknown): LayoutResponse["confidence"] => {
  if (value === "high" || value === "medium" || value === "low") return value;
  return null;
};

const sanitizeFeatures = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
};

const sanitizeFieldRect = (value: unknown): { x: number; y: number; w: number; h: number } | null => {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  const x = Number(c.x), y = Number(c.y), w = Number(c.w), h = Number(c.h);
  if ([x, y, w, h].some(v => !Number.isFinite(v))) return null;
  if (w <= 0 || h <= 0) return null;
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), w: Math.max(0.05, Math.min(1, w)), h: Math.max(0.05, Math.min(1, h)) };
};

/**
 * Infer field_rect from detected features and visible portion.
 */
function inferFieldRect(
  features: string[],
  visiblePortion: string | null,
  corners: DetectedCorner[] | null,
): { x: number; y: number; w: number; h: number } {
  // Default: full field
  const full = { x: 0, y: 0, w: 1, h: 1 };

  const portion = (visiblePortion || "").toLowerCase();

  // Explicit halves
  if (portion.includes("left half") || portion.includes("linke h")) return { x: 0, y: 0, w: 0.5, h: 1 };
  if (portion.includes("right half") || portion.includes("rechte h")) return { x: 0.5, y: 0, w: 0.5, h: 1 };

  // Feature-based inference
  const hasGoal = features.includes("goal");
  const hasPenaltyArea = features.includes("penalty_area");
  const hasGoalArea = features.includes("goal_area");
  const hasCenterCircle = features.includes("center_circle");
  const hasHalfwayLine = features.includes("halfway_line");

  // If we see goal + penalty area but NO center circle → one half
  if ((hasGoal || hasGoalArea || hasPenaltyArea) && !hasCenterCircle && !hasHalfwayLine) {
    // Determine which half from corners (if goal is on left of image → left side of pitch)
    if (corners && corners.length >= 2) {
      const avgX = corners.reduce((s, c) => s + c.x, 0) / corners.length;
      // If corners cluster on left side of image → we see the goal end (one half)
      // We need to determine if this is the "left" or "right" half of the pitch
      // Use penalty area width as reference: ~16.5m out of 105m ≈ 0.157
      return avgX < 50
        ? { x: 0, y: 0, w: 0.5, h: 1 }   // Left half visible
        : { x: 0.5, y: 0, w: 0.5, h: 1 }; // Right half visible
    }
    return { x: 0, y: 0, w: 0.5, h: 1 }; // Default: assume left half
  }

  // Only penalty area visible (training field view)
  if (hasPenaltyArea && !hasHalfwayLine && !hasCenterCircle && !hasGoal) {
    // Penalty area = 16.5m/105m ≈ 15.7% of field length
    return { x: 0, y: 0.15, w: 0.4, h: 0.7 };
  }

  // Center section only (center circle visible, no goals)
  if (hasCenterCircle && !hasGoal && !hasGoalArea) {
    return { x: 0.25, y: 0, w: 0.5, h: 1 };
  }

  // If we have corners, compute actual coverage from corner positions
  if (corners && corners.length === 4) {
    const xs = corners.map(c => c.x / 100);
    const ys = corners.map(c => c.y / 100);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX, h = maxY - minY;
    // If the detected area covers most of the image → likely full field
    if (w > 0.7 && h > 0.5) return full;
  }

  return full;
}

/**
 * Compute coverage percentage from field_rect.
 */
function computeCoverage(rect: { x: number; y: number; w: number; h: number }): number {
  return Math.round(rect.w * rect.h * 100);
}

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

  if (corners && corners.length >= 2 && corners.length < 4) {
    corners = completeCorners(corners);
  }

  const features = sanitizeFeatures(candidate.detectedFeatures);
  const isPartialView = candidate.isPartialView === true;
  const visiblePortion = typeof candidate.visiblePortion === "string" ? candidate.visiblePortion : null;

  // Infer field_rect from AI response or compute from features
  let fieldRect = sanitizeFieldRect(candidate.fieldRect);
  if (!fieldRect && isPartialView) {
    fieldRect = inferFieldRect(features, visiblePortion, corners);
  }
  if (!fieldRect) {
    fieldRect = { x: 0, y: 0, w: 1, h: 1 };
  }

  const coveragePercent = computeCoverage(fieldRect);

  return {
    corners: corners && corners.length === 4 ? corners : null,
    suggestedDimensions: sanitizeDimensions(candidate.suggestedDimensions),
    fieldType: typeof candidate.fieldType === "string" ? candidate.fieldType : null,
    confidence: sanitizeConfidence(candidate.confidence),
    detectedFeatures: features,
    isRealPitch: candidate.isRealPitch === true,
    isPartialView,
    visiblePortion,
    inferredFullDimensions: sanitizeDimensions(candidate.inferredFullDimensions),
    pitchRejectionReason: typeof candidate.pitchRejectionReason === "string" ? candidate.pitchRejectionReason : null,
    fieldRect,
    coveragePercent,
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
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are an expert football pitch analyzer. Analyze this image carefully.

STEP 1 — IS THIS A FOOTBALL PITCH?
A football pitch can be:
- Full-size grass pitch (natural or artificial turf)
- Training field / small-sided pitch (Kleinfeld, Jugendplatz, Futsal)
- ANY outdoor area with visible field markings (white lines) and/or goals
- Even a partial view showing ONLY a goal, penalty area, or corner flag IS a valid pitch

Indicators of a real pitch: grass/turf surface, white line markings, goals (even small portable goals), corner flags, nets.
NOT a pitch: indoor rooms, parking lots, screenshots, diagrams, pure buildings.

Set isRealPitch=true even for small training fields with goals. Only set false if NO football elements are visible.

STEP 2 — WHAT PORTION OF THE PITCH IS VISIBLE?
This is CRITICAL for accurate tracking data. Analyze which part of the full pitch is shown:
- Check for: center circle, halfway line, penalty areas, goal areas, goals, corner flags
- If you see a goal + penalty area but NO center circle → this is approximately ONE HALF (50%)
- If you see only a penalty area → approximately 20-30% of the pitch
- If you see center circle + both penalty areas → full pitch (100%)
- Use visible markings as reference:
  - Penalty area: 16.5m deep × 40.3m wide
  - Goal area: 5.5m deep × 18.3m wide  
  - Center circle: 9.15m radius
  - Full pitch: typically 105×68m (varies 90-120 × 45-90m)

Estimate fieldRect as {x, y, w, h} where values are 0-1 representing which portion of the FULL pitch is visible:
  - Full field → {x:0, y:0, w:1, h:1}
  - Left half → {x:0, y:0, w:0.5, h:1}
  - Right half → {x:0.5, y:0, w:0.5, h:1}
  - Just penalty area → estimate based on position

STEP 3 — IDENTIFY CORNERS
Return the 4 corners of the VISIBLE playing area as percentages (0-100) of the image:
- Order: top-left, top-right, bottom-right, bottom-left
- These should be where touchlines meet goal lines, OR the edges of the visible marked area
- For partial views: return corners of what IS visible
- ALWAYS try to return at least 2 corners even if estimated
- Use line markings, goals, and field edges as guides

STEP 4 — ESTIMATE DIMENSIONS
- suggestedDimensions: dimensions of the VISIBLE area in meters
- inferredFullDimensions: estimated full pitch dimensions (standard: 105×68m for full-size)
- For training fields: use visible markings to estimate (e.g., if only penalty area visible: 16.5×40.3m visible, full field ~68×50m)

STEP 5 — LIST FEATURES
List ALL visible features from: goal, penalty_area, goal_area, center_circle, halfway_line, corner_flag, touchline, goal_line, net, portable_goal

Return ONLY a JSON object (no markdown, no text outside):
{
  "isRealPitch": true,
  "pitchRejectionReason": null,
  "isPartialView": false,
  "visiblePortion": "full field",
  "fieldRect": {"x": 0, "y": 0, "w": 1, "h": 1},
  "corners": [{"x":5,"y":10},{"x":95,"y":8},{"x":96,"y":85},{"x":4,"y":87}],
  "suggestedDimensions": {"width": 105, "height": 68},
  "inferredFullDimensions": {"width": 105, "height": 68},
  "fieldType": "Full pitch",
  "confidence": "high",
  "detectedFeatures": ["goal", "penalty_area", "touchline"]
}`,
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
        max_tokens: 1000,
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
