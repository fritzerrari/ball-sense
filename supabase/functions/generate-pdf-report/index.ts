import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ──
const rc = (r: number | null) => { if (!r) return "#94a3b8"; if (r >= 8) return "#16a34a"; if (r >= 6.5) return "#2563eb"; if (r >= 5) return "#ea580c"; return "#dc2626"; };
const rbg = (r: number | null) => { if (!r) return "#f1f5f9"; if (r >= 8) return "#dcfce7"; if (r >= 6.5) return "#dbeafe"; if (r >= 5) return "#fff7ed"; return "#fef2f2"; };

const compBar = (label: string, hv: number | string, av: number | string, hN?: number, aN?: number) => {
  const h = hN ?? (parseFloat(String(hv)) || 0), a = aN ?? (parseFloat(String(av)) || 0);
  const t = h + a || 1, hp = Math.round((h / t) * 100);
  return `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-val home">${hv}</span><div class="stat-bar"><div class="bar-home" style="width:${hp}%"></div><div class="bar-away" style="width:${100 - hp}%"></div></div><span class="stat-val away">${av}</span></div>`;
};

const eIcon = (t: string) => ({ goal: "⚽", yellow_card: "🟨", red_card: "🟥", substitution: "🔄", shot_on_target: "🎯", corner: "📐", foul: "⚠️", free_kick: "🔵", penalty: "⭐", offside: "🚩", save: "🧤" }[t] ?? "●");

const gBadge = (g: string, l: string) => {
  const c: Record<string, string> = { "A+": "#16a34a", A: "#22c55e", "A-": "#4ade80", "B+": "#2563eb", B: "#3b82f6", "B-": "#60a5fa", "C+": "#ea580c", C: "#f97316", "C-": "#fb923c", D: "#dc2626", F: "#991b1b" };
  return `<div class="grade-item"><span class="grade-badge" style="background:${c[g] ?? "#94a3b8"}">${g}</span><span class="grade-label">${l}</span></div>`;
};

const sumStat = (arr: any[], k: string) => arr.reduce((s, p) => s + (p[k] ?? 0), 0);

const kpiCard = (icon: string, label: string, value: string, sub: string, color = "#2563eb") =>
  `<div class="kpi-card"><div class="kpi-icon" style="background:${color}15;color:${color}">${icon}</div><div class="kpi-val" style="color:${color}">${value}</div><div class="kpi-label">${label}</div><div class="kpi-sub">${sub}</div></div>`;

const progressRing = (pct: number, label: string, color = "#2563eb") => {
  const deg = Math.round(pct * 3.6);
  return `<div class="ring-wrap"><div class="ring" style="background:conic-gradient(${color} ${deg}deg, #e2e8f0 ${deg}deg)"><div class="ring-inner">${pct}%</div></div><div class="ring-label">${label}</div></div>`;
};

