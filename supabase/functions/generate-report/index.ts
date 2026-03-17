import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REPORT_PROMPTS: Record<string, string> = {
  prematch: `Du erstellst einen professionellen VORBERICHT für ein Fußballspiel.

Struktur:
1. **Ausgangslage** – Aktuelle Form beider Teams
2. **Kaderanalyse** – Schlüsselspieler, Ausfälle, Formkurven
3. **Taktische Vorschau** – Erwartete Formationen und Spielweise
4. **Schlüsselduelle** – Entscheidende Einzelduelle
5. **Prognose** – Erwarteter Spielverlauf

Beziehe dich auf die bereitgestellten Daten. Wenn Daten fehlen, sage das.`,

  halftime: `Du erstellst einen professionellen HALBZEITBERICHT.

Struktur:
1. **Erste Hälfte** – Zusammenfassung der ersten 45 Minuten
2. **Taktische Analyse** – Was funktioniert, was nicht? Pressing, Ballbesitz, Raumkontrolle
3. **Auffällige Spieler** – Wer sticht positiv/negativ hervor? Datenbelege
4. **Laufleistung & Intensität** – Vergleich der Teams bei Distanz, Sprints, Speed
5. **Taktische Empfehlungen** – Konkrete Anpassungen für die zweite Hälfte (Auswechslungen, Formationswechsel, taktische Änderungen)

Sei konkret und handlungsorientiert — der Trainer liest das in der Kabine.`,

  match: `Du erstellst einen professionellen SPIELBERICHT nach einem Fußballspiel.

Struktur:
1. **Spielverlauf** – Chronologische Zusammenfassung mit Toren, Karten, Wechseln
2. **Taktische Analyse** – Formationen, Pressing, Umschaltspiel, Ballbesitzphasen
3. **Spieler des Spiels** – Top-Performer mit Datenbelegen (km, Sprints, Passquote, Zweikämpfe, Tore, Assists)
4. **Laufleistung & Fitness** – Distanzen, Sprints, Intensitätszonen, Ermüdungszeichen
5. **Detailstatistiken** – Passgenauigkeit, Zweikampfquoten, Schusseffizienz beider Teams
6. **Fazit & Ausblick** – Was bedeutet das für die nächsten Spiele?

Beziehe dich auf ALLE bereitgestellten Tracking- und Statistikdaten.`,

  training: `Du erstellst einen personalisierten TRAININGSPLAN basierend auf den Spieldaten.

Struktur:
1. **Leistungsanalyse** – Zusammenfassung der physischen und taktischen Leistungsdaten
2. **Identifizierte Schwächen** – Bereiche mit Verbesserungspotential (basierend auf Daten)
3. **Wochentrainingsplan** – 5 Trainingseinheiten (Mo-Fr) mit konkreten Übungen:
   - Aufwärmen, Hauptteil, Auslaufen
   - Dauer pro Einheit
   - Intensitätslevel
4. **Individuelle Empfehlungen** – Pro Spieler (Top 5) spezifische Trainingshinweise
5. **Regenerationshinweise** – Belastungssteuerung, Ruhetage, Ernährungstipps

Sei konkret, praxisorientiert und beziehe dich auf die tatsächlichen Spielerdaten.`,
};

const LENGTH_INSTRUCTIONS: Record<string, string> = {
  short: "Halte den Bericht kurz und prägnant: ca. 300-400 Wörter.",
  medium: "Erstelle einen ausführlichen Bericht: ca. 600-800 Wörter.",
  long: "Erstelle einen sehr detaillierten Bericht: ca. 1000-1500 Wörter mit tiefgehender Analyse.",
};

