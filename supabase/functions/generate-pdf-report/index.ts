import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const { match_id, report_type, opponentName, clubName } = body;

    if (!match_id) {
      return new Response(JSON.stringify({ error: "match_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load match data
    const { data: match } = await supabase
      .from("matches")
      .select("*, fields(name), home_club:clubs!matches_home_club_id_fkey(name, logo_url)")
      .eq("id", match_id)
      .single();

    // Load report sections
    const { data: sections } = await supabase
      .from("report_sections")
      .select("*")
      .eq("match_id", match_id)
      .order("sort_order");

    // Load training recommendations
    const { data: trainingRecs } = await supabase
      .from("training_recommendations")
      .select("*")
      .eq("match_id", match_id)
      .order("priority");

    // Load match events
    const { data: matchEvents } = await supabase
      .from("match_events")
      .select("*")
      .eq("match_id", match_id)
      .order("minute");

    // Load team stats
    const { data: teamStats } = await supabase
      .from("team_match_stats")
      .select("*")
      .eq("match_id", match_id);

    // Load player stats
    const { data: playerStats } = await supabase
      .from("player_match_stats")
      .select("*, players(name, number, position)")
      .eq("match_id", match_id)
      .eq("team", "home")
      .order("rating", { ascending: false });

    // Load match preparation if needed
    let prepData = null;
    if (report_type === "match_prep" || report_type === "halftime_tactics") {
      const oppName = opponentName || match?.away_club_name;
      if (oppName && match?.home_club_id) {
        const { data: prep } = await supabase
          .from("match_preparations")
          .select("*")
          .eq("club_id", match.home_club_id)
          .eq("opponent_name", oppName)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        prepData = prep;
      }
    }

    const parseSection = (type: string) => {
      const s = (sections ?? []).find((s: any) => s.section_type === type);
      if (!s) return null;
      try { return JSON.parse(s.content); } catch { return s.content; }
    };

    const homeTeam = clubName || match?.home_club?.name || "Heim";
    const awayTeam = match?.away_club_name || "Gegner";
    const matchDate = match?.date ? new Date(match.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";

    // Build context for AI
    const dataContext = {
      match: { homeTeam, awayTeam, date: matchDate, kickoff: match?.kickoff, status: match?.status },
      matchRating: parseSection("match_rating"),
      tacticalGrades: parseSection("tactical_grades"),
      momentum: parseSection("momentum"),
      summary: parseSection("summary"),
      riskMatrix: parseSection("risk_matrix"),
      playerSpotlight: parseSection("player_spotlight"),
      opponentDna: parseSection("opponent_dna"),
      nextMatchActions: parseSection("next_match_actions"),
      coaching: parseSection("coaching"),
      trainingMicroCycle: parseSection("training_micro_cycle"),
      insights: (sections ?? []).filter((s: any) => s.section_type === "insight").map((s: any) => {
        try { return { title: s.title, ...JSON.parse(s.content) }; } catch { return { title: s.title, description: s.content }; }
      }),
      trainingRecommendations: trainingRecs ?? [],
      matchEvents: (matchEvents ?? []).map((e: any) => `Min ${e.minute}: ${e.event_type} (${e.team})${e.player_name ? ` — ${e.player_name}` : ""}`),
      teamStats: teamStats ?? [],
      playerStats: (playerStats ?? []).map((ps: any) => ({
        name: ps.players?.name ?? "Unbekannt",
        number: ps.players?.number,
        position: ps.players?.position,
        rating: ps.rating,
        distance_km: ps.distance_km,
        goals: ps.goals,
        assists: ps.assists,
        passes_completed: ps.passes_completed,
        passes_total: ps.passes_total,
        duels_won: ps.duels_won,
        duels_total: ps.duels_total,
        sprint_count: ps.sprint_count,
        minutes_played: ps.minutes_played,
      })),
      preparation: prepData?.preparation_data ?? null,
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI gateway not configured");

    const reportTypeLabels: Record<string, string> = {
      full_report: "Vollständiger Spielbericht",
      training_plan: "Trainingsplan",
      match_prep: "Spielvorbereitung & Gegner-Briefing",
      halftime_tactics: "Halbzeit-Taktik & Anpassungen",
    };

    const systemPrompt = `Du bist ein Elite-Fußball-Analyst. Erstelle ein DRUCKFERTIGES HTML-Dokument für den Report-Typ: "${reportTypeLabels[report_type] ?? report_type}".

Das HTML muss KOMPLETT und EIGENSTÄNDIG sein (alle CSS inline im <style> Tag).

LAYOUT-ANFORDERUNGEN (PROFESSIONELLER DRUCK):
- A4-Format mit @page { size: A4; margin: 20mm; }
- Professionelle Typografie: font-family: 'Segoe UI', system-ui, sans-serif
- Deckblatt: Vereinsname groß, Gegner, Datum, Report-Typ
- Seitenumbrüche: page-break-before: always; vor jeder Hauptsektion
- Farbakzente: #2563eb (Blau) als primäre Akzentfarbe, sparsam eingesetzt
- Tabellen: alternating rows (#f8fafc / weiß), dünne Rahmen (#e2e8f0)
- Balkendiagramme als CSS-Balken (div mit background-color und width in %)
- Notizbereich: Am Ende jeder Hauptsektion 5 gepunktete Linien mit Header "📝 Eigene Notizen"
- Footer auf jeder Seite: "Generiert mit FieldIQ • ${matchDate}" und Seitenzahl via CSS counter
- Überschriften: H1 28px bold, H2 20px bold mit blauer Unterstreichung, H3 16px semibold
- Body text: 12px, line-height 1.6
- Keine externen Ressourcen (Bilder, Fonts, Scripts)

REPORT-SPEZIFISCH:
${report_type === "full_report" ? `
VOLLSTÄNDIGER REPORT enthält:
1. Deckblatt
2. Inhaltsverzeichnis (mit Seitenzahlen-Platzhaltern)
3. Executive Summary (1 Seite)
4. Spielergebnis & Match-Rating (Gesamtnote + Sub-Scores als Balken)
5. Taktische Bewertung (Grades A-F als farbige Badges mit Begründung)
6. Momentum-Verlauf (als ASCII/CSS Timeline)
7. Coaching-Insights (nummerierte Liste mit Impact-Score)
8. Risiko-Matrix (Tabelle: Risiko, Schweregrad, Dringlichkeit)
9. Spieler-Spotlight (MVP & Sorgenspieler)
10. Spieler-Bewertungen (Tabelle aller Spieler mit Metriken)
11. Gegner-Analyse (DNA-Profil, Do/Don't)
12. Trainingsempfehlungen
13. Trainings-Mikrozyklus (3 Einheiten als strukturierte Karten)
14. Notizseite (ganzseitig liniert)
` : report_type === "training_plan" ? `
TRAININGSPLAN enthält:
1. Deckblatt
2. Übersicht: Erkannte Schwächen → Trainings-Ableitung
3. Trainings-Mikrozyklus (3 Sessions als detaillierte Karten mit Übungen, Dauer, Beschreibung)
4. Trainingsempfehlungen (priorisiert, mit verknüpftem Spielmuster)
5. Risiko-Faktoren die im Training adressiert werden
6. Notizseite
` : report_type === "match_prep" ? `
SPIELVORBEREITUNG enthält:
1. Deckblatt: "Vorbereitung: ${homeTeam} vs ${awayTeam}"
2. Gegner-Profil (Stärken, Schwächen, Spielstil)
3. Empfohlene Formation mit Begründung
4. Taktische Schwerpunkte (nummeriert, priorisiert)
5. Gegner-Warnungen (Severity: Hoch/Mittel/Gering als farbige Badges)
6. Aufstellungs-Empfehlungen
7. Standard-Situationen Plan
8. Do/Don't Liste (3 je)
9. Notizseite
` : `
HALBZEIT-TAKTIK enthält:
1. Sofort-Übersicht: Was lief gut / was nicht (Bullet Points)
2. Formations-Empfehlung für 2. HZ mit Begründung
3. Wechsel-Vorschläge (basierend auf Ermüdung & Performance)
4. 3 konkrete taktische Anpassungen
5. Gegner-Schwachstellen die ausgenutzt werden sollten
6. Notizbereich
`}

SPRACHE: Deutsch
FORMAT: Komplettes HTML-Dokument (<!DOCTYPE html> bis </html>)
WICHTIG: Gib NUR das HTML zurück, kein Markdown, keine Erklärung.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Erstelle den Report. Hier sind alle verfügbaren Daten:\n\n${JSON.stringify(dataContext, null, 2)}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI PDF error:", aiResponse.status, errText);
      throw new Error(aiResponse.status === 429 ? "Rate limit — bitte später erneut versuchen" : `AI-Fehler: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    let html = aiResult.choices?.[0]?.message?.content ?? "";

    // Strip markdown code fences if present
    html = html.replace(/^```html?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    if (!html.includes("<html") && !html.includes("<!DOCTYPE")) {
      throw new Error("AI hat kein gültiges HTML generiert");
    }

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-pdf-report error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
