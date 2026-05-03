// Live-Coaching: generates real-time tactical recommendations during a match
// based on the latest events, score and positional data. Persists to live_coaching_advice.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReqBody {
  match_id: string;
  current_minute?: number;
  half?: 1 | 2;
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
    if (!body?.match_id) return json({ error: "match_id required" }, 400);

    const minute = Math.max(0, Math.min(120, Math.floor(body.current_minute ?? 0)));
    const half = body.half ?? (minute > 45 ? 2 : 1);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [matchRes, eventsRes, positionsRes] = await Promise.all([
      supabase.from("matches").select("id, away_club_name, home_score, away_score, home_formation, away_formation").eq("id", body.match_id).maybeSingle(),
      supabase.from("match_events").select("minute, team, event_type, player_name, event_zone, severity").eq("match_id", body.match_id).order("minute"),
      supabase.from("frame_positions").select("team, x, y, frame_ts").eq("match_id", body.match_id).order("frame_ts", { ascending: false }).limit(400),
    ]);

    const match = matchRes.data;
    if (!match) return json({ error: "match not found" }, 404);

    const events = (eventsRes.data ?? []).filter((e: any) => e.minute <= minute);
    const positions = positionsRes.data ?? [];

    // Compute simple spatial signal: average team x for last 200 positions per side (0=own goal, 100=opp goal for home)
    const homeX = positions.filter((p: any) => p.team === "home").slice(0, 200).map((p: any) => p.x);
    const awayX = positions.filter((p: any) => p.team === "away").slice(0, 200).map((p: any) => p.x);
    const avg = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 50;
    const homeBlockX = Math.round(avg(homeX));
    const awayBlockX = Math.round(avg(awayX));

    const lastGoals = events.filter((e: any) => e.event_type === "goal");
    const homeGoals = lastGoals.filter((e: any) => e.team === "home").length;
    const awayGoals = lastGoals.filter((e: any) => e.team === "away").length;
    const lead = homeGoals - awayGoals;

    const recentEvents = events.slice(-20).map((e: any) => `${e.minute}' ${e.team} ${e.event_type}${e.event_zone ? ` (${e.event_zone})` : ""}`).join("\n");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const prompt = `Du bist ein Top-Fußballtaktiker und gibst LIVE-Empfehlungen während des Spiels.
Aktuelle Minute: ${minute}' (Halbzeit ${half})
Gegner: ${match.away_club_name ?? "Unbekannt"}
Spielstand: ${homeGoals}:${awayGoals} (Differenz: ${lead >= 0 ? "+" : ""}${lead})
Heim-Block durchschn. X (0=eigenes Tor, 100=gegn. Tor): ${homeBlockX}
Gast-Block durchschn. X: ${awayBlockX}
Heim-Formation: ${match.home_formation ?? "?"}, Gast-Formation: ${match.away_formation ?? "?"}

Letzte Events:
${recentEvents || "(keine)"}

Gib 2-3 SOFORT umsetzbare taktische Mikro-Empfehlungen für die nächsten 10-15 Minuten.
Antworte AUSSCHLIESSLICH als JSON:
{
  "headline": "Kurzer Kernsatz (max 60 Zeichen)",
  "reasoning": "1-2 Sätze warum (max 200 Zeichen)",
  "urgency": "low|medium|high",
  "recommendations": [
    {"icon":"shield|swords|move|heart|brain","title":"Kurztitel","action":"Konkrete Anweisung max 120 Zeichen"}
  ]
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
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
    try { parsed = JSON.parse(content); } catch { parsed = { headline: "Keine Empfehlung", recommendations: [] }; }

    const advice = {
      match_id: body.match_id,
      minute,
      half,
      headline: String(parsed.headline ?? "Aktuelle Lage").slice(0, 200),
      reasoning: parsed.reasoning ? String(parsed.reasoning).slice(0, 500) : null,
      urgency: ["low", "medium", "high"].includes(parsed.urgency) ? parsed.urgency : "medium",
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 5) : [],
    };

    const { data: stored, error: insErr } = await supabase
      .from("live_coaching_advice")
      .insert(advice)
      .select()
      .single();
    if (insErr) console.error("insert error:", insErr);

    return json({ advice: stored ?? advice, signals: { homeBlockX, awayBlockX, lead } });
  } catch (e: any) {
    console.error("live-coaching error", e);
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});
