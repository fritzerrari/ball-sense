// Pre-Match Briefing: generates a compact 3-section briefing
// (Opponent DNA, Key Threats, Tactical Plan) from match-preparation + own match history.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReqBody {
  match_id: string;
  opponent_name?: string;
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: match } = await supabase
      .from("matches")
      .select("id, date, away_club_name, home_club_id, opponent_recent_form, opponent_logo_url")
      .eq("id", body.match_id)
      .maybeSingle();

    if (!match) return json({ error: "match not found" }, 404);
    const oppName = body.opponent_name ?? match.away_club_name;
    if (!oppName) return json({ error: "opponent name missing" }, 400);

    // Reuse match-preparation function for context
    const prepRes = await supabase.functions.invoke("match-preparation", {
      body: { opponent_name: oppName, club_id: match.home_club_id },
    });

    const prep = prepRes.data ?? {};

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const prompt = `Erstelle ein kompaktes 3-Seiten Pre-Match-Briefing für den Trainer (DE).
Gegner: ${oppName}
Spieltermin: ${new Date(match.date).toLocaleDateString("de-DE")}
Letzte Form (5 Spiele): ${JSON.stringify(match.opponent_recent_form ?? "unbekannt")}
Vorbereitungsdaten: ${JSON.stringify(prep).slice(0, 4000)}

Antworte AUSSCHLIESSLICH als JSON:
{
  "title": "...",
  "summary_1_sentence": "Kernaussage in 1 Satz",
  "pages": [
    {
      "title": "Gegner-DNA",
      "bullets": ["..."],
      "tactical_keywords": ["pressing-hoch","konter-stark"]
    },
    {
      "title": "Key Threats & Schwachstellen",
      "bullets": ["..."],
      "key_players": [{"name":"...","role":"...","threat":"..."}]
    },
    {
      "title": "Unser Matchplan",
      "phases": [
        {"phase":"0-15min","approach":"...","focus":"..."},
        {"phase":"15-45min","approach":"...","focus":"..."},
        {"phase":"45-75min","approach":"...","focus":"..."},
        {"phase":"75-90min","approach":"...","focus":"..."}
      ],
      "set_pieces": "..."
    }
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
    let briefing: any = {};
    try { briefing = JSON.parse(content); } catch { briefing = { title: "Briefing", pages: [] }; }

    const { data: stored } = await supabase
      .from("prematch_briefings")
      .insert({ match_id: body.match_id, briefing })
      .select()
      .single();

    return json({ briefing: stored ?? { briefing }, raw: briefing });
  } catch (e: any) {
    console.error("prematch-briefing error", e);
    return json({ error: e?.message ?? "unknown" }, 500);
  }
});
