// Schiri-Assist: estimates foul probability for a recent contact scene using Gemini Vision.
// Input: match_id + frame URLs (signed) OR base64 image array (max 4 frames)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReqBody {
  match_id: string;
  minute: number;
  frame_ts?: number;
  images_base64: string[]; // 1-4 JPEG frames as data URLs or base64
  team_hint?: "home" | "away" | "unknown";
  zone?: string;
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.match_id || !Array.isArray(body.images_base64) || body.images_base64.length === 0) {
      return json({ error: "match_id and images_base64 required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const imageContent = body.images_base64.slice(0, 4).map((img) => ({
      type: "image_url",
      image_url: { url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}` },
    }));

    const prompt = `Du bist ein erfahrener Fußballschiedsrichter. Analysiere die Zweikampfszene auf den ${imageContent.length} Frames.
Bewerte:
- probability (0-1): Wahrscheinlichkeit dass es ein Foul war
- severity: "none" | "foul" | "yellow" | "red"
- team: welche Mannschaft hat gefoult ("home", "away" oder "unknown")
- description: 1 Satz, max 140 Zeichen, nüchtern und sachlich

Antworte AUSSCHLIESSLICH als JSON:
{"probability":0.0-1.0,"severity":"...","team":"...","description":"..."}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...imageContent] }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return json({ error: `AI error ${aiRes.status}: ${txt}` }, 502);
    }
    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { probability: 0, severity: "none", team: "unknown", description: "Analyse fehlgeschlagen" }; }

    const evt = {
      match_id: body.match_id,
      minute: Math.max(0, Math.floor(body.minute ?? 0)),
      frame_ts: body.frame_ts ?? null,
      probability: Math.max(0, Math.min(1, Number(parsed.probability) || 0)),
      severity: ["none", "foul", "yellow", "red"].includes(parsed.severity) ? parsed.severity : "none",
      team: ["home", "away", "unknown"].includes(parsed.team) ? parsed.team : (body.team_hint ?? "unknown"),
      zone: body.zone ?? null,
      description: parsed.description ? String(parsed.description).slice(0, 280) : null,
    };

    const { data: stored } = await supabase
      .from("foul_probability_events")
      .insert(evt)
      .select()
      .single();

    return json({ event: stored ?? evt });
  } catch (e: any) {
    console.error("foul-probability error", e);
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});
