// Verify-Goal-Highlight: takes 3-12 high-resolution frames captured around a
// reported goal moment (1s spacing from the client-side ring buffer) and asks
// Gemini Vision to confirm whether a goal occurred, plus identify scorer,
// assist provider, and team. Returns a structured verdict.
//
// Robustness:
//  - All frames optional except minimum 1.
//  - Falls back to "uncertain" verdict on any AI/network error (job never fails).
//  - Idempotent: same input → same DB row (upsert by match_id + minute).
//  - Result stored in analysis_results with type='goal_verification'.
//  - Auth: validates JWT and the user's club owns the match.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifyRequest {
  match_id: string;
  minute: number;
  team?: "home" | "away";
  frames: string[]; // base64 JPEG, no data: prefix, 1s apart
}

interface Verdict {
  goal_confirmed: boolean;
  confidence: number;
  team: "home" | "away" | "unknown";
  scorer_jersey?: number;
  assist_jersey?: number;
  evidence: string;
  fallback_reason?: string;
}

function uncertainVerdict(reason: string): Verdict {
  return {
    goal_confirmed: false,
    confidence: 0,
    team: "unknown",
    evidence: "Konnte nicht überprüft werden — Tor bleibt manuell bestätigt.",
    fallback_reason: reason,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let match_id = "";
  let minute = 0;
  try {
    const body: VerifyRequest = await req.json();
    match_id = body.match_id;
    minute = body.minute;
    const team = body.team;
    const frames = Array.isArray(body.frames) ? body.frames : [];

    // ── Validation ──
    if (!match_id || typeof minute !== "number" || frames.length < 1) {
      return new Response(JSON.stringify({ error: "match_id, minute and at least 1 frame required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (frames.length > 12) {
      return new Response(JSON.stringify({ error: "max 12 frames per call" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Auth & ownership check (defense in depth) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirm the user's club owns this match.
    const { data: profile } = await supabase
      .from("profiles")
      .select("club_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    const { data: match } = await supabase
      .from("matches")
      .select("home_club_id, away_club_name, h1_started_at")
      .eq("id", match_id)
      .maybeSingle();
    if (!match || !profile || match.home_club_id !== profile.club_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Persist uncertain verdict so client gets a result either way
      const verdict = uncertainVerdict("AI gateway not configured");
      await persistVerdict(supabase, match_id, minute, verdict);
      return new Response(JSON.stringify(verdict), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Build prompt ──
    const userContent: any[] = [
      {
        type: "text",
        text: `Analysiere ${frames.length} Standbilder, aufgenommen im 1-Sekunden-Takt rund um eine vom Trainer gemeldete TOR-Situation in Spielminute ${minute}${team ? ` (gemeldetes Team: ${team})` : ""}.

Frage: Ist tatsächlich ein TOR gefallen?

Achte auf:
- Ball im Tornetz (stärkstes Signal)
- Spieler-Jubeltraube (Umarmungen, Faustballen, Trikot in die Höhe)
- Mehrere Spieler laufen Richtung Mittellinie
- Gegner stehen niedergeschlagen / sammeln Ball aus dem Tor
- Schiedsrichter zeigt zur Mittellinie
- Trikotnummer des jubelnden Spielers (Schütze) und des nahen Mitspielers (Vorlagengeber) wenn lesbar

Antworte ehrlich:
- Wenn unsicher: confidence < 0.5 und goal_confirmed=false
- Wenn KEINE der genannten Indikatoren sichtbar: goal_confirmed=false`,
      },
    ];
    for (const frame of frames) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${frame}` },
      });
    }

    // ── AI call with retries ──
    const aiBody = JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: userContent }],
      tools: [
        {
          type: "function",
          function: {
            name: "submit_goal_verdict",
            description: "Submit goal verification verdict",
            parameters: {
              type: "object",
              properties: {
                goal_confirmed: { type: "boolean" },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                team: { type: "string", enum: ["home", "away", "unknown"] },
                scorer_jersey: { type: "integer", minimum: 1, maximum: 99 },
                assist_jersey: { type: "integer", minimum: 1, maximum: 99 },
                evidence: { type: "string" },
              },
              required: ["goal_confirmed", "confidence", "team", "evidence"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "submit_goal_verdict" } },
    });

    let aiResponse: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: aiBody,
        });
        if (aiResponse.ok || aiResponse.status === 402 || aiResponse.status === 429) break;
      } catch (e) {
        console.warn(`[verify-goal] attempt ${attempt} failed:`, e);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }

    if (!aiResponse) {
      const verdict = uncertainVerdict("AI gateway unreachable after retries");
      await persistVerdict(supabase, match_id, minute, verdict);
      return new Response(JSON.stringify(verdict), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (aiResponse.status === 429) {
      const verdict = uncertainVerdict("Rate limit");
      return new Response(JSON.stringify(verdict), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResponse.status === 402) {
      const verdict = uncertainVerdict("AI credits exhausted");
      return new Response(JSON.stringify(verdict), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResponse.ok) {
      const verdict = uncertainVerdict(`AI error ${aiResponse.status}`);
      await persistVerdict(supabase, match_id, minute, verdict);
      return new Response(JSON.stringify(verdict), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let verdict: Verdict;
    try {
      const aiResult = await aiResponse.json();
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No tool call");
      const parsed = JSON.parse(toolCall.function.arguments);
      verdict = {
        goal_confirmed: !!parsed.goal_confirmed,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        team: ["home", "away", "unknown"].includes(parsed.team) ? parsed.team : "unknown",
        scorer_jersey: Number.isInteger(parsed.scorer_jersey) ? parsed.scorer_jersey : undefined,
        assist_jersey: Number.isInteger(parsed.assist_jersey) ? parsed.assist_jersey : undefined,
        evidence: typeof parsed.evidence === "string" ? parsed.evidence.slice(0, 500) : "",
      };
    } catch (e) {
      console.warn("[verify-goal] parse failed:", e);
      verdict = uncertainVerdict("Could not parse AI response");
    }

    await persistVerdict(supabase, match_id, minute, verdict);

    return new Response(JSON.stringify(verdict), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[verify-goal] fatal:", e);
    const verdict = uncertainVerdict(e instanceof Error ? e.message : "unknown");
    if (match_id) {
      try { await persistVerdict(supabase, match_id, minute, verdict); } catch {}
    }
    return new Response(JSON.stringify(verdict), {
      status: 200, // never break the client flow
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function persistVerdict(supabase: any, match_id: string, minute: number, verdict: Verdict) {
  try {
    // Idempotent: delete prior verdict for same minute, then insert.
    await supabase
      .from("analysis_results")
      .delete()
      .eq("match_id", match_id)
      .eq("result_type", "goal_verification")
      .filter("data->>minute", "eq", String(minute));

    await supabase.from("analysis_results").insert({
      match_id,
      job_id: match_id, // placeholder — schema requires job_id; use match_id for verification rows
      result_type: "goal_verification",
      data: { minute, ...verdict, created_at: new Date().toISOString() },
      confidence: verdict.confidence,
    });
  } catch (e) {
    console.warn("[verify-goal] persist failed (non-fatal):", e);
  }
}