const STYLE_INSTRUCTIONS: Record<string, string> = {
  professional: "Schreibe im sachlichen, professionellen Stil eines Analysten.",
  journalistic: "Schreibe im packenden, journalistischen Stil eines Sportreporters.",
  coaching: "Schreibe im direkten, handlungsorientierten Stil eines Trainers an sein Team.",
  social: "Schreibe im Stil eines Social-Media-Posts: kurz, knackig, mit Emojis und Hashtags. Maximal 280 Zeichen pro Absatz. Nutze ⚽🔥💪📊 etc.",
  newspaper: "Schreibe im klassischen Zeitungsstil: neutral, sachlich, in der dritten Person. Verwende einen Lead-Satz, dann den Bericht im umgekehrten Pyramidenstil.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { matchId, reportType, length, style } = await req.json();

    if (!matchId || !reportType) {
      return new Response(JSON.stringify({ error: "matchId and reportType required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting: max 10 reports per day per user
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from("report_generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", `${today}T00:00:00Z`);

    if ((count ?? 0) >= 10) {
      return new Response(JSON.stringify({ error: "Tageslimit erreicht (max. 10 Berichte/Tag)." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("club_id")
      .eq("user_id", userId)
      .single();

    const clubId = profile?.club_id;

    const { data: match } = await supabase
      .from("matches")
      .select("*, fields(name)")
      .eq("id", matchId)
      .single();

    if (!match) {
      return new Response(JSON.stringify({ error: "Spiel nicht gefunden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [clubRes, lineupsRes, playerStatsRes, teamStatsRes, apiStatsRes] = await Promise.all([
      clubId ? supabase.from("clubs").select("name, league").eq("id", clubId).single() : Promise.resolve({ data: null }),
      supabase.from("match_lineups").select("*, players(name, number, position)").eq("match_id", matchId),
      supabase.from("player_match_stats").select("*, players(name, number, position)").eq("match_id", matchId),
      supabase.from("team_match_stats").select("*").eq("match_id", matchId),
      supabase.from("api_football_match_stats").select("*").eq("match_id", matchId),
    ]);

    const homeLineups = (lineupsRes.data || []).filter((l: any) => l.team === "home");
    const awayLineups = (lineupsRes.data || []).filter((l: any) => l.team === "away");
    const homeStats = (teamStatsRes.data || []).find((t: any) => t.team === "home");
    const awayStats = (teamStatsRes.data || []).find((t: any) => t.team === "away");
    const apiStats = apiStatsRes.data?.[0];

    let context = `--- SPIELDATEN ---
Verein: ${clubRes.data?.name || "Unbekannt"}
Liga: ${clubRes.data?.league || "Nicht angegeben"}
Datum: ${match.date}${match.kickoff ? ` · Anstoß: ${match.kickoff}` : ""}
Platz: ${(match.fields as any)?.name || "Unbekannt"}
Gegner: ${match.away_club_name || "Unbekannt"}
Heim-Formation: ${match.home_formation || "Nicht festgelegt"}
Gast-Formation: ${match.away_formation || "Nicht festgelegt"}
Status: ${match.status}

HEIM-AUFSTELLUNG (${homeLineups.length}):
${homeLineups.map((l: any) => `- #${l.shirt_number ?? l.players?.number ?? "?"} ${l.players?.name ?? l.player_name ?? "?"} (${l.players?.position ?? "?"}) ${l.starting ? "Startelf" : "Bank"}`).join("\n") || "Keine Aufstellung"}

GAST-AUFSTELLUNG (${awayLineups.length}):
${awayLineups.map((l: any) => `- #${l.shirt_number ?? "?"} ${l.player_name ?? "?"} ${l.starting ? "Startelf" : "Bank"}`).join("\n") || "Keine Aufstellung"}
`;

    if (homeStats || awayStats) {
      context += `
TEAM-STATISTIKEN:
${homeStats ? `Heim: ${homeStats.total_distance_km?.toFixed(1) ?? "?"}km gesamt, Ø ${homeStats.avg_distance_km?.toFixed(1) ?? "?"}km, Top ${homeStats.top_speed_kmh?.toFixed(1) ?? "?"}km/h, Ballbesitz ${homeStats.possession_pct?.toFixed(0) ?? "?"}%` : ""}
${awayStats ? `Gast: ${awayStats.total_distance_km?.toFixed(1) ?? "?"}km gesamt, Ø ${awayStats.avg_distance_km?.toFixed(1) ?? "?"}km, Top ${awayStats.top_speed_kmh?.toFixed(1) ?? "?"}km/h, Ballbesitz ${awayStats.possession_pct?.toFixed(0) ?? "?"}%` : ""}
`;
    }

    const homePlayerStats = (playerStatsRes.data || []).filter((s: any) => s.team === "home");
    if (homePlayerStats.length > 0) {
      context += `
SPIELER-STATISTIKEN (Heim):
${homePlayerStats.map((s: any) => `- #${s.players?.number ?? "?"} ${s.players?.name ?? "?"} (${s.players?.position ?? "?"}): ${s.distance_km?.toFixed(1) ?? "?"}km, Top ${s.top_speed_kmh?.toFixed(1) ?? "?"}km/h, ${s.sprint_count ?? 0} Sprints, ${s.minutes_played ?? "?"}min, Pässe ${s.passes_completed ?? "?"}/${s.passes_total ?? "?"} (${s.pass_accuracy ? s.pass_accuracy.toFixed(0) + "%" : "?"}), Zweikämpfe ${s.duels_won ?? "?"}/${s.duels_total ?? "?"}, Tackles ${s.tackles ?? 0}, Tore ${s.goals ?? 0}, Assists ${s.assists ?? 0}, Schüsse ${s.shots_on_target ?? 0}/${s.shots_total ?? 0}, Ballkontakte ${s.ball_contacts ?? "?"}, Fouls ${s.fouls_committed ?? 0}, Rating ${s.rating ?? "?"}`).join("\n")}
`;
    }

    if (apiStats) {
      context += `
API-FOOTBALL STATISTIKEN:
Ergebnis: ${apiStats.home_goals ?? "?"} : ${apiStats.away_goals ?? "?"}
Schüsse: ${apiStats.shots_home ?? "?"} (${apiStats.shots_on_target_home ?? "?"} aufs Tor) vs ${apiStats.shots_away ?? "?"} (${apiStats.shots_on_target_away ?? "?"} aufs Tor)
Ballbesitz: ${apiStats.possession_home ?? "?"}% vs ${apiStats.possession_away ?? "?"}%
Pässe: ${apiStats.passes_home ?? "?"} (${apiStats.pass_accuracy_home ?? "?"}% Genauigkeit) vs ${apiStats.passes_away ?? "?"} (${apiStats.pass_accuracy_away ?? "?"}%)
Ecken: ${apiStats.corners_home ?? "?"} vs ${apiStats.corners_away ?? "?"}
Fouls: ${apiStats.fouls_home ?? "?"} vs ${apiStats.fouls_away ?? "?"}
Gelbe Karten: ${apiStats.yellow_cards_home ?? "?"} vs ${apiStats.yellow_cards_away ?? "?"}
Rote Karten: ${apiStats.red_cards_home ?? "?"} vs ${apiStats.red_cards_away ?? "?"}
`;
    }

    context += "--- ENDE SPIELDATEN ---";

    const promptKey = reportType in REPORT_PROMPTS ? reportType : "match";
    const systemPrompt = `Du bist der Taktik-Analyst von FieldIQ. Antworte immer auf Deutsch. Formatiere mit Markdown.
${REPORT_PROMPTS[promptKey]}
${LENGTH_INSTRUCTIONS[length] || LENGTH_INSTRUCTIONS.medium}
${STYLE_INSTRUCTIONS[style] || STYLE_INSTRUCTIONS.professional}

${context}`;

    const userMessages: Record<string, string> = {
      prematch: "Erstelle einen Vorbericht für dieses Spiel.",
      halftime: "Erstelle einen Halbzeitbericht basierend auf den bisherigen Daten der ersten Hälfte.",
      match: "Erstelle einen Spielbericht basierend auf den vorliegenden Daten.",
      training: "Erstelle einen detaillierten Trainingsplan für die kommende Woche basierend auf den Spieldaten und Spielerleistungen.",
    };

    await supabase.from("report_generations").insert({
      user_id: userId,
      match_id: matchId,
      club_id: clubId,
      report_type: reportType,
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessages[promptKey] || userMessages.match },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte warte kurz." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "KI-Credits aufgebraucht." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "KI-Dienst nicht verfügbar" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