const miniBar = (label: string, val: number, max: number, color = "#2563eb") => {
  const pct = max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0;
  return `<div class="mini-bar-row"><span class="mini-label">${label}</span><div class="mini-track"><div class="mini-fill" style="width:${pct}%;background:${color}"></div></div><span class="mini-val">${val}</span></div>`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const { match_id, report_type, opponentName, clubName } = body;
    if (!match_id) return new Response(JSON.stringify({ error: "match_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ── Load data ──
    const { data: match } = await supabase.from("matches").select("*, fields(name), home_club:clubs!matches_home_club_id_fkey(name, logo_url)").eq("id", match_id).single();

    const [sectionsRes, recRes, evtRes, tsRes, hpsRes, apsRes, luRes] = await Promise.all([
      supabase.from("report_sections").select("*").eq("match_id", match_id).order("sort_order"),
      supabase.from("training_recommendations").select("*").eq("match_id", match_id).order("priority"),
      supabase.from("match_events").select("*").eq("match_id", match_id).order("minute"),
      supabase.from("team_match_stats").select("*").eq("match_id", match_id),
      supabase.from("player_match_stats").select("*, players(name, number, position)").eq("match_id", match_id).eq("team", "home").order("rating", { ascending: false }),
      supabase.from("player_match_stats").select("*, players(name, number, position)").eq("match_id", match_id).eq("team", "away").order("rating", { ascending: false }),
      supabase.from("match_lineups").select("*").eq("match_id", match_id).order("team").order("starting", { ascending: false }),
    ]);

    const sections = sectionsRes.data ?? [], trainingRecs = recRes.data ?? [], matchEvents = evtRes.data ?? [];
    const teamStats = tsRes.data ?? [], homePS = hpsRes.data ?? [], awayPS = apsRes.data ?? [], lineups = luRes.data ?? [];

    let prepData: any = null;
    if ((report_type === "match_prep" || report_type === "halftime_tactics") && match?.home_club_id) {
      const oppName = opponentName || match?.away_club_name;
      if (oppName) {
        const { data: prep } = await supabase.from("match_preparations").select("*").eq("club_id", match.home_club_id).eq("opponent_name", oppName).order("created_at", { ascending: false }).limit(1).maybeSingle();
        prepData = prep;
      }
    }

    const ps = (type: string) => { const s = sections.find((s: any) => s.section_type === type); if (!s) return null; try { return JSON.parse(s.content); } catch { return s.content; } };

    const homeTeam = clubName || match?.home_club?.name || "Heim";
    const awayTeam = match?.away_club_name || "Gegner";
    const matchDate = match?.date ? new Date(match.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
    const scoreDisplay = match?.home_score != null && match?.away_score != null ? `${match.home_score} : ${match.away_score}` : "– : –";
    const homeStats = teamStats.find((s: any) => s.team === "home");
    const awayStats = teamStats.find((s: any) => s.team === "away");
    const tacticalGrades = ps("tactical_grades");
    const summary = ps("summary");
    const matchRating = ps("match_rating");
    const momentum = ps("momentum");
    const riskMatrix = ps("risk_matrix");
    const playerSpotlight = ps("player_spotlight");
    const opponentDna = ps("opponent_dna");
    const trainingMicro = ps("training_micro_cycle");
    const insights = sections.filter((s: any) => s.section_type === "insight").map((s: any) => { try { return { title: s.title, ...JSON.parse(s.content) }; } catch { return { title: s.title, description: s.content }; } });

    // ── AI: deep analysis ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI gateway not configured");

    const hGoals = sumStat(homePS, "goals"), aGoals = sumStat(awayPS, "goals");
    const hShots = sumStat(homePS, "shots_total"), aShots = sumStat(awayPS, "shots_total");
    const hPasses = sumStat(homePS, "passes_completed"), aPasses = sumStat(awayPS, "passes_completed");
    const hPassT = sumStat(homePS, "passes_total"), aPassT = sumStat(awayPS, "passes_total");
    const hDuelsW = sumStat(homePS, "duels_won"), aDuelsW = sumStat(awayPS, "duels_won");
    const hDuelsT = sumStat(homePS, "duels_total"), aDuelsT = sumStat(awayPS, "duels_total");
    const hFouls = sumStat(homePS, "fouls_committed"), aFouls = sumStat(awayPS, "fouls_committed");
    const hSprints = sumStat(homePS, "sprint_count"), aSprints = sumStat(awayPS, "sprint_count");
    const hSOT = sumStat(homePS, "shots_on_target"), aSOT = sumStat(awayPS, "shots_on_target");
    const hPassAcc = hPassT ? Math.round((hPasses / hPassT) * 100) : 0;
    const aPassAcc = aPassT ? Math.round((aPasses / aPassT) * 100) : 0;
    const hPoss = homeStats?.possession_pct ?? 50, aPoss = awayStats?.possession_pct ?? 50;

    const compactData = {
      score: scoreDisplay, homeTeam, awayTeam, date: matchDate,
      homeFormation: match?.home_formation, awayFormation: match?.away_formation,
      summary, matchRating, tacticalGrades, momentum, riskMatrix, playerSpotlight, opponentDna, insights,
      stats: { hPoss, aPoss, hGoals, aGoals, hShots, aShots, hSOT, aSOT, hPasses, aPasses, hPassAcc, aPassAcc, hDuelsW, aDuelsW, hFouls, aFouls, hSprints, aSprints },
      events: matchEvents.slice(0, 40).map((e: any) => `${e.minute}' ${e.event_type} ${e.team} ${e.player_name ?? ""}`),
      homeTopPlayers: homePS.slice(0, 8).map((p: any) => ({ name: p.players?.name, rating: p.rating, pos: p.players?.position, goals: p.goals, assists: p.assists, km: p.distance_km?.toFixed(1), sprints: p.sprint_count })),
      awayTopPlayers: awayPS.slice(0, 5).map((p: any) => ({ name: p.players?.name, rating: p.rating, pos: p.players?.position })),
      trainingRecs: trainingRecs.slice(0, 5).map((t: any) => t.title),
      preparation: prepData?.preparation_data ?? null,
    };

    const rtLabels: Record<string, string> = { full_report: "Vollständiger Spielbericht", training_plan: "Trainingsplan", match_prep: "Spielvorbereitung", halftime_tactics: "Halbzeit-Taktik" };

    const aiPrompt = `Du bist ein Elite-Fußball-Analyst auf Champions-League-Niveau. Erstelle NUR valides JSON für "${rtLabels[report_type] ?? report_type}".

Antworte tiefgründig, taktisch präzise und mit konkreten Beispielen aus den Daten. Keine generischen Phrasen — jede Aussage muss datenbasiert und actionable sein.

{
  "management_summary": "5-7 Sätze: Gesamtbewertung mit konkreten Zahlen, taktischer Einordnung und Leistungsbewertung. Benenne die entscheidenden Phasen.",
  "key_takeaways": ["5 präzise, datengestützte Erkenntnisse mit Zahlen"],
  "overall_grade": <Zahl 1-10>,
  "coach_recommendation": "3 Sätze: Konkrete Handlungsanweisung für den Trainer mit Begründung",
  "executive_verdict": "1 Satz: Journalistisches Fazit wie ein Kommentator",

  "tactical_deep_dive": "5-8 Sätze: Detaillierte taktische Analyse. Pressinghöhe, Raumaufteilung, Spielaufbau-Muster, Schwachstellen in der Kette.",
  "phase_analysis": { "first_15": "Was passierte 0-15 Min", "mid_first": "15-30 Min", "pre_halftime": "30-45 Min", "second_half_start": "45-60 Min", "mid_second": "60-75 Min", "final_phase": "75-90 Min" },
  "key_moments": [{"minute": <number>, "description": "Was passierte und warum es spielentscheidend war", "tactical_impact": "Auswirkung auf Spielverlauf"}],

  "home_strengths": ["4 konkrete Stärken mit Bezug zu Zahlen/Spielszenen"],
  "home_weaknesses": ["4 konkrete Schwächen mit Bezug zu Zahlen/Spielszenen"],
  "opponent_strengths": ["3 Stärken"],
  "opponent_weaknesses": ["3 Schwächen"],
  "opponent_profile": "4 Sätze Gegner-Spielstil-Analyse: Formation, Pressingverhalten, Aufbaustruktur, gefährlichste Zone",

  "mvp": {"name": "Spielername", "reason": "3 Sätze warum", "key_stats": "Kernzahlen"},
  "concern_player": {"name": "Spielername", "reason": "2 Sätze Begründung", "improvement": "Konkrete Verbesserung"},
  "position_group_analysis": [{"group": "Abwehr/Mittelfeld/Angriff", "grade": "A-F", "summary": "2 Sätze"}],

  "momentum_narrative": "3 Sätze: Wann hatte welches Team die Kontrolle und warum",
  "risk_assessment": [{"risk": "Risiko", "severity": "hoch/mittel/gering", "mitigation": "Gegenmaßnahme"}],

  "coaching_insights": [{"title": "...", "description": "2-3 Sätze detailliert", "impact": <1-10>, "category": "Taktik/Fitness/Mental"}],
  "tactical_adjustments": ["5 konkrete taktische Anpassungsvorschläge"],
  "set_piece_analysis": "2 Sätze: Standardsituation-Bewertung",

  "training_focus": [{"title": "...", "description": "3 Sätze mit Übungsbeschreibung", "intensity": "hoch/mittel/gering", "duration": "30-60 Min", "goal": "Trainingsziel"}],
  "weekly_plan": [{"day": "Tag+1/Tag+2/Tag+3", "theme": "...", "focus": "...", "intensity": "..."}],

  "conclusion": "5-7 Sätze: Ausführliches Fazit mit Einordnung der Saisonentwicklung und strategischem Ausblick",
  "next_match_priorities": ["5 Prioritäten für das nächste Spiel"],

  "dos": ["4 Do's"], "donts": ["4 Don'ts"],
  "halftime_good": ["3 positive Aspekte"], "halftime_bad": ["3 negative Aspekte"],
  "sub_suggestions": ["2-3 Wechselvorschläge mit Begründung"]
}

SPRACHE: Deutsch. NUR JSON. Keine Markdown-Formatierung.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: aiPrompt }, { role: "user", content: JSON.stringify(compactData) }],
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
    try { ai = JSON.parse(aiText); } catch { console.error("AI JSON parse failed"); }

    // ── CSS ──
    const css = `<style>
@page{size:A4;margin:14mm 16mm}@media print{.page-break{page-break-before:always}}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;font-size:10.5px;line-height:1.5;color:#1e293b;background:#fff}

.cover{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:95vh;text-align:center;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 40%,#2563eb 100%);color:#fff;position:relative;overflow:hidden}
.cover::before{content:'';position:absolute;width:500px;height:500px;border:1px solid rgba(255,255,255,0.06);border-radius:50%;top:-100px;right:-100px}
.cover::after{content:'';position:absolute;width:300px;height:300px;border:1px solid rgba(255,255,255,0.04);border-radius:50%;bottom:-50px;left:-50px}
.cover-logo{width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,0.15);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;margin-bottom:20px;font-size:36px;font-weight:800;border:2px solid rgba(255,255,255,0.2)}
.cover h1{font-size:14px;font-weight:300;letter-spacing:4px;text-transform:uppercase;opacity:0.7;margin-bottom:12px}
.cover .score-big{font-size:72px;font-weight:800;letter-spacing:6px;margin:8px 0;text-shadow:0 4px 20px rgba(0,0,0,0.3)}
.cover .teams{font-size:22px;font-weight:600}
.cover .meta{font-size:12px;opacity:0.6;margin-top:16px}
.cover .report-type{display:inline-block;padding:6px 24px;border:1px solid rgba(255,255,255,0.2);border-radius:20px;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:20px;background:rgba(255,255,255,0.05)}
.cover .powered{position:absolute;bottom:20px;font-size:10px;opacity:0.4}

h2{font-size:16px;font-weight:700;color:#0f172a;border-bottom:3px solid #2563eb;padding-bottom:5px;margin-bottom:14px;display:flex;align-items:center;gap:6px}
h2 .sec-icon{font-size:18px}
h3{font-size:13px;font-weight:600;color:#334155;margin:10px 0 5px}

/* Cockpit KPIs */
.cockpit-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.kpi-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center}
.kpi-icon{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 6px;font-size:16px}
.kpi-val{font-size:28px;font-weight:800;line-height:1}
.kpi-label{font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px}
.kpi-sub{font-size:8px;color:#94a3b8;margin-top:1px}

/* Rings */
.rings-row{display:flex;justify-content:space-around;margin:12px 0}
.ring-wrap{text-align:center}
.ring{width:70px;height:70px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 4px}
.ring-inner{width:54px;height:54px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#1e293b}
.ring-label{font-size:9px;color:#64748b;font-weight:600}

/* Mini bars */
.mini-bar-row{display:flex;align-items:center;gap:6px;margin:3px 0}
.mini-label{width:80px;font-size:9px;font-weight:600;color:#64748b;text-align:right}
.mini-track{flex:1;height:12px;background:#f1f5f9;border-radius:4px;overflow:hidden}
.mini-fill{height:100%;border-radius:4px;transition:width 0.3s}
.mini-val{width:30px;font-size:10px;font-weight:700;color:#334155}

/* Summary */
.summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.summary-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
.summary-card.full{grid-column:1/-1}
.summary-card.highlight{background:linear-gradient(135deg,#eff6ff,#dbeafe);border-color:#93c5fd}
.big-number{font-size:42px;font-weight:800;text-align:center;margin:6px 0}
.takeaway{display:flex;gap:6px;align-items:flex-start;margin:5px 0}
.takeaway-num{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700}

/* Phase analysis */
.phase-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
.phase-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px}
.phase-card .phase-time{font-size:10px;font-weight:700;color:#2563eb;margin-bottom:2px}
.phase-card .phase-text{font-size:9.5px;color:#475569;line-height:1.4}

/* Key moments */
.moment-card{display:flex;gap:8px;margin:6px 0;padding:8px;background:#f0f9ff;border-radius:6px;border-left:4px solid #2563eb}
.moment-min{flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800}
.moment-text{flex:1;font-size:10px}
.moment-text strong{display:block;font-size:11px;margin-bottom:1px}

/* Stat bars */
.stat-row{display:flex;align-items:center;gap:5px;margin:4px 0}
.stat-label{width:100px;font-size:9px;font-weight:600;text-align:right;color:#64748b}
.stat-val{width:42px;font-size:10px;font-weight:700}
.stat-val.home{text-align:right;color:#2563eb}
.stat-val.away{text-align:left;color:#dc2626}
.stat-bar{flex:1;display:flex;height:16px;border-radius:3px;overflow:hidden;background:#f1f5f9}
.bar-home{background:linear-gradient(90deg,#3b82f6,#2563eb)}
.bar-away{background:linear-gradient(90deg,#dc2626,#ef4444)}

/* Momentum chart */
.momentum-chart{margin:10px 0}
.momentum-bars{display:flex;align-items:flex-end;height:80px;gap:2px}
.m-bar{flex:1;border-radius:2px 2px 0 0;position:relative;min-width:8px}
.m-bar.home{background:linear-gradient(180deg,#3b82f6,#2563eb)}
.m-bar.away{background:linear-gradient(180deg,#ef4444,#dc2626);align-self:flex-start;border-radius:0 0 2px 2px}
.momentum-axis{display:flex;justify-content:space-between;font-size:8px;color:#94a3b8;margin-top:2px;border-top:1px solid #e2e8f0;padding-top:2px}

/* Player table */
.player-table{width:100%;border-collapse:collapse;font-size:9.5px;margin:6px 0}
.player-table th{background:#0f172a;color:#fff;padding:5px 4px;text-align:left;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:0.3px}
.player-table td{padding:4px;border-bottom:1px solid #e2e8f0}
.player-table tr:nth-child(even) td{background:#f8fafc}
.rating-cell{display:inline-block;padding:2px 7px;border-radius:8px;font-weight:700;font-size:10px;min-width:30px;text-align:center}

/* Spotlight */
.spotlight-card{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #86efac;border-radius:8px;padding:12px;margin:6px 0}
.spotlight-card.concern{background:linear-gradient(135deg,#fef2f2,#fecaca);border-color:#fca5a5}
.spotlight-name{font-size:14px;font-weight:800;color:#0f172a;margin-bottom:4px}
.spotlight-reason{font-size:10.5px;color:#334155;line-height:1.5}

/* Grades */
.grades-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0}
.grade-item{display:flex;flex-direction:column;align-items:center;gap:3px}
.grade-badge{display:inline-block;padding:4px 12px;border-radius:5px;color:#fff;font-weight:800;font-size:15px;min-width:38px;text-align:center}
.grade-label{font-size:9px;color:#64748b;text-align:center}

/* Position groups */
.pos-group{display:flex;gap:10px;margin:8px 0}
.pos-card{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;text-align:center}
.pos-card .pos-grade{font-size:20px;font-weight:800;margin:4px 0}

/* SWOT */
.swot-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.swot-col{padding:10px;border-radius:6px}
.swot-col.strengths{background:#f0fdf4;border:1px solid #bbf7d0}
.swot-col.weaknesses{background:#fef2f2;border:1px solid #fecaca}
.swot-col h4{font-size:11px;margin-bottom:5px;font-weight:700}
.swot-item{margin:3px 0;font-size:10px;line-height:1.4}

/* Insight cards */
.insight-card{background:#f8fafc;border-left:4px solid #2563eb;padding:8px 10px;margin:6px 0;border-radius:0 6px 6px 0}
.insight-card .insight-title{font-weight:700;font-size:11px;margin-bottom:1px}
.insight-card .insight-desc{font-size:10px;color:#475569;line-height:1.5}
.insight-card .impact{float:right;background:#2563eb;color:#fff;padding:1px 7px;border-radius:8px;font-size:9px;font-weight:700}
.insight-card .insight-cat{display:inline-block;background:#e2e8f0;padding:1px 6px;border-radius:4px;font-size:8px;color:#475569;margin-top:3px}

/* Risk table */
.risk-table{width:100%;border-collapse:collapse;font-size:9.5px}
.risk-table th{background:#fef2f2;padding:5px;text-align:left;font-weight:600;border-bottom:2px solid #fecaca}
.risk-table td{padding:5px;border-bottom:1px solid #f1f5f9}
.risk-high{color:#dc2626;font-weight:700}.risk-med{color:#ea580c;font-weight:700}.risk-low{color:#16a34a;font-weight:700}

/* Training */
.training-card{background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border:1px solid #bae6fd;border-radius:8px;padding:10px;margin:6px 0}
.training-card .tc-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.training-card .tc-title{font-weight:700;font-size:12px;color:#0c4a6e}
.training-card .tc-meta{font-size:9px;color:#0369a1}
.training-card .tc-goal{font-size:9px;color:#0891b2;font-style:italic;margin-top:3px}

/* Weekly plan */
.weekly-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0}
.day-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;text-align:center}
.day-card .day-name{font-size:11px;font-weight:700;color:#2563eb;margin-bottom:3px}
.day-card .day-theme{font-size:10px;font-weight:600;margin-bottom:2px}
.day-card .day-focus{font-size:9px;color:#64748b}
.day-card .day-intensity{display:inline-block;margin-top:3px;padding:1px 6px;border-radius:4px;font-size:8px;font-weight:600}
.day-card .day-intensity.hoch{background:#fecaca;color:#dc2626}
.day-card .day-intensity.mittel{background:#fed7aa;color:#ea580c}
.day-card .day-intensity.gering{background:#bbf7d0;color:#16a34a}

/* Formation field */
.field-container{background:linear-gradient(to bottom,#16a34a,#15803d);border-radius:6px;padding:10px;position:relative;min-height:200px;margin:6px 0}
.field-lines{border:2px solid rgba(255,255,255,0.4);border-radius:3px;height:180px;position:relative}
.field-center{position:absolute;top:50%;left:0;right:0;border-top:1px solid rgba(255,255,255,0.3)}
.field-circle{position:absolute;top:50%;left:50%;width:50px;height:50px;border:1px solid rgba(255,255,255,0.3);border-radius:50%;transform:translate(-50%,-50%)}
.player-dot{position:absolute;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;transform:translate(-50%,-50%);box-shadow:0 2px 4px rgba(0,0,0,0.3)}
.player-dot.home{background:#2563eb}.player-dot.away{background:#dc2626}

/* Event timeline */
.timeline{position:relative;padding:0 16px}
.timeline::before{content:'';position:absolute;left:50%;top:0;bottom:0;width:2px;background:#e2e8f0}
.event-row{display:flex;align-items:center;margin:2px 0;position:relative}
.event-min{position:absolute;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:1px 5px;border-radius:6px;font-size:8px;font-weight:700;z-index:1}
.event-home,.event-away{width:44%;font-size:9px;padding:2px 6px;border-radius:3px}
.event-home{text-align:right;margin-right:auto;background:#eff6ff;color:#1e40af}
.event-away{text-align:left;margin-left:auto;background:#fef2f2;color:#991b1b}

/* Do/Dont */
.do-list,.dont-list{list-style:none;padding:0}
.do-list li::before{content:"✅ "}.dont-list li::before{content:"❌ "}
.do-list li,.dont-list li{margin:3px 0;font-size:10px}

/* Verdict */
.verdict-box{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;padding:16px;border-radius:8px;margin:12px 0;text-align:center;font-size:14px;font-style:italic;line-height:1.6}

/* Notes & footer */
.notes-area{margin-top:12px;padding-top:6px;border-top:1px dashed #cbd5e1}
.notes-label{font-size:9px;color:#94a3b8;margin-bottom:3px}
.note-line{border-bottom:1px dotted #cbd5e1;height:20px;margin:1px 0}
.page-footer{text-align:center;font-size:8px;color:#94a3b8;margin-top:16px;padding-top:6px;border-top:1px solid #e2e8f0}
</style>`;

    // ── Build pages ──
    const pages: string[] = [];
    const footer = `<div class="page-footer">FieldIQ Analytics Report • ${matchDate} • Vertraulich</div>`;
    const clubInitial = homeTeam.charAt(0).toUpperCase();

    // 1. COVER
    pages.push(`<div class="cover">
      <div class="cover-logo">${clubInitial}</div>
      <h1>Spielanalyse-Report</h1>
      <div class="teams">${homeTeam} vs ${awayTeam}</div>
      <div class="score-big">${scoreDisplay}</div>
      <div class="meta">${matchDate}${match?.fields?.name ? ` • ${match.fields.name}` : ""}${match?.home_formation ? ` • ${match.home_formation}` : ""}</div>
      <div class="report-type">${rtLabels[report_type] ?? report_type}</div>
      <div class="powered">Powered by FieldIQ Analytics Engine</div>
    </div>`);

    if (report_type === "full_report" || report_type === "training_plan") {
      const og = ai.overall_grade ?? matchRating?.overall ?? "–";

      // 2. COCKPIT DASHBOARD
      const duelsWinPct = hDuelsT > 0 ? Math.round((hDuelsW / hDuelsT) * 100) : 0;
      const shotConv = hShots > 0 ? Math.round((hGoals / hShots) * 100) : 0;
      const totalDist = homeStats?.total_distance_km?.toFixed(1) ?? "–";
      const topSpeed = homeStats?.top_speed_kmh?.toFixed(1) ?? "–";
      const maxPlayerSprints = Math.max(...homePS.map((p: any) => p.sprint_count ?? 0), 1);
      const maxPlayerDist = Math.max(...homePS.map((p: any) => p.distance_km ?? 0), 1);

      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">🎛️</span> Performance-Cockpit</h2>
        <div class="cockpit-grid">
          ${kpiCard("📊", "Gesamtnote", String(og), "von 10 Punkten", rc(Number(og)))}
          ${kpiCard("⚽", "Torschuss-Effizienz", `${shotConv}%`, `${hGoals} Tore / ${hShots} Schüsse`, "#16a34a")}
          ${kpiCard("🏃", "Laufleistung", `${totalDist}`, "km Gesamtdistanz", "#2563eb")}
          ${kpiCard("⚡", "Top-Speed", `${topSpeed}`, "km/h Höchstgeschw.", "#ea580c")}
        </div>

        <div class="rings-row">
          ${progressRing(hPoss, "Ballbesitz", "#2563eb")}
          ${progressRing(hPassAcc, "Passquote", "#16a34a")}
          ${progressRing(duelsWinPct, "Zweikampf %", "#ea580c")}
          ${progressRing(hShots > 0 ? Math.round((hSOT / hShots) * 100) : 0, "Schuss-Präz.", "#7c3aed")}
        </div>

        <h3>Top-Performer (Sprints & Distanz)</h3>
        ${homePS.slice(0, 6).map((p: any) => `<div style="display:flex;gap:8px;margin:3px 0">
          <span style="width:100px;font-size:9px;font-weight:600">${p.players?.name ?? "?"}</span>
          <div style="flex:1;display:flex;gap:4px;align-items:center">
            <div style="flex:1;height:8px;background:#eff6ff;border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.round(((p.sprint_count ?? 0) / maxPlayerSprints) * 100)}%;background:#3b82f6;border-radius:3px"></div></div>
            <span style="font-size:8px;width:24px;color:#3b82f6;font-weight:700">${p.sprint_count ?? 0}</span>
            <div style="flex:1;height:8px;background:#f0fdf4;border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.round(((p.distance_km ?? 0) / maxPlayerDist) * 100)}%;background:#16a34a;border-radius:3px"></div></div>
            <span style="font-size:8px;width:30px;color:#16a34a;font-weight:700">${p.distance_km?.toFixed(1) ?? "–"}</span>
          </div>
        </div>`).join("")}
        <div style="display:flex;gap:12px;justify-content:flex-end;font-size:8px;color:#94a3b8;margin-top:4px"><span>🔵 Sprints</span><span>🟢 Distanz (km)</span></div>
        ${footer}
      </div>`);

      // 3. MANAGEMENT SUMMARY + VERDICT
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">📊</span> Management Summary</h2>
        ${ai.executive_verdict ? `<div class="verdict-box">„${ai.executive_verdict}"</div>` : ""}
        <div class="summary-grid">
          <div class="summary-card" style="text-align:center"><div style="font-size:10px;color:#64748b">ERGEBNIS</div><div class="big-number">${scoreDisplay}</div></div>
          <div class="summary-card" style="text-align:center"><div style="font-size:10px;color:#64748b">GESAMTNOTE</div><div class="big-number" style="color:${rc(Number(og))}">${og}</div></div>
          <div class="summary-card full"><h3>Analyse</h3><p style="font-size:11px;line-height:1.7">${ai.management_summary ?? summary ?? "Keine Zusammenfassung."}</p></div>
          <div class="summary-card full"><h3>Key Takeaways</h3>${(ai.key_takeaways ?? []).map((t: string, i: number) => `<div class="takeaway"><span class="takeaway-num">${i + 1}</span><span style="font-size:10px">${t}</span></div>`).join("")}</div>
          ${ai.coach_recommendation ? `<div class="summary-card full highlight"><h3>💡 Trainer-Empfehlung</h3><p style="font-size:11px;font-weight:500;line-height:1.6">${ai.coach_recommendation}</p></div>` : ""}
        </div>
        ${footer}
      </div>`);

      // 4. TACTICAL DEEP DIVE + PHASE ANALYSIS
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">🔬</span> Taktische Tiefenanalyse</h2>
        <div class="summary-card full" style="margin-bottom:12px"><p style="font-size:11px;line-height:1.7">${ai.tactical_deep_dive ?? "Keine taktische Analyse verfügbar."}</p></div>
        ${ai.set_piece_analysis ? `<div class="summary-card full" style="background:#fef3c7;border-color:#fcd34d;margin-bottom:12px"><h3>⚽ Standards</h3><p style="font-size:10.5px">${ai.set_piece_analysis}</p></div>` : ""}
        <h3>Spielphasen-Analyse</h3>
        <div class="phase-grid">
          ${Object.entries(ai.phase_analysis ?? {}).map(([key, val]) => {
            const labels: Record<string, string> = { first_15: "0–15'", mid_first: "15–30'", pre_halftime: "30–45'", second_half_start: "45–60'", mid_second: "60–75'", final_phase: "75–90'" };
            return `<div class="phase-card"><div class="phase-time">${labels[key] ?? key}</div><div class="phase-text">${val}</div></div>`;
          }).join("")}
        </div>
        ${(ai.key_moments ?? []).length ? `<h3 style="margin-top:10px">Schlüsselmomente</h3>${(ai.key_moments ?? []).map((m: any) => `<div class="moment-card"><div class="moment-min">${m.minute}'</div><div class="moment-text"><strong>${m.description}</strong><span style="color:#64748b">${m.tactical_impact ?? ""}</span></div></div>`).join("")}` : ""}
        ${ai.momentum_narrative ? `<div class="summary-card full" style="margin-top:10px"><h3>📈 Momentum</h3><p style="font-size:10.5px;line-height:1.6">${ai.momentum_narrative}</p></div>` : ""}
        ${footer}
      </div>`);

      // 5. FORMATION
      const homeLU = lineups.filter((l: any) => l.team === "home" && l.starting);
      const awayLU = lineups.filter((l: any) => l.team === "away" && l.starting);
      const subs = lineups.filter((l: any) => l.team === "home" && !l.starting);
      const posMap = (f: string | null, n: number) => {
        const pos: Array<{x:number;y:number}> = [{ x: 50, y: 92 }];
        const parts = (f ?? "4-4-2").split("-").map(Number);
        const yLvl = [75, 50, 30, 12];
        parts.forEach((cnt, li) => { for (let i = 0; i < cnt; i++) pos.push({ x: ((i + 1) / (cnt + 1)) * 100, y: yLvl[li] ?? 20 }); });
        return pos.slice(0, n);
      };
      const hPos = posMap(match?.home_formation, homeLU.length);
      const dots = homeLU.map((p: any, i: number) => { const po = hPos[i] ?? { x: 50, y: 50 }; return `<div class="player-dot home" style="left:${po.x}%;top:${po.y}%" title="${p.player_name}">${p.shirt_number ?? ""}</div>`; }).join("");

      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">👥</span> Aufstellung & Formation</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><h3>${homeTeam} ${match?.home_formation ? `(${match.home_formation})` : ""}</h3>
            <div class="field-container"><div class="field-lines"><div class="field-center"></div><div class="field-circle"></div>${dots}</div></div>
            ${subs.length ? '<h3>Ersatzbank</h3><div style="font-size:9px;color:#64748b">' + subs.map((s: any) => (s.shirt_number ?? "?") + " " + s.player_name).join(" • ") + "</div>" : ""}
          </div>
          <div><h3>${awayTeam} ${match?.away_formation ? `(${match.away_formation})` : ""}</h3>
            ${awayLU.length ? '<div style="font-size:10px">' + awayLU.map((p: any) => `<div style="margin:2px 0"><span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:#dc2626;color:#fff;text-align:center;line-height:24px;font-size:9px;font-weight:700;margin-right:4px">${p.shirt_number ?? ""}</span>${p.player_name}</div>`).join("") + "</div>" : '<p style="color:#94a3b8;font-size:10px">Keine Daten</p>'}
          </div>
        </div>
        ${footer}
      </div>`);

      // 6. TEAM STATS
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">📈</span> Team-Statistiken</h2>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-weight:700;color:#2563eb">${homeTeam}</span><span style="font-weight:700;color:#dc2626">${awayTeam}</span></div>
        ${compBar("Ballbesitz", `${hPoss}%`, `${aPoss}%`, hPoss, aPoss)}
        ${compBar("Tore", hGoals, aGoals)}
        ${compBar("Schüsse", hShots, aShots)}
        ${compBar("Aufs Tor", hSOT, aSOT)}
        ${compBar("Pässe", hPasses, aPasses)}
        ${compBar("Passquote", `${hPassAcc}%`, `${aPassAcc}%`, hPassAcc, aPassAcc)}
        ${compBar("Zweikämpfe", hDuelsW, aDuelsW)}
        ${compBar("Fouls", hFouls, aFouls)}
        ${compBar("Sprints", hSprints, aSprints)}
        ${compBar("Distanz (km)", homeStats?.total_distance_km?.toFixed(1) ?? "–", awayStats?.total_distance_km?.toFixed(1) ?? "–", homeStats?.total_distance_km ?? 0, awayStats?.total_distance_km ?? 0)}
        ${compBar("Top-Speed", homeStats?.top_speed_kmh?.toFixed(1) ?? "–", awayStats?.top_speed_kmh?.toFixed(1) ?? "–", homeStats?.top_speed_kmh ?? 0, awayStats?.top_speed_kmh ?? 0)}
        ${footer}
      </div>`);

      // 7. TACTICAL GRADES + POSITION GROUPS
      const tg = tacticalGrades ?? {};
      const dims = [["pressing", "Pressing"], ["build_up", "Spielaufbau"], ["defense", "Defensive"], ["transitions", "Umschaltspiel"], ["set_pieces", "Standards"], ["space_control", "Raumkontrolle"]];
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">🎯</span> Taktische Bewertung</h2>
        <div class="grades-grid">${dims.map(([k, l]) => gBadge(tg[k]?.grade ?? tg[k] ?? "–", l)).join("")}</div>
        ${tg.summary ? `<div class="summary-card full" style="margin-top:8px"><p style="font-size:10px">${tg.summary}</p></div>` : ""}
        ${(ai.position_group_analysis ?? []).length ? `<h3 style="margin-top:14px">Positionsgruppen-Analyse</h3><div class="pos-group">${(ai.position_group_analysis ?? []).map((pg: any) => `<div class="pos-card"><div style="font-size:10px;font-weight:600">${pg.group}</div><div class="pos-grade" style="color:${({"A":"#16a34a","B":"#2563eb","C":"#ea580c","D":"#dc2626","F":"#991b1b"}[pg.grade?.charAt(0)] ?? "#64748b")}">${pg.grade}</div><div style="font-size:9px;color:#64748b">${pg.summary}</div></div>`).join("")}</div>` : ""}
        ${footer}
      </div>`);

      // 8. EVENT TIMELINE
      if (matchEvents.length) {
        const evtRows = matchEvents.map((e: any) => {
          const ic = eIcon(e.event_type), txt = `${ic} ${e.event_type.replace(/_/g, " ")}${e.player_name ? ` — ${e.player_name}` : ""}`;
          return `<div class="event-row">${e.team === "home" ? `<div class="event-home">${txt}</div>` : "<div></div>"}<span class="event-min">${e.minute}'</span>${e.team !== "home" ? `<div class="event-away">${txt}</div>` : "<div></div>"}</div>`;
        }).join("");
        pages.push(`<div class="page page-break"><h2><span class="sec-icon">⏱️</span> Event-Chronik</h2><div class="timeline">${evtRows}</div>${footer}</div>`);
      }

      // 9. PLAYER SPOTLIGHT
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">🌟</span> Spieler-Spotlight</h2>
        ${ai.mvp ? `<div class="spotlight-card"><div style="font-size:9px;color:#16a34a;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">⭐ Man of the Match</div><div class="spotlight-name">${ai.mvp.name}</div><div class="spotlight-reason">${ai.mvp.reason}</div>${ai.mvp.key_stats ? `<div style="font-size:9px;color:#16a34a;margin-top:4px;font-weight:600">${ai.mvp.key_stats}</div>` : ""}</div>` : ""}
        ${ai.concern_player ? `<div class="spotlight-card concern"><div style="font-size:9px;color:#dc2626;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">⚠️ Sorgenfall</div><div class="spotlight-name">${ai.concern_player.name}</div><div class="spotlight-reason">${ai.concern_player.reason}</div>${ai.concern_player.improvement ? `<div style="font-size:9px;color:#ea580c;margin-top:4px;font-weight:600">💡 ${ai.concern_player.improvement}</div>` : ""}</div>` : ""}
        ${playerSpotlight ? `<div class="summary-card full" style="margin-top:8px"><h3>Analyse-System Spotlight</h3><p style="font-size:10px">${typeof playerSpotlight === "string" ? playerSpotlight : JSON.stringify(playerSpotlight)}</p></div>` : ""}
        ${footer}
      </div>`);

      // 10. SWOT + DO/DONT
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">💪</span> SWOT-Analyse — ${homeTeam}</h2>
        <div class="swot-grid">
          <div class="swot-col strengths"><h4>✅ Stärken</h4>${(ai.home_strengths ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}</div>
          <div class="swot-col weaknesses"><h4>⚠️ Schwächen</h4>${(ai.home_weaknesses ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}</div>
        </div>
        <h2 style="margin-top:16px"><span class="sec-icon">🔍</span> Gegner-Analyse — ${awayTeam}</h2>
        ${ai.opponent_profile ? `<div class="summary-card full" style="margin-bottom:8px"><p style="font-size:10.5px;line-height:1.6">${ai.opponent_profile}</p></div>` : ""}
        <div class="swot-grid">
          <div class="swot-col strengths"><h4>✅ Stärken</h4>${(ai.opponent_strengths ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}</div>
          <div class="swot-col weaknesses"><h4>⚠️ Schwächen</h4>${(ai.opponent_weaknesses ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}</div>
        </div>
        <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="background:#f0fdf4;padding:8px;border-radius:6px"><h4 style="font-size:11px;margin-bottom:4px">✅ Do's</h4><ul class="do-list">${(ai.dos ?? []).map((d: string) => `<li>${d}</li>`).join("")}</ul></div>
          <div style="background:#fef2f2;padding:8px;border-radius:6px"><h4 style="font-size:11px;margin-bottom:4px">❌ Don'ts</h4><ul class="dont-list">${(ai.donts ?? []).map((d: string) => `<li>${d}</li>`).join("")}</ul></div>
        </div>
        ${footer}
      </div>`);

      // 11. COACHING INSIGHTS + RISK
      const insightData = ai.coaching_insights ?? insights ?? [];
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">🧠</span> Coaching-Insights</h2>
        ${insightData.map((ins: any, i: number) => `<div class="insight-card">${ins.impact ? `<span class="impact">Impact: ${ins.impact}/10</span>` : ""}<div class="insight-title">${i + 1}. ${ins.title ?? "Insight"}</div><div class="insight-desc">${ins.description ?? ""}</div>${ins.category ? `<span class="insight-cat">${ins.category}</span>` : ""}</div>`).join("")}
        ${(ai.tactical_adjustments ?? []).length ? `<h3 style="margin-top:12px">Taktische Anpassungen</h3>${(ai.tactical_adjustments ?? []).map((a: string, i: number) => `<div class="takeaway"><span class="takeaway-num">${i + 1}</span><span style="font-size:10px">${a}</span></div>`).join("")}` : ""}
        ${(ai.risk_assessment ?? []).length ? `<h3 style="margin-top:12px">Risiko-Assessment</h3><table class="risk-table"><tr><th>Risiko</th><th>Schwere</th><th>Gegenmaßnahme</th></tr>${(ai.risk_assessment ?? []).map((r: any) => `<tr><td>${r.risk}</td><td class="${r.severity === "hoch" ? "risk-high" : r.severity === "mittel" ? "risk-med" : "risk-low"}">${r.severity}</td><td>${r.mitigation}</td></tr>`).join("")}</table>` : ""}
        ${footer}
      </div>`);

      // 12. PLAYER RATINGS HOME
      if (homePS.length) {
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">⭐</span> Spieler-Bewertungen — ${homeTeam}</h2>
          <table class="player-table">
            <tr><th>#</th><th>Name</th><th>Pos</th><th>Note</th><th>km</th><th>⚽</th><th>🅰️</th><th>Pässe</th><th>Zweik.</th><th>Sprints</th><th>Top</th></tr>
            ${homePS.map((p: any) => `<tr><td>${p.players?.number ?? "–"}</td><td style="font-weight:600">${p.players?.name ?? "?"}</td><td>${p.players?.position ?? "–"}</td><td><span class="rating-cell" style="background:${rbg(p.rating)};color:${rc(p.rating)}">${p.rating?.toFixed(1) ?? "–"}</span></td><td>${p.distance_km?.toFixed(1) ?? "–"}</td><td>${p.goals ?? 0}</td><td>${p.assists ?? 0}</td><td>${p.passes_completed ?? 0}/${p.passes_total ?? 0}</td><td>${p.duels_won ?? 0}/${p.duels_total ?? 0}</td><td>${p.sprint_count ?? 0}</td><td>${p.top_speed_kmh?.toFixed(1) ?? "–"}</td></tr>`).join("")}
          </table>
          ${footer}
        </div>`);
      }

      // 13. PLAYER RATINGS AWAY
      if (awayPS.length) {
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">⭐</span> Spieler-Bewertungen — ${awayTeam}</h2>
          <table class="player-table">
            <tr><th>#</th><th>Name</th><th>Pos</th><th>Note</th><th>km</th><th>⚽</th><th>🅰️</th><th>Pässe</th><th>Zweik.</th><th>Sprints</th><th>Top</th></tr>
            ${awayPS.map((p: any) => `<tr><td>${p.players?.number ?? "–"}</td><td style="font-weight:600">${p.players?.name ?? "?"}</td><td>${p.players?.position ?? "–"}</td><td><span class="rating-cell" style="background:${rbg(p.rating)};color:${rc(p.rating)}">${p.rating?.toFixed(1) ?? "–"}</span></td><td>${p.distance_km?.toFixed(1) ?? "–"}</td><td>${p.goals ?? 0}</td><td>${p.assists ?? 0}</td><td>${p.passes_completed ?? 0}/${p.passes_total ?? 0}</td><td>${p.duels_won ?? 0}/${p.duels_total ?? 0}</td><td>${p.sprint_count ?? 0}</td><td>${p.top_speed_kmh?.toFixed(1) ?? "–"}</td></tr>`).join("")}
          </table>
          ${footer}
        </div>`);
      }

      // 14. TRAINING + WEEKLY PLAN
      const trainData = ai.training_focus ?? trainingRecs ?? [];
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">🏋️</span> Trainingsempfehlungen</h2>
        ${trainData.map((t: any) => `<div class="training-card"><div class="tc-header"><span class="tc-title">${t.title ?? "Training"}</span><span class="tc-meta">${t.intensity ?? ""} ${t.duration ? `• ${t.duration}` : ""}</span></div><p style="font-size:10px;color:#334155;line-height:1.5">${t.description ?? ""}</p>${t.goal ? `<div class="tc-goal">🎯 ${t.goal}</div>` : ""}</div>`).join("")}
        ${(ai.weekly_plan ?? []).length ? `<h3 style="margin-top:12px">📅 Wochenplan</h3><div class="weekly-grid">${(ai.weekly_plan ?? []).map((d: any) => `<div class="day-card"><div class="day-name">${d.day}</div><div class="day-theme">${d.theme}</div><div class="day-focus">${d.focus}</div><span class="day-intensity ${(d.intensity ?? "").toLowerCase()}">${d.intensity}</span></div>`).join("")}</div>` : ""}
        ${(() => {
          if (!trainingMicro || !Array.isArray(trainingMicro)) return "";
          return '<h3 style="margin-top:12px">Mikrozyklus (Analyse-System)</h3>' + trainingMicro.map((s: any, i: number) => {
            const exHtml = Array.isArray(s.exercises) ? s.exercises.map((ex: any) => '<p style="font-size:9px;margin:1px 0">• ' + (typeof ex === "string" ? ex : ex.name ?? ex.title ?? "") + "</p>").join("") : "";
            return '<div class="training-card"><div class="tc-header"><span class="tc-title">Session ' + (i+1) + ": " + (s.theme ?? s.title ?? "") + '</span><span class="tc-meta">' + (s.duration ?? "") + " • " + (s.intensity ?? "") + "</span></div>" + exHtml + "</div>";
          }).join("");
        })()}
        ${footer}
      </div>`);

      // 15. CONCLUSION
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">🏁</span> Fazit & Strategischer Ausblick</h2>
        <div class="summary-card full" style="margin-bottom:10px"><p style="font-size:11px;line-height:1.7">${ai.conclusion ?? "Analyse abgeschlossen."}</p></div>
        <h3>Prioritäten für das nächste Spiel</h3>
        ${(ai.next_match_priorities ?? []).map((p: string, i: number) => `<div class="takeaway"><span class="takeaway-num">${i + 1}</span><span style="font-size:11px;font-weight:600">${p}</span></div>`).join("")}
        <div class="notes-area" style="margin-top:20px"><div class="notes-label">📝 Eigene Notizen</div>${"<div class='note-line'></div>".repeat(10)}</div>
        ${footer}
      </div>`);
    }

    // ── MATCH PREP ──
    if (report_type === "match_prep") {
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">🔍</span> Gegner-Profil: ${awayTeam}</h2>
        ${ai.opponent_profile ? `<div class="summary-card full"><p style="font-size:11px;line-height:1.6">${ai.opponent_profile}</p></div>` : ""}
        <div class="swot-grid" style="margin-top:10px">
          <div class="swot-col strengths"><h4>✅ Stärken</h4>${(ai.opponent_strengths ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}</div>
          <div class="swot-col weaknesses"><h4>⚠️ Schwächen</h4>${(ai.opponent_weaknesses ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}</div>
        </div>
        <h3 style="margin-top:12px">Taktische Anpassungen</h3>
        ${(ai.tactical_adjustments ?? []).map((a: string, i: number) => `<div class="takeaway"><span class="takeaway-num">${i + 1}</span><span style="font-size:10px">${a}</span></div>`).join("")}
        <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="background:#f0fdf4;padding:8px;border-radius:6px"><h4 style="font-size:11px">✅ Do's</h4><ul class="do-list">${(ai.dos ?? []).map((d: string) => `<li>${d}</li>`).join("")}</ul></div>
          <div style="background:#fef2f2;padding:8px;border-radius:6px"><h4 style="font-size:11px">❌ Don'ts</h4><ul class="dont-list">${(ai.donts ?? []).map((d: string) => `<li>${d}</li>`).join("")}</ul></div>
        </div>
        <div class="notes-area"><div class="notes-label">📝 Eigene Notizen</div>${"<div class='note-line'></div>".repeat(6)}</div>
        ${footer}
      </div>`);
    }

    // ── HALFTIME ──
    if (report_type === "halftime_tactics") {
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">⚡</span> Halbzeit-Taktikanalyse</h2>
        <div class="swot-grid">
          <div class="swot-col strengths"><h4>✅ Positiv</h4>${(ai.halftime_good ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}</div>
          <div class="swot-col weaknesses"><h4>⚠️ Verbesserung</h4>${(ai.halftime_bad ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}</div>
        </div>
        <h3 style="margin-top:12px">Taktische Anpassungen 2. Halbzeit</h3>
        ${(ai.tactical_adjustments ?? []).map((a: string, i: number) => `<div class="takeaway"><span class="takeaway-num">${i + 1}</span><span style="font-size:10px">${a}</span></div>`).join("")}
        ${(ai.sub_suggestions ?? []).length ? `<h3 style="margin-top:10px">Wechsel-Vorschläge</h3>${(ai.sub_suggestions ?? []).map((s: string) => `<div class="insight-card"><div class="insight-desc">${s}</div></div>`).join("")}` : ""}
        <div class="notes-area"><div class="notes-label">📝 Eigene Notizen</div>${"<div class='note-line'></div>".repeat(6)}</div>
        ${footer}
      </div>`);
    }

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${homeTeam} vs ${awayTeam} – ${rtLabels[report_type] ?? "Report"}</title>${css}</head><body>${pages.join("")}</body></html>`;

    return new Response(JSON.stringify({ html }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("generate-pdf-report error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
