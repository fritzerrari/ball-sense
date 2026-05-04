import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: profile } = await supabase.from("profiles").select("club_id").eq("user_id", userData.user.id).maybeSingle();
    const clubId = profile?.club_id;
    if (!clubId) return new Response(JSON.stringify({ error: "no_club" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Letzte 5 finalisierte Matches mit Stats
    const { data: matches } = await supabase
      .from("matches")
      .select("id, opponent, match_date, home_score, away_score, ai_summary")
      .eq("home_club_id", clubId)
      .eq("status", "completed")
      .order("match_date", { ascending: false })
      .limit(5);

    if (!matches || matches.length === 0) {
      return new Response(JSON.stringify({ generated: 0, reason: "no_matches" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const matchIds = matches.map(m => m.id);
    const { data: teamStats } = await supabase
      .from("team_match_stats")
      .select("match_id, team, possession_pct, total_distance_km, top_speed_kmh")
      .in("match_id", matchIds);

    // Player-Trends (nur eigenes Team)
    const { data: playerStats } = await supabase
      .from("player_match_stats")
      .select("match_id, player_id, distance_km, top_speed_kmh, sprint_count")
      .in("match_id", matchIds);

    const summary = {
      matches: matches.map(m => ({
        id: m.id,
        opp: m.opponent,
        date: m.match_date,
        score: `${m.home_score ?? "?"}:${m.away_score ?? "?"}`,
        ai: m.ai_summary?.slice(0, 200),
      })),
      team: teamStats ?? [],
      players: playerStats ?? [],
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "no_ai_key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prompt = `Du bist Coach-Assistent. Analysiere die letzten Matches und gib max. 5 konkrete Handlungsempfehlungen aus.
Antworte NUR mit JSON-Array: [{"category":"praise|warning|tactic|fitness|development","title":"kurz","body":"konkret 2-3 Sätze","priority":1|2|3,"match_id":"uuid|null","player_id":"uuid|null"}]
Daten: ${JSON.stringify(summary).slice(0, 8000)}`;

    const aiStart = Date.now();
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      return new Response(JSON.stringify({ error: "ai_failed", status: aiRes.status }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const aiJson = await aiRes.json();
    const text: string = aiJson?.choices?.[0]?.message?.content ?? "[]";
    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();

    let recs: any[] = [];
    try { recs = JSON.parse(cleaned); } catch { recs = []; }
    if (!Array.isArray(recs)) recs = [];

    const inserts = recs.slice(0, 5).map(r => ({
      club_id: clubId,
      match_id: r.match_id || null,
      player_id: r.player_id || null,
      category: ["praise","warning","tactic","fitness","development","admin"].includes(r.category) ? r.category : "tactic",
      title: String(r.title ?? "").slice(0, 200),
      body: String(r.body ?? "").slice(0, 1000),
      priority: [1,2,3].includes(r.priority) ? r.priority : 2,
      action_url: r.match_id ? `/matches/${r.match_id}` : null,
      source: "ai",
      metadata: { generated_at: new Date().toISOString() },
    })).filter(i => i.title && i.body);

    if (inserts.length > 0) {
      await supabase.from("coach_inbox_items").insert(inserts);
    }

    // Log AI usage
    try {
      await supabase.from("ai_usage_log").insert({
        club_id: clubId,
        function_name: "coach-inbox-generate",
        model: "google/gemini-2.5-flash",
        prompt_tokens: aiJson?.usage?.prompt_tokens ?? null,
        completion_tokens: aiJson?.usage?.completion_tokens ?? null,
        total_tokens: aiJson?.usage?.total_tokens ?? null,
        duration_ms: Date.now() - aiStart,
      });
    } catch (_) {}

    return new Response(JSON.stringify({ generated: inserts.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
