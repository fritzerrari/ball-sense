// supabase/functions/generate-press-release/index.ts
// Generates pre-match or post-match press releases via Lovable AI
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

type Tone = "neutral" | "enthusiastic" | "analytical";
type Length = "short" | "medium" | "long";
type Kind = "pre_match" | "post_match";

const LENGTH_WORDS: Record<Length, number> = { short: 300, medium: 600, long: 1200 };

const TONE_DE: Record<Tone, string> = {
  neutral: "sachlich, vereinsneutral, nüchtern berichtend",
  enthusiastic: "begeistert, identifikationsstiftend, mit emotionalen Akzenten – aber ohne Übertreibung",
  analytical: "analytisch, datenbasiert, mit taktischen Einordnungen",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return j({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const matchId: string = body.match_id;
    const kind: Kind = body.kind ?? "post_match";
    const tone: Tone = body.tone ?? "neutral";
    const length: Length = body.length ?? "medium";
    const quotes: Array<{ author: string; text: string }> = Array.isArray(body.quotes) ? body.quotes : [];
    const language: string = body.language ?? "de";

    if (!matchId) return j({ error: "match_id required" }, 400);

    // Fetch match with related context
    const { data: match, error: mErr } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();
    if (mErr || !match) return j({ error: "Match not found" }, 404);

    const clubId = match.home_club_id;

    const [{ data: club }, { data: events }, { data: playerStats }, { data: lineups }, { data: seasonCache }] =
      await Promise.all([
        supabase.from("clubs").select("name, league, city").eq("id", clubId).single(),
        supabase.from("match_events").select("*").eq("match_id", matchId).order("minute", { ascending: true }),
        supabase.from("player_match_stats").select("*").eq("match_id", matchId),
        supabase.from("match_lineups").select("*").eq("match_id", matchId),
        supabase.from("season_hub_cache").select("data, source").eq("club_id", clubId).maybeSingle(),
      ]);

    // Build context for prompt
    const context: any = {
      home_team: club?.name ?? "Heimteam",
      away_team: match.away_club_name ?? "Gegner",
      league: club?.league,
      city: club?.city,
      date: match.date,
      kickoff: match.kickoff,
      home_score: match.home_score,
      away_score: match.away_score,
      status: match.status,
      home_jersey: match.home_jersey_color,
      away_jersey: match.away_jersey_color,
    };

    if (kind === "post_match") {
      context.events = (events ?? []).map((e: any) => ({
        minute: e.minute,
        team: e.team,
        type: e.event_type,
        player: e.player_name,
        related_player: e.related_player_name,
        notes: e.notes,
        verified: e.verified,
      }));
      context.top_performers = (playerStats ?? [])
        .filter((p: any) => p.team === "home")
        .sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 5)
        .map((p: any) => ({
          name: lineups?.find((l: any) => l.player_id === p.player_id)?.player_name,
          goals: p.goals,
          assists: p.assists,
          rating: p.rating,
          distance_km: p.distance_km,
          top_speed_kmh: p.top_speed_kmh,
          duels_won: p.duels_won,
          duels_total: p.duels_total,
        }));
    }

    if (kind === "pre_match" && seasonCache?.data) {
      const sd: any = seasonCache.data;
      context.standings_rank = sd.our_rank?.rank;
      context.standings_points = sd.our_rank?.points;
      context.last_results = (sd.last_results ?? []).slice(0, 5).map((r: any) => ({
        opponent: r.opponent,
        result: r.result,
        score: `${r.our_goals}:${r.their_goals}`,
        is_home: r.is_home,
      }));
      context.next_match = sd.next_match;
    }

    if (quotes.length > 0) context.coach_quotes = quotes;

    const sys = buildSystemPrompt(kind, tone, length, language);
    const user = `KONTEXT (JSON):\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`\n\nErstelle den ${kind === "pre_match" ? "Vorbericht" : "Spielbericht"} im Pressetext-Stil. Maximal ${LENGTH_WORDS[length]} Wörter. Antwort als JSON via Tool-Call.`;

    const aiResp = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_press_release",
              description: "Strukturierter Pressebericht",
              parameters: {
                type: "object",
                properties: {
                  headline: { type: "string", description: "Schlagzeile, max 90 Zeichen, aktiv" },
                  lead: { type: "string", description: "Lead-Absatz, 1-2 Sätze, fasst Kern zusammen" },
                  body_html: {
                    type: "string",
                    description: "Hauptteil als HTML mit <p>, <h3>, <strong>, <ul><li>. Keine Inline-Styles.",
                  },
                  suggested_quotes: {
                    type: "array",
                    description: "1-2 KI-vorgeschlagene Zitate (Konjunktiv) – nur wenn keine Trainer-Zitate gegeben wurden",
                    items: {
                      type: "object",
                      properties: {
                        author: { type: "string" },
                        text: { type: "string" },
                      },
                      required: ["author", "text"],
                    },
                  },
                },
                required: ["headline", "lead", "body_html"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_press_release" } },
      }),
    });

    if (aiResp.status === 429) return j({ error: "AI rate limit – bitte später erneut versuchen." }, 429);
    if (aiResp.status === 402) return j({ error: "AI-Guthaben aufgebraucht. Bitte in Lovable Cloud aufladen." }, 402);
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return j({ error: "AI gateway error" }, 502);
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return j({ error: "AI response had no tool call" }, 502);

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return j({ error: "AI returned invalid JSON" }, 502);
    }

    // Persist
    const insertPayload = {
      match_id: matchId,
      club_id: clubId,
      kind,
      language,
      headline: parsed.headline ?? "",
      lead: parsed.lead ?? "",
      body_html: parsed.body_html ?? "",
      quotes: quotes.length > 0 ? quotes : (parsed.suggested_quotes ?? []),
      tone,
      length,
      status: "draft",
      generated_by_ai: true,
      manually_edited: false,
      created_by: userData.user.id,
    };

    const { data: saved, error: insErr } = await supabase
      .from("press_releases")
      .insert(insertPayload)
      .select()
      .single();

    if (insErr) {
      console.error("insert press_release", insErr);
      return j({ error: "Speichern fehlgeschlagen", detail: insErr.message }, 500);
    }

    return j({ press_release: saved });
  } catch (e) {
    console.error("generate-press-release error:", e);
    return j({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }, 500);
  }
});

function j(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildSystemPrompt(kind: Kind, tone: Tone, length: Length, language: string): string {
  const langInstr = language === "en" ? "Antworte auf Englisch." : "Antworte auf Deutsch.";
  const intro = kind === "pre_match"
    ? `Du bist Pressesprecher eines Fußballvereins. Du schreibst einen VORBERICHT (Spielvorschau) auf das anstehende Spiel.`
    : `Du bist Pressesprecher eines Fußballvereins. Du schreibst einen SPIELBERICHT (Match-Recap) im Stil einer Vereins-Pressemitteilung.`;

  const rules = [
    `Tonalität: ${TONE_DE[tone]}.`,
    `Länge: ca. ${LENGTH_WORDS[length]} Wörter (Headline + Lead + Body zusammen).`,
    `Aktiv-Konstruktionen, kurze Sätze, klare Faktenführung.`,
    `Vereinsperspektive: Der Heimverein ist "wir/unser Team". Bleib trotzdem fair und respektvoll gegenüber dem Gegner.`,
    `Headline: prägnant, max 90 Zeichen, ohne Doppelpunkt-Spielereien.`,
    `Lead: 1–2 Sätze, beantwortet Wer/Was/Wann/Wo.`,
    `Body als HTML mit <p>, optional <h3> Zwischenüberschriften, <strong> sparsam, <ul><li> für Aufzählungen wie Torschützen oder Aufstellung.`,
    `Keine Phantasie-Statistiken erfinden. Nur das nutzen, was im KONTEXT steht.`,
    `Wenn Trainer-Zitate gegeben sind, baue sie wörtlich in <p>-Block mit Anführungszeichen ein.`,
    `Wenn keine Trainer-Zitate gegeben, schlage 1-2 plausible Zitate als suggested_quotes vor (klar als Vorschlag erkennbar via "(Vorschlag)").`,
    kind === "post_match"
      ? `Berichtstruktur: Lead → Spielverlauf chronologisch → Wendepunkte → Top-Performer → Ausblick.`
      : `Vorberichtstruktur: Lead → Ausgangslage (Tabellenplatz/Form) → Gegner-Einordnung → Personal/Setup → Trainer-Statement.`,
    langInstr,
  ];

  return [intro, "Regeln:", ...rules.map((r) => `- ${r}`)].join("\n");
}
