import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helper: rating color ──
const ratingColor = (r: number | null) => {
  if (!r) return "#94a3b8";
  if (r >= 8) return "#16a34a";
  if (r >= 6.5) return "#2563eb";
  if (r >= 5) return "#ea580c";
  return "#dc2626";
};
const ratingBg = (r: number | null) => {
  if (!r) return "#f1f5f9";
  if (r >= 8) return "#dcfce7";
  if (r >= 6.5) return "#dbeafe";
  if (r >= 5) return "#fff7ed";
  return "#fef2f2";
};

// ── Helper: horizontal comparison bar ──
const compBar = (label: string, homeVal: number | string, awayVal: number | string, homeNum?: number, awayNum?: number) => {
  const hN = homeNum ?? parseFloat(String(homeVal)) || 0;
  const aN = awayNum ?? parseFloat(String(awayVal)) || 0;
  const total = hN + aN || 1;
  const hPct = Math.round((hN / total) * 100);
  const aPct = 100 - hPct;
  return `<div class="stat-row">
    <span class="stat-label">${label}</span>
    <span class="stat-val home">${homeVal}</span>
    <div class="stat-bar"><div class="bar-home" style="width:${hPct}%"></div><div class="bar-away" style="width:${aPct}%"></div></div>
    <span class="stat-val away">${awayVal}</span>
  </div>`;
};

// ── Helper: event icon ──
const eventIcon = (type: string) => {
  const map: Record<string, string> = {
    goal: "⚽", yellow_card: "🟨", red_card: "🟥", substitution: "🔄",
    shot_on_target: "🎯", shot_off_target: "💨", corner: "📐", foul: "⚠️",
    free_kick: "🔵", penalty: "⭐", offside: "🚩", save: "🧤",
  };
  return map[type] ?? "●";
};

