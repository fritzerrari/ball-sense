// Coaching Cockpit – generates a halftime/fulltime locker-room address
// based on match events, score and player stats. Returns structured JSON.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReqBody {
  match_id: string;
  moment: "halftime" | "fulltime";
  tone?: "motivational" | "analytical" | "calm";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.match_id || !body?.moment) {
      return json({ error: "match_id and moment required" }, 400);
    }
    const tone = body.tone ?? "motivational";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull context
    const [{ data: match }, { data: events }, { data: playerStats }, { data: lineups }] =
      await Promise.all([
        supabase.from("matches").select("*, away_club_name, home_score, away_score").eq("id", body.match_id).maybeSingle(),
        supabase.from("match_events").select("minute, team, event_type, player_name, notes, event_zone, severity").eq("match_id", body.match_id).order("minute"),
        supabase.from("player_match_stats").select("team, distance_km, sprint_count, top_speed_kmh, goals, assists, pass_accuracy, duels_won, duels_total, rating").eq("match_id", body.match_id),
        supabase.from("match_lineups").select("team, player_name, shirt_number, starting").eq("match_id", body.match_id),
      ]);

    if (!match) return json({ error: "match not found" }, 404);

    // Cap events to first half if halftime
    const filteredEvents = (events ?? []).filter((e) =>
      body.moment === "halftime" ? e.minute <= 45 : true
    );

    const homeGoals = filteredEvents.filter((e) => e.team === "home" && e.event_type === "goal").length;
    const awayGoals = filteredEvents.filter((e) => e.team === "away" && (e.event_type === "goal" || e.event_type === "conceded_goal")).length;
    const finalHome = body.moment === "fulltime" ? (match.home_score ?? homeGoals) : homeGoals;
    const finalAway = body.moment === "fulltime" ? (match.away_score ?? awayGoals) : awayGoals;

    // Top performers
    const homePlayers = (playerStats ?? []).filter((p) => p.team === "home");
    const topPerformers = homePlayers
      .filter((p) => (p.rating ?? 0) > 0)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 3)
      .map((p, i) => {
        const lineup = (lineups ?? []).find((l) => l.team === "home" && l.shirt_number);
        return {
          rank: i + 1,
          name: lineup?.player_name ?? `Spieler #${lineup?.shirt_number ?? "?"}`,
          rating: p.rating,
          highlight: `${p.distance_km?.toFixed(1) ?? "?"} km, ${p.duels_won ?? 0}/${p.duels_total ?? 0} Duelle`,
        };
      });

    const eventSummary = filteredEvents.slice(0, 30).map((e) =>
      `${e.minute}' ${e.team === "home" ? "WIR" : "GEGNER"} ${e.event_type}${e.player_name ? ` (${e.player_name})` : ""}${e.notes ? ` – ${e.notes}` : ""}`
    ).join("\n");

    const toneInstruction = {
      motivational: "Sprich emotional, packend, mit Feuer. Nutze Imperative ('Wir greifen an!').",
      analytical: "Sprich nüchtern, datenbasiert, klar strukturiert. Vermeide Pathos.",
      calm: "Sprich ruhig, fokussiert, beruhigend. Hilf den Spielern, runterzukommen.",
    }[tone];

    const phaseLabel = body.moment === "halftime" ? "HALBZEIT-ANSPRACHE" : "VOLLZEIT-ANSPRACHE";
    const opponent = match.away_club_name ?? "Gegner";

    const systemPrompt = `Du bist ein erfahrener Cheftrainer im Amateur-/Halbprofifußball. Deine Aufgabe: Eine ${phaseLabel} formulieren, die ein Trainer wortwörtlich in der Kabine vorlesen kann.

Stil: ${toneInstruction}
Sprache: Deutsch, "Du"-Form an die Mannschaft.
Länge des Skripts: 90-150 Wörter (ca. 60-90 Sek. Sprechzeit).

Antworte AUSSCHLIESSLICH via Tool-Call.`;

    const userPrompt = `Spielstand zum Zeitpunkt: ${finalHome}:${finalAway} gegen ${opponent}
Phase: ${body.moment === "halftime" ? "Halbzeit (45 Min. gespielt, 45 Min. kommen)" : "Spielende"}
Wir = Heimteam.

EVENTS:
${eventSummary || "Keine erfassten Events."}

TOP-PERFORMER (eigenes Team):
${topPerformers.map((t) => `${t.rank}. ${t.name} (Note ${t.rating}, ${t.highlight})`).join("\n") || "Keine bewerteten Spieler."}

Erstelle die Ansprache.`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "deliver_address",
            description: "Liefert die strukturierte Trainer-Ansprache.",
            parameters: {
              type: "object",
              properties: {
                headline: { type: "string", description: "Kraftvolle Überschrift, max. 8 Wörter." },
                mood: { type: "string", enum: ["fired_up", "focused", "concerned", "celebratory", "regroup"] },
                key_messages: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: "object",
                    properties: {
                      icon: { type: "string", enum: ["target", "shield", "zap", "heart", "brain"] },
                      title: { type: "string", description: "Kurzer Titel (3-5 Wörter)." },
                      detail: { type: "string", description: "1-2 Sätze Konkretisierung." },
                    },
                    required: ["icon", "title", "detail"],
                  },
                },
                player_callouts: {
                  type: "array",
                  maxItems: 4,
                  items: {
                    type: "object",
                    properties: {
                      player_name: { type: "string" },
                      type: { type: "string", enum: ["praise", "challenge", "tactical", "rest"] },
                      message: { type: "string", description: "Direkte Ansprache an Spieler, max. 20 Wörter." },
                    },
                    required: ["player_name", "type", "message"],
                  },
                },
                tactical_adjustment: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "z.B. 'Höher pressen' oder 'Tiefe halten'." },
                    why: { type: "string", description: "Begründung, 1 Satz." },
                  },
                  required: ["title", "why"],
                },
                speech_script: {
                  type: "string",
                  description: "Vollständiger Vorlese-Text, 90-150 Wörter, fließender Monolog.",
                },
              },
              required: ["headline", "mood", "key_messages", "player_callouts", "tactical_adjustment", "speech_script"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "deliver_address" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      if (aiResp.status === 429) return json({ error: "Rate-Limit erreicht. Bitte später erneut versuchen." }, 429);
      if (aiResp.status === 402) return json({ error: "Lovable AI Credits aufgebraucht." }, 402);
      return json({ error: "AI gateway error" }, 500);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return json({ error: "Kein Tool-Call von KI erhalten." }, 500);
    }
    const result = JSON.parse(toolCall.function.arguments);

    return json({
      ok: true,
      moment: body.moment,
      tone,
      score: { home: finalHome, away: finalAway, opponent },
      address: result,
    });
  } catch (e) {
    console.error("coaching-cockpit error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
