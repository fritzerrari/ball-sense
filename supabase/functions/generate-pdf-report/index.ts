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

    // Load all data in parallel
    const [sectionsRes, trainingRecsRes, matchEventsRes, teamStatsRes, homePlayerStatsRes, awayPlayerStatsRes, lineupsRes] = await Promise.all([
      supabase.from("report_sections").select("*").eq("match_id", match_id).order("sort_order"),
      supabase.from("training_recommendations").select("*").eq("match_id", match_id).order("priority"),
      supabase.from("match_events").select("*").eq("match_id", match_id).order("minute"),
      supabase.from("team_match_stats").select("*").eq("match_id", match_id),
      supabase.from("player_match_stats").select("*, players(name, number, position)").eq("match_id", match_id).eq("team", "home").order("rating", { ascending: false }),
      supabase.from("player_match_stats").select("*, players(name, number, position)").eq("match_id", match_id).eq("team", "away").order("rating", { ascending: false }),
      supabase.from("match_lineups").select("*").eq("match_id", match_id).order("team").order("starting", { ascending: false }),
    ]);

    const sections = sectionsRes.data;
    const trainingRecs = trainingRecsRes.data;
    const matchEvents = matchEventsRes.data;
    const teamStats = teamStatsRes.data;
    const playerStats = homePlayerStatsRes.data;
    const awayPlayerStats = awayPlayerStatsRes.data;
    const lineups = lineupsRes.data;

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
    const homeScore = match?.home_score;
    const awayScore = match?.away_score;
    const scoreDisplay = homeScore != null && awayScore != null ? `${homeScore} : ${awayScore}` : "– : –";

    const formatPlayerStats = (stats: any[]) => (stats ?? []).map((ps: any) => ({
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
      top_speed_kmh: ps.top_speed_kmh,
      shots_total: ps.shots_total,
      shots_on_target: ps.shots_on_target,
      tackles: ps.tackles,
      interceptions: ps.interceptions,
      yellow_cards: ps.yellow_cards,
      red_cards: ps.red_cards,
    }));

    const formatLineups = (team: string) => (lineups ?? []).filter((l: any) => l.team === team).map((l: any) => ({
      name: l.player_name,
      number: l.shirt_number,
      starting: l.starting,
      subbed_in_min: l.subbed_in_min,
      subbed_out_min: l.subbed_out_min,
    }));

    // Build context for AI
    const dataContext = {
      match: { homeTeam, awayTeam, date: matchDate, kickoff: match?.kickoff, status: match?.status, score: scoreDisplay, homeScore, awayScore, homeFormation: match?.home_formation, awayFormation: match?.away_formation },
      homeLineup: formatLineups("home"),
      awayLineup: formatLineups("away"),
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
      homePlayerStats: formatPlayerStats(playerStats ?? []),
      awayPlayerStats: formatPlayerStats(awayPlayerStats ?? []),
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

    const cssChartsGuide = `
CSS-CHART-ANWEISUNGEN (PFLICHT für visuelle Elemente):

1. FORMATIONS-GRAFIK:
   - CSS-Grid mit 4 horizontalen Linien (Sturm oben, TW unten)
   - Jeder Spieler als farbiger Kreis (50px, border-radius:50%) mit Rückennummer innen
   - Heim: Hintergrund #2563eb (Blau), Gegner: Hintergrund #dc2626 (Rot)
   - Position relativ auf dem "Feld" (grüner Hintergrund #16a34a mit weißen Linien)
   - Banksspieler in einer separaten Reihe darunter, kleiner (35px)

2. HORIZONTALE BALKENDIAGRAMME:
   - Für jeden Vergleichswert (Ballbesitz, Pässe, Schüsse, Zweikämpfe):
     <div style="display:flex;align-items:center;gap:8px;margin:4px 0">
       <span style="width:60px;text-align:right;font-size:12px">[Heim-Wert]</span>
       <div style="flex:1;display:flex;height:20px;border-radius:4px;overflow:hidden">
         <div style="width:[Heim%];background:#2563eb"></div>
         <div style="width:[Gast%];background:#dc2626"></div>
       </div>
       <span style="width:60px;font-size:12px">[Gast-Wert]</span>
     </div>
   - Label über jedem Balken

3. EVENT-TIMELINE (vertikal):
   - Vertikale Linie in der Mitte
   - Events links (Heim, blau) und rechts (Gegner, rot) mit Minuten-Label
   - Farbige Dots: ⚽ grün für Tore, 🟨 gelb für Karten, 🔴 rot für Rote Karten
   - Schüsse als kleine graue Dots

4. MOMENTUM-VERLAUF:
   - Horizontale Timeline (0' bis 90')
   - Farbige Segmente: Grün = Heim dominiert, Rot = Gegner dominiert, Grau = ausgeglichen
   - Event-Marker als kleine Dreiecke über der Timeline

5. SPIELER-BEWERTUNGSTABELLE:
   - Alternating rows (#f8fafc / weiß)
   - Rating als farbiger Badge: ≥8 grün, ≥6.5 blau, ≥5 orange, <5 rot
   - Distanz-Spalte mit Mini-Balken dahinter
   - Passquote als Prozentzahl mit farbigem Hintergrund

6. STÄRKEN/SCHWÄCHEN-MATRIX:
   - Zweispaltige Tabelle mit ✅ (Stärke, grüner Hintergrund) und ⚠️ (Schwäche, roter Hintergrund)
   - Für beide Teams separat

7. RISIKO-RADAR:
   - Tabelle mit 3 Spalten: Risiko, Schweregrad (🔴🟡🟢), Dringlichkeit
   - Farbcodierte Zeilen basierend auf Schweregrad`;

    const fullReportSections = `
DER VOLLSTÄNDIGE REPORT MUSS EXAKT DIESE 20 SEKTIONEN ENTHALTEN:

1. **DECKBLATT** (eigene Seite)
   - Vereinsname groß (32px), Ergebnis "${scoreDisplay}" riesig (60px, fett), Gegner, Datum, "Spielanalyse-Report"
   
2. **INHALTSVERZEICHNIS** (eigene Seite)
   - Alle 18 Sektionen mit Titeln

3. **MANAGEMENT SUMMARY** (eigene Seite)
   - Ergebnis-Box (groß, zentriert)
   - 3 Key-Takeaways als nummerierte Punkte
   - Gesamtnote als großer farbiger Badge
   - 1-Satz-Empfehlung für den Trainer
   - 📝 Notizbereich (5 gepunktete Linien)

4. **MANNSCHAFTSAUFSTELLUNG** (eigene Seite)
   - Heim-Formation als CSS-Feld-Grafik (siehe CSS-CHART #1)
   - Startelf + Auswechselspieler als Liste
   - Gegner-Aufstellung (falls Daten vorhanden) daneben oder darunter
   
5. **SPIELERGEBNIS & MATCH-RATING** (eigene Seite)
   - Großes Ergebnis-Display
   - Gesamtnote + 5-6 Sub-Scores als horizontale Balken
   - 📝 Notizbereich

6. **TEAM-STATISTIKEN VERGLEICH** (eigene Seite)
   - Horizontale Balkendiagramme (CSS-CHART #2) für:
     Ballbesitz, Pässe gesamt, Passgenauigkeit, Schüsse, Schüsse aufs Tor, Ecken, Fouls, Zweikampfquote, Laufdistanz, Top-Speed
   - 📝 Notizbereich

7. **TAKTISCHE BEWERTUNG** (eigene Seite)
   - 6 Dimensionen als farbige Badges (A+ bis F):
     Pressing, Spielaufbau, Defensive, Umschaltspiel, Standards, Raumkontrolle
   - Kurze Begründung pro Dimension
   - 📝 Notizbereich

8. **MOMENTUM-TIMELINE** (eigene Seite)
   - CSS-basierter Momentum-Verlauf (CSS-CHART #4)
   - Beschreibung der dominanten Phasen
   - 📝 Notizbereich

9. **EVENT-CHRONIK** (eigene Seite)
   - Vertikale Timeline (CSS-CHART #3) mit allen Events
   - Farbcodiert nach Team und Event-Typ
   - 📝 Notizbereich

10. **CHANCEN-ANALYSE** (eigene Seite)
    - Schüsse gesamt vs. aufs Tor als Balken pro Team
    - Chancenverwertung in Prozent
    - Torgefährlichste Phase (Minutenbereich)
    - 📝 Notizbereich

11. **STÄRKEN & SCHWÄCHEN — HEIM** (eigene Seite)
    - Matrix mit ✅/⚠️ (CSS-CHART #6)
    - Mindestens 4 Stärken, 4 Schwächen
    - Handlungsempfehlung pro Schwäche
    - 📝 Notizbereich

12. **STÄRKEN & SCHWÄCHEN — GEGNER** (eigene Seite)
    - Gegner-DNA / Spielstil-Fingerabdruck
    - Stärken/Schwächen-Matrix
    - Do (3) / Don't (3) Liste
    - 📝 Notizbereich

13. **COACHING-INSIGHTS** (eigene Seite)
    - Nummerierte Liste (mindestens 5)
    - Jeder Insight: Titel, Beschreibung, Impact-Score (1-10)
    - Priorisiert nach Impact
    - 📝 Notizbereich

14. **RISIKO-MATRIX** (eigene Seite)
    - Tabelle (CSS-CHART #7) mit mindestens 5 Risiken
    - Farbcodierte Zeilen
    - 📝 Notizbereich

15. **SPIELER-SPOTLIGHT** (eigene Seite)
    - MVP: Foto-Platzhalter, Name, Rating, 3 Highlight-Metriken
    - Sorgenspieler: Name, Rating, Begründung
    - 📝 Notizbereich

16. **SPIELER-BEWERTUNGEN HEIM** (eigene Seite)
    - Komplette Tabelle (CSS-CHART #5) ALLER Heim-Spieler
    - Spalten: #, Name, Pos, Note, Distanz, Tore, Assists, Pässe, Zweikämpfe, Sprints

17. **SPIELER-BEWERTUNGEN GEGNER** (eigene Seite, falls Daten vorhanden)
    - Gleiche Tabelle für Gegner-Spieler

18. **TRAININGSEMPFEHLUNGEN** (eigene Seite)
    - Priorisierte Liste mit Bezug zu erkannten Schwächen
    - Jede Empfehlung: Titel, Begründung, Intensität, Dauer
    - 📝 Notizbereich

19. **TRAININGS-MIKROZYKLUS** (eigene Seite)
    - 3 Trainingseinheiten als strukturierte Karten
    - Pro Session: Thema, Dauer, Intensität, 3-4 Übungen mit Beschreibung
    - 📝 Notizbereich

20. **FAZIT & AUSBLICK + NOTIZSEITEN** (letzte 2 Seiten)
    - Zusammenfassung (3 Sätze)
    - 3 Prioritäten fürs nächste Spiel
    - 2 ganzseitig linierte Notizseiten`;

    const systemPrompt = `Du bist ein Elite-Fußball-Analyst. Erstelle ein DRUCKFERTIGES HTML-Dokument für den Report-Typ: "${reportTypeLabels[report_type] ?? report_type}".

Das HTML muss KOMPLETT und EIGENSTÄNDIG sein (alle CSS inline im <style> Tag).

LAYOUT-ANFORDERUNGEN (PROFESSIONELLER DRUCK):
- A4-Format mit @page { size: A4; margin: 18mm; }
- Professionelle Typografie: font-family: 'Segoe UI', system-ui, sans-serif
- Seitenumbrüche: page-break-before: always; vor jeder Hauptsektion
- Primärfarbe: #2563eb (Blau), Sekundär: #dc2626 (Rot für Gegner)
- Tabellen: alternating rows (#f8fafc / weiß), dünne Rahmen (#e2e8f0)
- Notizbereich: Am Ende relevanter Sektionen 5 gepunktete Linien mit "📝 Eigene Notizen"
- Footer auf jeder Seite: "Generiert mit FieldIQ • ${matchDate}" via CSS @bottom-center
- Überschriften: H1 28px bold, H2 22px bold mit blauer Unterstreichung (border-bottom: 3px solid #2563eb), H3 16px semibold
- Body text: 12px, line-height 1.6
- Keine externen Ressourcen (Bilder, Fonts, Scripts)

${cssChartsGuide}

REPORT-SPEZIFISCH:
${report_type === "full_report" ? fullReportSections : report_type === "training_plan" ? `
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
3. Empfohlene Formation mit CSS-Grafik und Begründung
4. Taktische Schwerpunkte (nummeriert, priorisiert)
5. Gegner-Warnungen (Severity: Hoch/Mittel/Gering als farbige Badges)
6. Aufstellungs-Empfehlungen
7. Standard-Situationen Plan
8. Do/Don't Liste (3 je)
9. Notizseite
` : `
HALBZEIT-TAKTIK enthält:
1. Sofort-Übersicht: Was lief gut / was nicht (Bullet Points)
2. Formations-Empfehlung für 2. HZ als CSS-Grafik mit Begründung
3. Wechsel-Vorschläge (basierend auf Ermüdung & Performance)
4. 3 konkrete taktische Anpassungen
5. Gegner-Schwachstellen die ausgenutzt werden sollten
6. Notizbereich
`}

SPRACHE: Deutsch
FORMAT: Komplettes HTML-Dokument (<!DOCTYPE html> bis </html>)
WICHTIG: Gib NUR das HTML zurück, kein Markdown, keine Erklärung. NUTZE die CSS-CHART-Anweisungen für ALLE visuellen Elemente.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Erstelle den Report. Hier sind alle verfügbaren Daten:\n\n${JSON.stringify(dataContext, null, 2)}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI PDF error:", aiResponse.status, errText);
      throw new Error(aiResponse.status === 429 ? "Rate limit — bitte später erneut versuchen" : aiResponse.status === 402 ? "Credits aufgebraucht — bitte Guthaben aufladen" : `AI-Fehler: ${aiResponse.status}`);
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