// ── Helper: tactical grade badge ──
const gradeBadge = (grade: string, label: string) => {
  const colors: Record<string, string> = {
    "A+": "#16a34a", A: "#22c55e", "A-": "#4ade80",
    "B+": "#2563eb", B: "#3b82f6", "B-": "#60a5fa",
    "C+": "#ea580c", C: "#f97316", "C-": "#fb923c",
    D: "#dc2626", F: "#991b1b",
  };
  const c = colors[grade] ?? "#94a3b8";
  return `<div class="grade-item"><span class="grade-badge" style="background:${c}">${grade}</span><span class="grade-label">${label}</span></div>`;
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

    // ── Load all data in parallel ──
    const { data: match } = await supabase
      .from("matches")
      .select("*, fields(name), home_club:clubs!matches_home_club_id_fkey(name, logo_url)")
      .eq("id", match_id)
      .single();

    const [sectionsRes, trainingRecsRes, matchEventsRes, teamStatsRes, homePlayerStatsRes, awayPlayerStatsRes, lineupsRes] = await Promise.all([
      supabase.from("report_sections").select("*").eq("match_id", match_id).order("sort_order"),
      supabase.from("training_recommendations").select("*").eq("match_id", match_id).order("priority"),
      supabase.from("match_events").select("*").eq("match_id", match_id).order("minute"),
      supabase.from("team_match_stats").select("*").eq("match_id", match_id),
      supabase.from("player_match_stats").select("*, players(name, number, position)").eq("match_id", match_id).eq("team", "home").order("rating", { ascending: false }),
      supabase.from("player_match_stats").select("*, players(name, number, position)").eq("match_id", match_id).eq("team", "away").order("rating", { ascending: false }),
      supabase.from("match_lineups").select("*").eq("match_id", match_id).order("team").order("starting", { ascending: false }),
    ]);

    const sections = sectionsRes.data ?? [];
    const trainingRecs = trainingRecsRes.data ?? [];
    const matchEvents = matchEventsRes.data ?? [];
    const teamStats = teamStatsRes.data ?? [];
    const homePS = homePlayerStatsRes.data ?? [];
    const awayPS = awayPlayerStatsRes.data ?? [];
    const lineups = lineupsRes.data ?? [];

    // ── Prep data ──
    let prepData: any = null;
    if (report_type === "match_prep" || report_type === "halftime_tactics") {
      const oppName = opponentName || match?.away_club_name;
      if (oppName && match?.home_club_id) {
        const { data: prep } = await supabase.from("match_preparations").select("*")
          .eq("club_id", match.home_club_id).eq("opponent_name", oppName)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        prepData = prep;
      }
    }

    const parseSection = (type: string) => {
      const s = sections.find((s: any) => s.section_type === type);
      if (!s) return null;
      try { return JSON.parse(s.content); } catch { return s.content; }
    };

    const homeTeam = clubName || match?.home_club?.name || "Heim";
    const awayTeam = match?.away_club_name || "Gegner";
    const matchDate = match?.date ? new Date(match.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
    const homeScore = match?.home_score;
    const awayScore = match?.away_score;
    const scoreDisplay = homeScore != null && awayScore != null ? `${homeScore} : ${awayScore}` : "– : –";
    const homeStats = teamStats.find((s: any) => s.team === "home");
    const awayStats = teamStats.find((s: any) => s.team === "away");
    const matchRating = parseSection("match_rating");
    const tacticalGrades = parseSection("tactical_grades");
    const momentum = parseSection("momentum");
    const summary = parseSection("summary");
    const riskMatrix = parseSection("risk_matrix");
    const playerSpotlight = parseSection("player_spotlight");
    const opponentDna = parseSection("opponent_dna");
    const coaching = parseSection("coaching");
    const trainingMicro = parseSection("training_micro_cycle");
    const insights = sections.filter((s: any) => s.section_type === "insight").map((s: any) => {
      try { return { title: s.title, ...JSON.parse(s.content) }; } catch { return { title: s.title, description: s.content }; }
    });

    // ── AI call for analytical text only ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI gateway not configured");

    const compactData = {
      score: scoreDisplay, homeTeam, awayTeam, date: matchDate,
      homeFormation: match?.home_formation, awayFormation: match?.away_formation,
      summary, matchRating, tacticalGrades, coaching, momentum,
      riskMatrix, playerSpotlight, opponentDna, insights,
      events: matchEvents.slice(0, 30).map((e: any) => `${e.minute}' ${e.event_type} ${e.team} ${e.player_name ?? ""}`),
      homeTopPlayers: homePS.slice(0, 5).map((p: any) => `${p.players?.name ?? "?"} ${p.rating ?? "-"}`),
      trainingRecs: trainingRecs.slice(0, 5).map((t: any) => t.title),
      preparation: prepData?.preparation_data ?? null,
    };

    const reportTypeLabels: Record<string, string> = {
      full_report: "Vollständiger Spielbericht",
      training_plan: "Trainingsplan",
      match_prep: "Spielvorbereitung",
      halftime_tactics: "Halbzeit-Taktik",
    };

    const aiPrompt = `Du bist ein Elite-Fußball-Analyst. Erstelle NUR JSON (kein Markdown) mit folgenden Feldern für "${reportTypeLabels[report_type] ?? report_type}":

{
  "management_summary": "3-4 Sätze Gesamtbewertung",
  "key_takeaways": ["Takeaway 1","Takeaway 2","Takeaway 3"],
  "overall_grade": "Note 1-10 als Zahl",
  "coach_recommendation": "1 konkreter Satz für den Trainer",
  "home_strengths": ["Stärke 1","Stärke 2","Stärke 3","Stärke 4"],
  "home_weaknesses": ["Schwäche 1","Schwäche 2","Schwäche 3","Schwäche 4"],
  "opponent_strengths": ["Stärke 1","Stärke 2","Stärke 3"],
  "opponent_weaknesses": ["Schwäche 1","Schwäche 2","Schwäche 3"],
  "coaching_insights": [{"title":"...","description":"...","impact":8}],
  "tactical_adjustments": ["Anpassung 1","Anpassung 2","Anpassung 3"],
  "training_focus": [{"title":"...","description":"...","intensity":"hoch/mittel/gering","duration":"30-45 Min"}],
  "conclusion": "2-3 Sätze Fazit",
  "next_match_priorities": ["Priorität 1","Priorität 2","Priorität 3"],
  "opponent_profile": "2-3 Sätze Gegner-Spielstil",
  "dos": ["Do 1","Do 2","Do 3"],
  "donts": ["Don't 1","Don't 2","Don't 3"],
  "halftime_good": ["Positiv 1","Positiv 2"],
  "halftime_bad": ["Negativ 1","Negativ 2"],
  "sub_suggestions": ["Wechsel 1","Wechsel 2"]
}

Nutze die tatsächlichen Spieldaten. SPRACHE: Deutsch. NUR JSON.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: aiPrompt },
          { role: "user", content: JSON.stringify(compactData) },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(aiResponse.status === 429 ? "Rate limit — bitte später erneut versuchen" : aiResponse.status === 402 ? "Credits aufgebraucht" : `AI-Fehler: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    let aiText = aiResult.choices?.[0]?.message?.content ?? "{}";
    aiText = aiText.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let ai: any = {};
    try { ai = JSON.parse(aiText); } catch { console.error("AI JSON parse failed, using fallbacks"); }

    // ── Build HTML template ──
    const css = `
<style>
  @page { size: A4; margin: 16mm 18mm; }
  @media print { .page-break { page-break-before: always; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 11px; line-height: 1.5; color: #1e293b; background: #fff; }
  .page { padding: 0; min-height: 100%; }
  
  /* Cover */
  .cover { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 95vh; text-align: center; background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); color: #fff; border-radius: 0; }
  .cover-logo { width: 80px; height: 80px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; font-size: 32px; font-weight: 800; color: #2563eb; }
  .cover h1 { font-size: 22px; font-weight: 300; margin-bottom: 8px; letter-spacing: 2px; text-transform: uppercase; }
  .cover .score-big { font-size: 72px; font-weight: 800; margin: 16px 0; letter-spacing: 4px; }
  .cover .teams { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
  .cover .meta { font-size: 13px; opacity: 0.7; margin-top: 16px; }
  .cover .report-type { display: inline-block; padding: 6px 20px; border: 1px solid rgba(255,255,255,0.3); border-radius: 20px; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; margin-top: 20px; }
  
  /* Section headers */
  h2 { font-size: 18px; font-weight: 700; color: #0f172a; border-bottom: 3px solid #2563eb; padding-bottom: 6px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  h2 .sec-icon { font-size: 20px; }
  h3 { font-size: 14px; font-weight: 600; color: #334155; margin: 12px 0 6px; }
  
  /* Summary box */
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
  .summary-card.full { grid-column: 1 / -1; }
  .big-number { font-size: 48px; font-weight: 800; text-align: center; margin: 8px 0; }
  .takeaway { display: flex; gap: 8px; align-items: flex-start; margin: 6px 0; }
  .takeaway-num { flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
  
  /* Stat comparison bars */
  .stat-row { display: flex; align-items: center; gap: 6px; margin: 5px 0; }
  .stat-label { width: 110px; font-size: 10px; font-weight: 600; text-align: right; color: #64748b; }
  .stat-val { width: 45px; font-size: 11px; font-weight: 700; }
  .stat-val.home { text-align: right; color: #2563eb; }
  .stat-val.away { text-align: left; color: #dc2626; }
  .stat-bar { flex: 1; display: flex; height: 18px; border-radius: 4px; overflow: hidden; background: #f1f5f9; }
  .bar-home { background: linear-gradient(90deg, #3b82f6, #2563eb); transition: width 0.3s; }
  .bar-away { background: linear-gradient(90deg, #dc2626, #ef4444); transition: width 0.3s; }
  
  /* Player table */
  .player-table { width: 100%; border-collapse: collapse; font-size: 10px; margin: 8px 0; }
  .player-table th { background: #0f172a; color: #fff; padding: 6px 5px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
  .player-table td { padding: 5px; border-bottom: 1px solid #e2e8f0; }
  .player-table tr:nth-child(even) td { background: #f8fafc; }
  .player-table .rating-cell { display: inline-block; padding: 2px 8px; border-radius: 10px; font-weight: 700; font-size: 11px; min-width: 32px; text-align: center; }
  
  /* Event timeline */
  .timeline { position: relative; padding: 0 20px; }
  .timeline::before { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: #e2e8f0; }
  .event-row { display: flex; align-items: center; margin: 3px 0; position: relative; }
  .event-min { position: absolute; left: 50%; transform: translateX(-50%); background: #0f172a; color: #fff; padding: 1px 6px; border-radius: 8px; font-size: 9px; font-weight: 700; z-index: 1; }
  .event-home, .event-away { width: 45%; font-size: 10px; padding: 3px 8px; border-radius: 4px; }
  .event-home { text-align: right; margin-right: auto; background: #eff6ff; color: #1e40af; }
  .event-away { text-align: left; margin-left: auto; background: #fef2f2; color: #991b1b; }
  
  /* Grades */
  .grades-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 10px 0; }
  .grade-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .grade-badge { display: inline-block; padding: 4px 12px; border-radius: 6px; color: #fff; font-weight: 800; font-size: 16px; min-width: 40px; text-align: center; }
  .grade-label { font-size: 10px; color: #64748b; text-align: center; }
  
  /* SWOT */
  .swot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .swot-col { padding: 10px; border-radius: 8px; }
  .swot-col.strengths { background: #f0fdf4; border: 1px solid #bbf7d0; }
  .swot-col.weaknesses { background: #fef2f2; border: 1px solid #fecaca; }
  .swot-col h4 { font-size: 12px; margin-bottom: 6px; }
  .swot-item { display: flex; align-items: flex-start; gap: 6px; margin: 4px 0; font-size: 11px; }
  
  /* Insight cards */
  .insight-card { background: #f8fafc; border-left: 4px solid #2563eb; padding: 10px 12px; margin: 8px 0; border-radius: 0 6px 6px 0; }
  .insight-card .insight-title { font-weight: 700; font-size: 12px; margin-bottom: 2px; }
  .insight-card .insight-desc { font-size: 11px; color: #475569; }
  .insight-card .impact { float: right; background: #2563eb; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
  
  /* Risk matrix */
  .risk-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .risk-table th { background: #fef2f2; padding: 6px; text-align: left; font-weight: 600; border-bottom: 2px solid #fecaca; }
  .risk-table td { padding: 6px; border-bottom: 1px solid #f1f5f9; }
  .risk-high { color: #dc2626; font-weight: 700; }
  .risk-med { color: #ea580c; font-weight: 700; }
  .risk-low { color: #16a34a; font-weight: 700; }
  
  /* Training cards */
  .training-card { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 8px; padding: 12px; margin: 8px 0; }
  .training-card .tc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .training-card .tc-title { font-weight: 700; font-size: 13px; color: #0c4a6e; }
  .training-card .tc-meta { font-size: 10px; color: #0369a1; }
  
  /* Formation field */
  .field-container { background: linear-gradient(to bottom, #16a34a, #15803d); border-radius: 8px; padding: 12px; position: relative; min-height: 220px; margin: 8px 0; }
  .field-lines { border: 2px solid rgba(255,255,255,0.5); border-radius: 4px; height: 200px; position: relative; }
  .field-center { position: absolute; top: 50%; left: 0; right: 0; border-top: 1px solid rgba(255,255,255,0.4); }
  .field-circle { position: absolute; top: 50%; left: 50%; width: 60px; height: 60px; border: 1px solid rgba(255,255,255,0.4); border-radius: 50%; transform: translate(-50%, -50%); }
  .player-dot { position: absolute; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #fff; transform: translate(-50%, -50%); box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
  .player-dot.home { background: #2563eb; }
  .player-dot.away { background: #dc2626; }
  
  /* Momentum bar */
  .momentum-bar { display: flex; height: 24px; border-radius: 4px; overflow: hidden; margin: 8px 0; }
  .momentum-bar .seg { display: flex; align-items: center; justify-content: center; font-size: 9px; color: #fff; font-weight: 600; }
  
  /* Notes */
  .notes-area { margin-top: 16px; padding-top: 8px; border-top: 1px dashed #cbd5e1; }
  .note-line { border-bottom: 1px dotted #cbd5e1; height: 24px; margin: 2px 0; }
  .notes-label { font-size: 10px; color: #94a3b8; margin-bottom: 4px; }
  
  /* Footer */
  .page-footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 20px; padding-top: 8px; border-top: 1px solid #e2e8f0; }
  
  /* Do/Don't */
  .do-list, .dont-list { list-style: none; padding: 0; }
  .do-list li::before { content: "✅ "; }
  .dont-list li::before { content: "❌ "; }
  .do-list li, .dont-list li { margin: 4px 0; font-size: 11px; }
</style>`;

    // ── Build pages ──
    const pages: string[] = [];

    // 1. COVER PAGE
    const clubInitial = homeTeam.charAt(0).toUpperCase();
    pages.push(`<div class="cover">
      <div class="cover-logo">${clubInitial}</div>
      <h1>Spielanalyse-Report</h1>
      <div class="teams">${homeTeam} vs ${awayTeam}</div>
      <div class="score-big">${scoreDisplay}</div>
      <div class="meta">${matchDate}${match?.fields?.name ? ` • ${match.fields.name}` : ""}${match?.home_formation ? ` • Formation: ${match.home_formation}` : ""}</div>
      <div class="report-type">${reportTypeLabels[report_type] ?? report_type}</div>
    </div>`);

    if (report_type === "full_report" || report_type === "training_plan") {
      // 2. MANAGEMENT SUMMARY
      const overallGrade = ai.overall_grade ?? (matchRating?.overall ?? "–");
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">📊</span> Management Summary</h2>
        <div class="summary-grid">
          <div class="summary-card" style="text-align:center">
            <div style="font-size:11px;color:#64748b">ERGEBNIS</div>
            <div class="big-number">${scoreDisplay}</div>
          </div>
          <div class="summary-card" style="text-align:center">
            <div style="font-size:11px;color:#64748b">GESAMTNOTE</div>
            <div class="big-number" style="color:${ratingColor(Number(overallGrade))}">${overallGrade}</div>
          </div>
          <div class="summary-card full">
            <h3>Bewertung</h3>
            <p style="font-size:12px;line-height:1.6">${ai.management_summary ?? summary ?? "Keine Zusammenfassung verfügbar."}</p>
          </div>
          <div class="summary-card full">
            <h3>Key Takeaways</h3>
            ${(ai.key_takeaways ?? []).map((t: string, i: number) => `<div class="takeaway"><span class="takeaway-num">${i + 1}</span><span style="font-size:11px">${t}</span></div>`).join("")}
          </div>
          ${ai.coach_recommendation ? `<div class="summary-card full" style="background:#eff6ff;border-color:#bfdbfe">
            <h3>💡 Trainer-Empfehlung</h3>
            <p style="font-size:12px;font-weight:600">${ai.coach_recommendation}</p>
          </div>` : ""}
        </div>
        <div class="page-footer">Generiert mit FieldIQ • ${matchDate}</div>
      </div>`);

      // 3. FORMATION
      const homeLU = lineups.filter((l: any) => l.team === "home" && l.starting);
      const awayLU = lineups.filter((l: any) => l.team === "away" && l.starting);
      const subs = lineups.filter((l: any) => l.team === "home" && !l.starting);
      
      const positionMap = (formation: string | null, count: number) => {
        // Simple position mapping based on formation string like "4-3-3"
        const positions: Array<{x: number; y: number}> = [];
        const parts = (formation ?? "4-4-2").split("-").map(Number);
        // GK
        positions.push({ x: 50, y: 92 });
        let yLevels = [75, 50, 30, 12];
        let idx = 0;
        parts.forEach((n, lineIdx) => {
          const y = yLevels[lineIdx] ?? 20;
          for (let i = 0; i < n; i++) {
            const x = ((i + 1) / (n + 1)) * 100;
            positions.push({ x, y });
            idx++;
          }
        });
        return positions.slice(0, count);
      };

      const homePositions = positionMap(match?.home_formation, homeLU.length);
      const playerDots = homeLU.map((p: any, i: number) => {
        const pos = homePositions[i] ?? { x: 50, y: 50 };
        return `<div class="player-dot home" style="left:${pos.x}%;top:${pos.y}%" title="${p.player_name}">${p.shirt_number ?? ""}</div>`;
      }).join("");

      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">👥</span> Mannschaftsaufstellung</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <h3>${homeTeam} ${match?.home_formation ? `(${match.home_formation})` : ""}</h3>
            <div class="field-container">
              <div class="field-lines">
                <div class="field-center"></div>
                <div class="field-circle"></div>
                ${playerDots}
              </div>
            </div>
            ${subs.length ? `<h3 style="margin-top:8px">Ersatzbank</h3><div style="font-size:10px;color:#64748b">${subs.map((s: any) => `${s.shirt_number ?? "?"} ${s.player_name}`).join(" • ")}</div>` : ""}
          </div>
          <div>
            <h3>${awayTeam} ${match?.away_formation ? `(${match.away_formation})` : ""}</h3>
            ${awayLU.length ? `<div style="font-size:11px">${awayLU.map((p: any) => `<div style="margin:3px 0">
              <span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:#dc2626;color:#fff;text-align:center;line-height:28px;font-size:10px;font-weight:700;margin-right:6px">${p.shirt_number ?? ""}</span>${p.player_name}
            </div>`).join("")}</div>` : `<p style="color:#94a3b8;font-size:11px">Keine Daten</p>`}
          </div>
        </div>
        <div class="page-footer">Generiert mit FieldIQ • ${matchDate}</div>
      </div>`);

      // 4. TEAM STATS COMPARISON
      const hPoss = homeStats?.possession_pct ?? 50;
      const aPoss = awayStats?.possession_pct ?? 50;
      const hDist = homeStats?.total_distance_km?.toFixed(1) ?? "–";
      const aDist = awayStats?.total_distance_km?.toFixed(1) ?? "–";
      const hSpeed = homeStats?.top_speed_kmh?.toFixed(1) ?? "–";
      const aSpeed = awayStats?.top_speed_kmh?.toFixed(1) ?? "–";
      // Aggregate from player stats
      const sumStat = (arr: any[], key: string) => arr.reduce((s, p) => s + (p[key] ?? 0), 0);
      const hGoals = sumStat(homePS, "goals");
      const aGoals = sumStat(awayPS, "goals");
      const hShots = sumStat(homePS, "shots_total");
      const aShots = sumStat(awayPS, "shots_total");
      const hSOT = sumStat(homePS, "shots_on_target");
      const aSOT = sumStat(awayPS, "shots_on_target");
      const hPasses = sumStat(homePS, "passes_completed");
      const aPasses = sumStat(awayPS, "passes_completed");
      const hPassT = sumStat(homePS, "passes_total");
      const aPassT = sumStat(awayPS, "passes_total");
      const hDuelsW = sumStat(homePS, "duels_won");
      const aDuelsW = sumStat(awayPS, "duels_won");
      const hDuelsT = sumStat(homePS, "duels_total");
      const aDuelsT = sumStat(awayPS, "duels_total");
      const hFouls = sumStat(homePS, "fouls_committed");
      const aFouls = sumStat(awayPS, "fouls_committed");
      const hSprints = sumStat(homePS, "sprint_count");
      const aSprints = sumStat(awayPS, "sprint_count");
      const hPassAcc = hPassT ? Math.round((hPasses / hPassT) * 100) : 0;
      const aPassAcc = aPassT ? Math.round((aPasses / aPassT) * 100) : 0;

      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">📈</span> Team-Statistiken</h2>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-weight:700;color:#2563eb">${homeTeam}</span>
          <span style="font-weight:700;color:#dc2626">${awayTeam}</span>
        </div>
        ${compBar("Ballbesitz", `${hPoss}%`, `${aPoss}%`, hPoss, aPoss)}
        ${compBar("Tore", hGoals, aGoals)}
        ${compBar("Schüsse", hShots, aShots)}
        ${compBar("Aufs Tor", hSOT, aSOT)}
        ${compBar("Pässe", hPasses, aPasses)}
        ${compBar("Passquote", `${hPassAcc}%`, `${aPassAcc}%`, hPassAcc, aPassAcc)}
        ${compBar("Zweikämpfe gew.", hDuelsW, aDuelsW)}
        ${compBar("Fouls", hFouls, aFouls)}
        ${compBar("Sprints", hSprints, aSprints)}
        ${compBar("Distanz (km)", hDist, aDist, parseFloat(hDist) || 0, parseFloat(aDist) || 0)}
        ${compBar("Top-Speed", hSpeed, aSpeed, parseFloat(hSpeed) || 0, parseFloat(aSpeed) || 0)}
        <div class="page-footer">Generiert mit FieldIQ • ${matchDate}</div>
      </div>`);

      // 5. TACTICAL GRADES
      const tg = tacticalGrades ?? {};
      const dimensions = [
        ["pressing", "Pressing"], ["build_up", "Spielaufbau"], ["defense", "Defensive"],
        ["transitions", "Umschaltspiel"], ["set_pieces", "Standards"], ["space_control", "Raumkontrolle"]
      ];
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">🎯</span> Taktische Bewertung</h2>
        <div class="grades-grid">
          ${dimensions.map(([key, label]) => gradeBadge(tg[key]?.grade ?? tg[key] ?? "–", label)).join("")}
        </div>
        ${tg.summary ? `<div class="summary-card full" style="margin-top:12px"><p style="font-size:11px">${tg.summary}</p></div>` : ""}
        <div class="notes-area"><div class="notes-label">📝 Eigene Notizen</div>${"<div class='note-line'></div>".repeat(6)}</div>
        <div class="page-footer">Generiert mit FieldIQ • ${matchDate}</div>
      </div>`);

      // 6. EVENT TIMELINE
      if (matchEvents.length) {
        const eventRows = matchEvents.map((e: any) => {
          const icon = eventIcon(e.event_type);
          const text = `${icon} ${e.event_type.replace(/_/g, " ")}${e.player_name ? ` — ${e.player_name}` : ""}`;
          const isHome = e.team === "home";
          return `<div class="event-row">
            ${isHome ? `<div class="event-home">${text}</div>` : "<div></div>"}
            <span class="event-min">${e.minute}'</span>
            ${!isHome ? `<div class="event-away">${text}</div>` : "<div></div>"}
          </div>`;
        }).join("");

        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">⏱️</span> Event-Chronik</h2>
          <div class="timeline">${eventRows}</div>
          <div class="page-footer">Generiert mit FieldIQ • ${matchDate}</div>
        </div>`);
      }

      // 7. SWOT
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">💪</span> Stärken & Schwächen — ${homeTeam}</h2>
        <div class="swot-grid">
          <div class="swot-col strengths">
            <h4>✅ Stärken</h4>
            ${(ai.home_strengths ?? ["Daten werden geladen..."]).map((s: string) => `<div class="swot-item"><span>${s}</span></div>`).join("")}
          </div>
          <div class="swot-col weaknesses">
            <h4>⚠️ Schwächen</h4>
            ${(ai.home_weaknesses ?? ["Daten werden geladen..."]).map((s: string) => `<div class="swot-item"><span>${s}</span></div>`).join("")}
          </div>
        </div>
        <h2 style="margin-top:20px"><span class="sec-icon">🔍</span> Stärken & Schwächen — ${awayTeam}</h2>
        ${ai.opponent_profile ? `<p style="font-size:11px;margin-bottom:8px;color:#475569">${ai.opponent_profile}</p>` : ""}
        <div class="swot-grid">
          <div class="swot-col strengths">
            <h4>✅ Stärken</h4>
            ${(ai.opponent_strengths ?? []).map((s: string) => `<div class="swot-item"><span>${s}</span></div>`).join("")}
          </div>
          <div class="swot-col weaknesses">
            <h4>⚠️ Schwächen</h4>
            ${(ai.opponent_weaknesses ?? []).map((s: string) => `<div class="swot-item"><span>${s}</span></div>`).join("")}
          </div>
        </div>
        <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="background:#f0fdf4;padding:10px;border-radius:6px"><h4>✅ Do's</h4><ul class="do-list">${(ai.dos ?? []).map((d: string) => `<li>${d}</li>`).join("")}</ul></div>
          <div style="background:#fef2f2;padding:10px;border-radius:6px"><h4>❌ Don'ts</h4><ul class="dont-list">${(ai.donts ?? []).map((d: string) => `<li>${d}</li>`).join("")}</ul></div>
        </div>
        <div class="page-footer">Generiert mit FieldIQ • ${matchDate}</div>
      </div>`);

      // 8. COACHING INSIGHTS
      const insightData = ai.coaching_insights ?? insights ?? [];
      if (insightData.length) {
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">🧠</span> Coaching-Insights</h2>
          ${insightData.map((ins: any, i: number) => `<div class="insight-card">
            ${ins.impact ? `<span class="impact">Impact: ${ins.impact}/10</span>` : ""}
            <div class="insight-title">${i + 1}. ${ins.title ?? "Insight"}</div>
            <div class="insight-desc">${ins.description ?? ""}</div>
          </div>`).join("")}
          <div class="notes-area"><div class="notes-label">📝 Eigene Notizen</div>${"<div class='note-line'></div>".repeat(5)}</div>
          <div class="page-footer">Generiert mit FieldIQ • ${matchDate}</div>
        </div>`);
      }

      // 9. PLAYER RATINGS — HOME
      if (homePS.length) {
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">⭐</span> Spieler-Bewertungen — ${homeTeam}</h2>
          <table class="player-table">
            <tr><th>#</th><th>Name</th><th>Pos</th><th>Note</th><th>km</th><th>⚽</th><th>🅰️</th><th>Pässe</th><th>Zweik.</th><th>Sprints</th><th>Top km/h</th></tr>
            ${homePS.map((p: any) => `<tr>
              <td>${p.players?.number ?? "–"}</td>
              <td style="font-weight:600">${p.players?.name ?? "?"}</td>
              <td>${p.players?.position ?? "–"}</td>
              <td><span class="rating-cell" style="background:${ratingBg(p.rating)};color:${ratingColor(p.rating)}">${p.rating?.toFixed(1) ?? "–"}</span></td>
              <td>${p.distance_km?.toFixed(1) ?? "–"}</td>
              <td>${p.goals ?? 0}</td>
              <td>${p.assists ?? 0}</td>
              <td>${p.passes_completed ?? 0}/${p.passes_total ?? 0}</td>
              <td>${p.duels_won ?? 0}/${p.duels_total ?? 0}</td>
              <td>${p.sprint_count ?? 0}</td>
              <td>${p.top_speed_kmh?.toFixed(1) ?? "–"}</td>
            </tr>`).join("")}
          </table>
          <div class="page-footer">Generiert mit FieldIQ • ${matchDate}</div>
        </div>`);
      }

      // 10. PLAYER RATINGS — AWAY
      if (awayPS.length) {
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">⭐</span> Spieler-Bewertungen — ${awayTeam}</h2>
          <table class="player-table">
            <tr><th>#</th><th>Name</th><th>Pos</th><th>Note</th><th>km</th><th>⚽</th><th>🅰️</th><th>Pässe</th><th>Zweik.</th><th>Sprints</th><th>Top km/h</th></tr>
            ${awayPS.map((p: any) => `<tr>
              <td>${p.players?.number ?? "–"}</td>
              <td style="font-weight:600">${p.players?.name ?? "?"}</td>
              <td>${p.players?.position ?? "–"}</td>
              <td><span class="rating-cell" style="background:${ratingBg(p.rating)};color:${ratingColor(p.rating)}">${p.rating?.toFixed(1) ?? "–"}</span></td>
              <td>${p.distance_km?.toFixed(1) ?? "–"}</td>
              <td>${p.goals ?? 0}</td>
              <td>${p.assists ?? 0}</td>
              <td>${p.passes_completed ?? 0}/${p.passes_total ?? 0}</td>
              <td>${p.duels_won ?? 0}/${p.duels_total ?? 0}</td>
              <td>${p.sprint_count ?? 0}</td>
              <td>${p.top_speed_kmh?.toFixed(1) ?? "–"}</td>
            </tr>`).join("")}
          </table>
          <div class="page-footer">Generiert mit FieldIQ • ${matchDate}</div>
        </div>`);
      }

      // 11. TRAINING RECOMMENDATIONS
      const trainData = ai.training_focus ?? trainingRecs ?? [];
      if (trainData.length || (trainingMicro && Array.isArray(trainingMicro))) {
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">🏋️</span> Trainingsempfehlungen</h2>
          ${trainData.map((t: any) => `<div class="training-card">
            <div class="tc-header">
              <span class="tc-title">${t.title ?? "Training"}</span>
              <span class="tc-meta">${t.intensity ?? ""} ${t.duration ? `• ${t.duration}` : ""}</span>
            </div>
            <p style="font-size:11px;color:#334155">${t.description ?? ""}</p>
          </div>`).join("")}
          ${trainingMicro && Array.isArray(trainingMicro) ? `<h3 style="margin-top:12px">Mikrozyklus</h3>${trainingMicro.map((s: any, i: number) => `<div class="training-card">
            <div class="tc-header"><span class="tc-title">Session ${i + 1}: ${s.theme ?? s.title ?? ""}</span><span class="tc-meta">${s.duration ?? ""} • ${s.intensity ?? ""}</span></div>
            ${Array.isArray(s.exercises) ? s.exercises.map((ex: any) => `<p style="font-size:10px;margin:2px 0">• ${typeof ex === "string" ? ex : ex.name ?? ex.title ?? ""}</p>`).join("") : ""}
          </div>`).join("") : ""}
          <div class="notes-area"><div class="notes-label">📝 Eigene Notizen</div>${"<div class='note-line'></div>".repeat(5)}</div>
          <div class="page-footer">Generiert mit FieldIQ • ${matchDate}</div>
        </div>`);
      }

      // 12. CONCLUSION + NOTES
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">🏁</span> Fazit & Ausblick</h2>
        <div class="summary-card full" style="margin-bottom:12px">
          <p style="font-size:12px;line-height:1.7">${ai.conclusion ?? "Analyse abgeschlossen."}</p>
        </div>
        <h3>Prioritäten für das nächste Spiel</h3>
        ${(ai.next_match_priorities ?? []).map((p: string, i: number) => `<div class="takeaway"><span class="takeaway-num">${i + 1}</span><span style="font-size:12px;font-weight:600">${p}</span></div>`).join("")}
        <div class="notes-area" style="margin-top:24px"><div class="notes-label">📝 Eigene Notizen</div>${"<div class='note-line'></div>".repeat(12)}</div>
        <div class="page-footer">Generiert mit FieldIQ • ${matchDate}</div>
      </div>`);
    }

    // ── MATCH PREP report ──
    if (report_type === "match_prep") {
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">🔍</span> Gegner-Profil: ${awayTeam}</h2>
        ${ai.opponent_profile ? `<div class="summary-card full"><p style="font-size:12px">${ai.opponent_profile}</p></div>` : ""}
        <div class="swot-grid" style="margin-top:12px">
          <div class="swot-col strengths"><h4>✅ Stärken</h4>${(ai.opponent_strengths ?? []).map((s: string) => `<div class="swot-item">${s}</div>`).join("")}</div>
          <div class="swot-col weaknesses"><h4>⚠️ Schwächen</h4>${(ai.opponent_weaknesses ?? []).map((s: string) => `<div class="swot-item">${s}</div>`).join("")}</div>
        </div>
        <h3 style="margin-top:16px">Taktische Anpassungen</h3>
        ${(ai.tactical_adjustments ?? []).map((a: string, i: number) => `<div class="takeaway"><span class="takeaway-num">${i + 1}</span><span style="font-size:11px">${a}</span></div>`).join("")}
        <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="background:#f0fdf4;padding:10px;border-radius:6px"><h4>✅ Do's</h4><ul class="do-list">${(ai.dos ?? []).map((d: string) => `<li>${d}</li>`).join("")}</ul></div>
          <div style="background:#fef2f2;padding:10px;border-radius:6px"><h4>❌ Don'ts</h4><ul class="dont-list">${(ai.donts ?? []).map((d: string) => `<li>${d}</li>`).join("")}</ul></div>
        </div>
        <div class="notes-area"><div class="notes-label">📝 Eigene Notizen</div>${"<div class='note-line'></div>".repeat(8)}</div>
        <div class="page-footer">Generiert mit FieldIQ • ${matchDate}</div>
      </div>`);
    }

    // ── HALFTIME TACTICS ──
    if (report_type === "halftime_tactics") {
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">⚡</span> Halbzeit-Analyse</h2>
        <div class="swot-grid">
          <div class="swot-col strengths"><h4>✅ Was lief gut</h4>${(ai.halftime_good ?? []).map((s: string) => `<div class="swot-item">${s}</div>`).join("")}</div>
          <div class="swot-col weaknesses"><h4>⚠️ Was nicht lief</h4>${(ai.halftime_bad ?? []).map((s: string) => `<div class="swot-item">${s}</div>`).join("")}</div>
        </div>
        <h3 style="margin-top:16px">Taktische Anpassungen 2. Halbzeit</h3>
        ${(ai.tactical_adjustments ?? []).map((a: string, i: number) => `<div class="takeaway"><span class="takeaway-num">${i + 1}</span><span style="font-size:11px">${a}</span></div>`).join("")}
        ${(ai.sub_suggestions ?? []).length ? `<h3 style="margin-top:12px">Wechsel-Vorschläge</h3>${ai.sub_suggestions.map((s: string) => `<div class="insight-card"><div class="insight-desc">${s}</div></div>`).join("")}` : ""}
        <div class="notes-area"><div class="notes-label">📝 Eigene Notizen</div>${"<div class='note-line'></div>".repeat(8)}</div>
        <div class="page-footer">Generiert mit FieldIQ • ${matchDate}</div>
      </div>`);
    }

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${homeTeam} vs ${awayTeam} – ${reportTypeLabels[report_type] ?? "Report"}</title>${css}</head><body>${pages.join("")}</body></html>`;

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
