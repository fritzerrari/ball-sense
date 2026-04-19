import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Helpers ───────────────────────────────────────────────────────────────
const sumStat = (arr: any[], k: string) => arr.reduce((s, p) => s + (Number(p[k]) || 0), 0);
const isMeaningful = (n: number | null | undefined): boolean => n != null && Number(n) > 0;

const ratingColor = (r: number | null | undefined) => {
  if (!r) return "#94a3b8";
  if (r >= 8) return "#16a34a";
  if (r >= 6.5) return "#2563eb";
  if (r >= 5) return "#ea580c";
  return "#dc2626";
};
const ratingBg = (r: number | null | undefined) => {
  if (!r) return "#f1f5f9";
  if (r >= 8) return "#dcfce7";
  if (r >= 6.5) return "#dbeafe";
  if (r >= 5) return "#fff7ed";
  return "#fef2f2";
};

const eventIcon = (t: string) => ({
  goal: "⚽", yellow_card: "🟨", red_card: "🟥", substitution: "🔄",
  shot_on_target: "🎯", corner: "📐", foul: "⚠️", free_kick: "🔵",
  penalty: "⭐", offside: "🚩", save: "🧤",
}[t] ?? "●");

const eventColor = (t: string) => ({
  goal: "#16a34a", yellow_card: "#eab308", red_card: "#dc2626",
  substitution: "#7c3aed", shot_on_target: "#2563eb", corner: "#0891b2",
  foul: "#ea580c", free_kick: "#0ea5e9", penalty: "#f59e0b", offside: "#94a3b8",
}[t] ?? "#64748b");

const eventLabel = (t: string) => ({
  goal: "Tor", yellow_card: "Gelb", red_card: "Rot", substitution: "Wechsel",
  shot_on_target: "Chance", corner: "Ecke", foul: "Foul", free_kick: "Freistoß",
  penalty: "Elfmeter", offside: "Abseits", save: "Parade",
}[t] ?? t);

const gradeColor = (g: string) => {
  const c: Record<string, string> = {
    "A+": "#15803d", A: "#16a34a", "A-": "#22c55e",
    "B+": "#1d4ed8", B: "#2563eb", "B-": "#3b82f6",
    "C+": "#c2410c", C: "#ea580c", "C-": "#f97316",
    D: "#dc2626", F: "#991b1b",
  };
  return c[g] ?? "#94a3b8";
};

// ─── SVG charts ────────────────────────────────────────────────────────────

/** Hero KPI ring (conic-gradient look) */
const ringSVG = (pct: number, label: string, sub: string, color = "#2563eb"): string => {
  const radius = 32, circ = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * circ;
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="6"/>
      <circle cx="40" cy="40" r="${radius}" fill="none" stroke="${color}" stroke-width="6"
        stroke-dasharray="${dash} ${circ}" stroke-linecap="round"
        transform="rotate(-90 40 40)"/>
      <text x="40" y="44" text-anchor="middle" font-size="16" font-weight="800" fill="#0f172a">${pct}%</text>
    </svg>
    <div style="text-align:center"><div style="font-size:9.5px;font-weight:700;color:#334155">${label}</div>
    <div style="font-size:8px;color:#94a3b8">${sub}</div></div>
  </div>`;
};

/** Compact bar comparison row, home left blue, away right red */
const compBar = (label: string, hv: string | number, av: string | number, hN?: number, aN?: number): string => {
  const h = hN ?? (parseFloat(String(hv)) || 0);
  const a = aN ?? (parseFloat(String(av)) || 0);
  const t = h + a || 1;
  const hp = Math.round((h / t) * 100);
  return `<div style="display:flex;align-items:center;gap:6px;margin:4px 0">
    <span style="width:90px;font-size:9px;font-weight:600;text-align:right;color:#64748b">${label}</span>
    <span style="width:46px;font-size:10.5px;font-weight:800;text-align:right;color:#2563eb">${hv}</span>
    <div style="flex:1;display:flex;height:14px;border-radius:3px;overflow:hidden;background:#f1f5f9">
      <div style="width:${hp}%;background:linear-gradient(90deg,#3b82f6,#2563eb)"></div>
      <div style="width:${100 - hp}%;background:linear-gradient(90deg,#dc2626,#ef4444)"></div>
    </div>
    <span style="width:46px;font-size:10.5px;font-weight:800;text-align:left;color:#dc2626">${av}</span>
  </div>`;
};

/** Horizontal event timeline (0–90+ minutes) — pure SVG */
const eventTimelineSVG = (events: any[]): string => {
  if (!events.length) return "";
  const W = 720, H = 130, padX = 30, padY = 30;
  const maxMin = Math.max(95, ...events.map((e: any) => e.minute || 0));
  const xFor = (m: number) => padX + ((m / maxMin) * (W - 2 * padX));

  // Phase backgrounds
  const half1End = xFor(45), full = xFor(maxMin);
  const phaseBg = `
    <rect x="${padX}" y="${padY}" width="${half1End - padX}" height="${H - 2 * padY}" fill="#f0f9ff" rx="4"/>
    <rect x="${half1End}" y="${padY}" width="${full - half1End}" height="${H - 2 * padY}" fill="#fffbeb" rx="4"/>
    <text x="${(padX + half1End) / 2}" y="${padY - 4}" text-anchor="middle" font-size="9" fill="#0369a1" font-weight="700">1. Halbzeit</text>
    <text x="${(half1End + full) / 2}" y="${padY - 4}" text-anchor="middle" font-size="9" fill="#a16207" font-weight="700">2. Halbzeit</text>
  `;

  // Center axis with minute ticks
  const cy = H / 2;
  const ticks = [15, 30, 45, 60, 75, 90].filter(m => m <= maxMin).map(m =>
    `<line x1="${xFor(m)}" y1="${cy - 3}" x2="${xFor(m)}" y2="${cy + 3}" stroke="#94a3b8" stroke-width="1"/>
     <text x="${xFor(m)}" y="${H - 4}" text-anchor="middle" font-size="8" fill="#94a3b8">${m}'</text>`
  ).join("");

  const axis = `<line x1="${padX}" y1="${cy}" x2="${full}" y2="${cy}" stroke="#cbd5e1" stroke-width="1.5"/>${ticks}`;

  // Events as colored dots above (home) / below (away) the axis
  const dots = events.map((e: any) => {
    const x = xFor(e.minute);
    const isHome = e.team === "home";
    const y = isHome ? cy - 16 : cy + 16;
    const color = eventColor(e.event_type);
    const isBig = e.event_type === "goal" || e.event_type === "red_card";
    const r = isBig ? 7 : 5;
    return `<g>
      <line x1="${x}" y1="${cy}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="1" opacity="0.4"/>
      <circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <text x="${x}" y="${y + 2.5}" text-anchor="middle" font-size="${isBig ? 8 : 6}" fill="#fff" font-weight="700">${e.event_type === "goal" ? "⚽" : e.event_type === "red_card" ? "R" : e.event_type === "yellow_card" ? "Y" : ""}</text>
    </g>`;
  }).join("");

  // Side labels
  const sideLabels = `
    <text x="${padX - 4}" y="${cy - 18}" text-anchor="end" font-size="8" fill="#2563eb" font-weight="700">HEIM</text>
    <text x="${padX - 4}" y="${cy + 22}" text-anchor="end" font-size="8" fill="#dc2626" font-weight="700">GAST</text>
  `;

  return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="margin:8px 0">
    ${phaseBg}${axis}${sideLabels}${dots}
  </svg>`;
};

/** Momentum curve SVG — smoothed line per team */
const momentumCurveSVG = (events: any[]): string => {
  if (!events.length) return "";
  const W = 720, H = 140, padX = 36, padY = 24;
  const maxMin = Math.max(90, ...events.map(e => e.minute || 0));

  // Compute momentum per 5-min bucket: +score for goals/shots, -score for fouls/cards
  const buckets: { min: number; home: number; away: number }[] = [];
  for (let m = 0; m <= maxMin; m += 5) buckets.push({ min: m, home: 0, away: 0 });
  events.forEach((e: any) => {
    const idx = Math.min(buckets.length - 1, Math.floor((e.minute || 0) / 5));
    const w = e.event_type === "goal" ? 5 : e.event_type === "shot_on_target" ? 3 : e.event_type === "corner" ? 1.5 : e.event_type === "yellow_card" ? -1 : e.event_type === "red_card" ? -3 : e.event_type === "foul" ? -0.5 : 1;
    if (e.team === "home") buckets[idx].home += w; else buckets[idx].away += w;
  });

  // Smooth running totals so the line breathes
  let hSum = 0, aSum = 0;
  const series = buckets.map(b => {
    hSum = hSum * 0.7 + b.home;
    aSum = aSum * 0.7 + b.away;
    return { min: b.min, h: hSum, a: aSum };
  });
  const maxAbs = Math.max(2, ...series.map(s => Math.max(Math.abs(s.h), Math.abs(s.a))));

  const xFor = (m: number) => padX + (m / maxMin) * (W - 2 * padX);
  const yFor = (v: number) => H / 2 - (v / maxAbs) * (H / 2 - padY);

  const homePath = series.map((s, i) => `${i === 0 ? "M" : "L"}${xFor(s.min)},${yFor(s.h)}`).join(" ");
  const awayPath = series.map((s, i) => `${i === 0 ? "M" : "L"}${xFor(s.min)},${yFor(s.a)}`).join(" ");

  // Area fill helper
  const homeArea = `${homePath} L${xFor(series[series.length - 1].min)},${H / 2} L${xFor(series[0].min)},${H / 2} Z`;
  const awayArea = `${awayPath} L${xFor(series[series.length - 1].min)},${H / 2} L${xFor(series[0].min)},${H / 2} Z`;

  const minTicks = [0, 15, 30, 45, 60, 75, 90].filter(m => m <= maxMin);
  const ticks = minTicks.map(m =>
    `<line x1="${xFor(m)}" y1="${padY}" x2="${xFor(m)}" y2="${H - padY}" stroke="#e2e8f0" stroke-width="0.5"/>
     <text x="${xFor(m)}" y="${H - 6}" text-anchor="middle" font-size="8" fill="#94a3b8">${m}'</text>`
  ).join("");

  const halftime = xFor(45);

  return `<svg width="100%" viewBox="0 0 ${W} ${H}">
    <line x1="${padX}" y1="${H / 2}" x2="${W - padX}" y2="${H / 2}" stroke="#cbd5e1" stroke-width="1"/>
    ${ticks}
    <line x1="${halftime}" y1="${padY}" x2="${halftime}" y2="${H - padY}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="3,3"/>
    <text x="${halftime}" y="${padY - 4}" text-anchor="middle" font-size="8" fill="#f59e0b" font-weight="700">HZ</text>
    <path d="${homeArea}" fill="#2563eb" opacity="0.18"/>
    <path d="${awayArea}" fill="#dc2626" opacity="0.18"/>
    <path d="${homePath}" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/>
    <path d="${awayPath}" fill="none" stroke="#dc2626" stroke-width="2" stroke-linejoin="round"/>
    <text x="${padX + 4}" y="${padY + 10}" font-size="9" fill="#2563eb" font-weight="700">▲ HEIM dominiert</text>
    <text x="${padX + 4}" y="${H - padY - 4}" font-size="9" fill="#dc2626" font-weight="700">▼ GAST dominiert</text>
  </svg>`;
};

/** Tactical radar chart (6 axes) */
const tacticalRadarSVG = (grades: Record<string, any>): string => {
  const dims = [
    { key: "pressing", label: "Pressing" },
    { key: "build_up", label: "Spielaufbau" },
    { key: "defense", label: "Defensive" },
    { key: "transitions", label: "Umschaltspiel" },
    { key: "set_pieces", label: "Standards" },
    { key: "space_control", label: "Raumkontrolle" },
  ];
  const W = 280, H = 280, cx = W / 2, cy = H / 2;
  const maxR = 95;
  const grade2Num = (g: string): number => {
    if (!g) return 0;
    const map: Record<string, number> = { "A+": 10, A: 9, "A-": 8.5, "B+": 8, B: 7, "B-": 6.5, "C+": 6, C: 5, "C-": 4.5, D: 3, F: 1.5 };
    return map[g] ?? 5;
  };
  const angle = (i: number) => (-Math.PI / 2) + (i * 2 * Math.PI / dims.length);

  // Background rings
  const rings = [2, 4, 6, 8, 10].map(v => {
    const r = (v / 10) * maxR;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="0.5"/>`;
  }).join("");

  // Axis lines + labels
  const axes = dims.map((d, i) => {
    const a = angle(i);
    const x = cx + Math.cos(a) * maxR;
    const y = cy + Math.sin(a) * maxR;
    const lx = cx + Math.cos(a) * (maxR + 18);
    const ly = cy + Math.sin(a) * (maxR + 14) + 3;
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#cbd5e1" stroke-width="0.5"/>
            <text x="${lx}" y="${ly}" text-anchor="middle" font-size="9" font-weight="700" fill="#475569">${d.label}</text>`;
  }).join("");

  // Data polygon
  const points = dims.map((d, i) => {
    const v = grade2Num(grades[d.key]?.grade ?? grades[d.key]);
    const r = (v / 10) * maxR;
    const a = angle(i);
    return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
  }).join(" ");

  const dots = dims.map((d, i) => {
    const v = grade2Num(grades[d.key]?.grade ?? grades[d.key]);
    const r = (v / 10) * maxR;
    const a = angle(i);
    return `<circle cx="${cx + Math.cos(a) * r}" cy="${cy + Math.sin(a) * r}" r="3" fill="#2563eb" stroke="#fff" stroke-width="1.5"/>`;
  }).join("");

  return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="max-width:280px;display:block;margin:0 auto">
    ${rings}${axes}
    <polygon points="${points}" fill="#2563eb" fill-opacity="0.2" stroke="#2563eb" stroke-width="2"/>
    ${dots}
  </svg>`;
};

/** Player position pitch (top-down SVG) */
const pitchSVG = (lineups: any[], formation: string | null, side: "home" | "away"): string => {
  const W = 320, H = 380, color = side === "home" ? "#2563eb" : "#dc2626";
  const players = lineups.filter((l: any) => l.team === side && l.starting);
  if (!players.length) return "";

  // Compute positions from formation string like "4-4-2" or "4-3-3"
  const parts = (formation || "4-4-2").split("-").map(Number).filter(n => n > 0 && n < 8);
  const totalLineRows = parts.length + 1; // +1 for keeper
  // Vertical levels — keeper at bottom (high y), strikers at top
  const yLevels = [0.92]; // keeper
  for (let i = 0; i < parts.length; i++) {
    yLevels.push(0.78 - (i * (0.66 / Math.max(1, parts.length - 1))));
  }

  // Build [{x, y}] positions
  const positions: { x: number; y: number }[] = [];
  positions.push({ x: 0.5, y: yLevels[0] }); // keeper
  parts.forEach((cnt, lineIdx) => {
    const y = yLevels[lineIdx + 1] ?? 0.5;
    for (let i = 0; i < cnt; i++) {
      const x = (i + 1) / (cnt + 1);
      positions.push({ x, y });
    }
  });

  // Pitch background
  const pitch = `
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#grad)" rx="8"/>
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#22c55e" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="#16a34a" stop-opacity="0.95"/>
      </linearGradient>
      <pattern id="stripes" x="0" y="0" width="${W}" height="40" patternUnits="userSpaceOnUse">
        <rect width="${W}" height="20" fill="rgba(255,255,255,0.04)"/>
      </pattern>
    </defs>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#stripes)"/>
    <rect x="8" y="8" width="${W - 16}" height="${H - 16}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2" rx="2"/>
    <line x1="8" y1="${H / 2}" x2="${W - 8}" y2="${H / 2}" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
    <circle cx="${W / 2}" cy="${H / 2}" r="34" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
    <rect x="${W / 2 - 60}" y="${H - 50}" width="120" height="42" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
    <rect x="${W / 2 - 30}" y="${H - 24}" width="60" height="16" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
    <rect x="${W / 2 - 60}" y="8" width="120" height="42" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
    <rect x="${W / 2 - 30}" y="8" width="60" height="16" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
  `;

  const dots = players.map((p: any, i: number) => {
    const pos = positions[i] ?? { x: 0.5, y: 0.5 };
    const px = pos.x * W;
    const py = pos.y * H;
    const num = p.shirt_number ?? "";
    const name = (p.player_name ?? "").split(" ").pop()?.slice(0, 8) ?? "";
    return `<g>
      <circle cx="${px}" cy="${py}" r="14" fill="${color}" stroke="#fff" stroke-width="2"/>
      <text x="${px}" y="${py + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">${num}</text>
      <text x="${px}" y="${py + 26}" text-anchor="middle" font-size="8" font-weight="700" fill="#fff" style="paint-order:stroke;stroke:rgba(0,0,0,0.5);stroke-width:2;stroke-linejoin:round">${name}</text>
    </g>`;
  }).join("");

  return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="max-width:320px;display:block;margin:0 auto">${pitch}${dots}</svg>`;
};

/** Position-group bar chart (Defense / Midfield / Attack) */
const positionBarsSVG = (groups: any[]): string => {
  if (!groups?.length) return "";
  const grade2Num = (g: string): number => {
    const map: Record<string, number> = { "A+": 10, A: 9, "A-": 8.5, "B+": 8, B: 7, "B-": 6.5, "C+": 6, C: 5, "C-": 4.5, D: 3, F: 1.5 };
    return map[g] ?? 5;
  };
  const W = 600, barH = 48, padX = 110, padY = 14;
  const H = padY * 2 + groups.length * (barH + 8);
  const maxBar = W - padX - 30;

  const rows = groups.map((g: any, i: number) => {
    const v = grade2Num(g.grade);
    const w = (v / 10) * maxBar;
    const color = gradeColor(g.grade);
    const y = padY + i * (barH + 8);
    return `
      <text x="${padX - 10}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="11" font-weight="700" fill="#334155">${g.group}</text>
      <rect x="${padX}" y="${y}" width="${maxBar}" height="${barH}" fill="#f1f5f9" rx="6"/>
      <rect x="${padX}" y="${y}" width="${w}" height="${barH}" fill="${color}" rx="6"/>
      <text x="${padX + w - 10}" y="${y + barH / 2 + 5}" text-anchor="end" font-size="14" font-weight="800" fill="#fff">${g.grade}</text>
      <text x="${padX + 8}" y="${y + barH / 2 + 4}" font-size="9" fill="rgba(255,255,255,0.85)">${(g.summary ?? "").slice(0, 70)}</text>
    `;
  }).join("");

  return `<svg width="100%" viewBox="0 0 ${W} ${H}">${rows}</svg>`;
};

/** Heatmap pitch (10x6 grid from heatmap_grid data) */
const heatmapSVG = (heatGrids: any[]): string => {
  if (!heatGrids.length) return "";
  // Aggregate all player heatmaps into one team grid
  const cols = 10, rows = 6;
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(0));
  let max = 0;
  heatGrids.forEach((g: any) => {
    if (Array.isArray(g)) {
      for (let r = 0; r < Math.min(rows, g.length); r++) {
        const row = g[r];
        if (!Array.isArray(row)) continue;
        for (let c = 0; c < Math.min(cols, row.length); c++) {
          grid[r][c] += Number(row[c]) || 0;
          if (grid[r][c] > max) max = grid[r][c];
        }
      }
    }
  });
  if (max === 0) return "";

  const W = 480, H = 290, cellW = W / cols, cellH = H / rows;
  const cells = grid.flatMap((row, r) =>
    row.map((v, c) => {
      const intensity = v / max;
      if (intensity < 0.05) return "";
      const opacity = Math.min(0.85, 0.15 + intensity * 0.7);
      return `<rect x="${c * cellW}" y="${r * cellH}" width="${cellW}" height="${cellH}" fill="rgb(${Math.round(220 - intensity * 180)},${Math.round(60 + intensity * 40)},${Math.round(38)})" opacity="${opacity}"/>`;
    })
  ).join("");

  return `<svg width="100%" viewBox="0 0 ${W} ${H}" style="border-radius:8px;border:1px solid #e2e8f0;background:#15803d">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#16a34a"/>
    ${cells}
    <rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.5" rx="2"/>
    <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="rgba(255,255,255,0.35)"/>
    <circle cx="${W / 2}" cy="${H / 2}" r="36" fill="none" stroke="rgba(255,255,255,0.35)"/>
  </svg>`;
};

// ─── Main handler ──────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
      .eq("id", match_id).single();

    const [sectionsRes, recRes, evtRes, tsRes, hpsRes, apsRes, luRes] = await Promise.all([
      supabase.from("report_sections").select("*").eq("match_id", match_id).order("sort_order"),
      supabase.from("training_recommendations").select("*").eq("match_id", match_id).order("priority"),
      supabase.from("match_events").select("*").eq("match_id", match_id).order("minute"),
      supabase.from("team_match_stats").select("*").eq("match_id", match_id),
      supabase.from("player_match_stats").select("*, players(name, number, position)").eq("match_id", match_id).eq("team", "home").order("rating", { ascending: false }),
      supabase.from("player_match_stats").select("*, players(name, number, position)").eq("match_id", match_id).eq("team", "away").order("rating", { ascending: false }),
      supabase.from("match_lineups").select("*").eq("match_id", match_id).order("team").order("starting", { ascending: false }),
    ]);

    const sections = sectionsRes.data ?? [];
    const trainingRecs = recRes.data ?? [];
    const matchEvents = evtRes.data ?? [];
    const teamStats = tsRes.data ?? [];
    const homePS = hpsRes.data ?? [];
    const awayPS = apsRes.data ?? [];
    const lineups = luRes.data ?? [];

    let prepData: any = null;
    if ((report_type === "match_prep" || report_type === "halftime_tactics") && match?.home_club_id) {
      const oppName = opponentName || match?.away_club_name;
      if (oppName) {
        const { data: prep } = await supabase
          .from("match_preparations").select("*")
          .eq("club_id", match.home_club_id).eq("opponent_name", oppName)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        prepData = prep;
      }
    }

    const ps = (type: string) => {
      const s = sections.find((s: any) => s.section_type === type);
      if (!s) return null;
      try { return JSON.parse(s.content); } catch { return s.content; }
    };

    const homeTeam = clubName || match?.home_club?.name || "Heim";
    const awayTeam = match?.away_club_name || "Gegner";
    const matchDate = match?.date
      ? new Date(match.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : "";
    const scoreDisplay = match?.home_score != null && match?.away_score != null
      ? `${match.home_score} : ${match.away_score}` : "– : –";
    const homeStats = teamStats.find((s: any) => s.team === "home");
    const awayStats = teamStats.find((s: any) => s.team === "away");

    const tacticalGrades = ps("tactical_grades");
    const summary = ps("summary");
    const matchRating = ps("match_rating");
    const playerSpotlight = ps("player_spotlight");
    const opponentDna = ps("opponent_dna");
    const trainingMicro = ps("training_micro_cycle");
    const insights = sections.filter((s: any) => s.section_type === "insight").map((s: any) => {
      try { return { title: s.title, ...JSON.parse(s.content) }; }
      catch { return { title: s.title, description: s.content }; }
    });

    // ── Aggregate stats ──
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
    const hPoss = homeStats?.possession_pct ?? null;
    const aPoss = awayStats?.possession_pct ?? null;

    // Goals from events fallback (when player_match_stats are empty)
    const goalsFromEvents = matchEvents.filter((e: any) => e.event_type === "goal");
    const hGoalsFinal = hGoals || goalsFromEvents.filter((e: any) => e.team === "home").length;
    const aGoalsFinal = aGoals || goalsFromEvents.filter((e: any) => e.team === "away").length;

    // Detect data quality — what do we actually have?
    const hasPhysicalData = isMeaningful(homeStats?.total_distance_km) || isMeaningful(homeStats?.top_speed_kmh) || hSprints > 0;
    const hasShotData = hShots > 0 || aShots > 0 || matchEvents.some((e: any) => e.event_type === "shot_on_target");
    const hasPossessionData = isMeaningful(hPoss) && hPoss !== 50; // 50/50 = no data
    const hasPlayerRatings = homePS.some((p: any) => p.rating != null);
    const hasHomeLineup = lineups.some((l: any) => l.team === "home" && l.starting);
    const hasAwayLineup = lineups.some((l: any) => l.team === "away" && l.starting);
    const heatGrids = homePS.map((p: any) => p.heatmap_grid).filter((g: any) => Array.isArray(g) && g.length > 0);
    const hasHeatmap = heatGrids.length > 0;

    // ── AI: enriched analysis ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI gateway not configured");

    const compactData = {
      score: scoreDisplay, homeTeam, awayTeam, date: matchDate,
      homeFormation: match?.home_formation, awayFormation: match?.away_formation,
      summary, matchRating, tacticalGrades, playerSpotlight, opponentDna, insights,
      stats: {
        hPoss, aPoss, hGoals: hGoalsFinal, aGoals: aGoalsFinal,
        hShots, aShots, hSOT, aSOT, hPasses, aPasses, hPassAcc, aPassAcc,
        hDuelsW, aDuelsW, hFouls, aFouls, hSprints, aSprints,
        homeDistance: homeStats?.total_distance_km, homeTopSpeed: homeStats?.top_speed_kmh,
      },
      dataQuality: {
        hasPhysicalData, hasShotData, hasPossessionData,
        hasPlayerRatings, hasHomeLineup, hasAwayLineup, hasHeatmap,
        eventCount: matchEvents.length,
      },
      events: matchEvents.slice(0, 50).map((e: any) =>
        `${e.minute}' ${e.event_type} ${e.team} ${e.player_name ?? ""}`),
      homeTopPlayers: homePS.slice(0, 8).map((p: any) => ({
        name: p.players?.name, rating: p.rating, pos: p.players?.position,
        goals: p.goals, assists: p.assists,
        km: p.distance_km?.toFixed(1), sprints: p.sprint_count,
      })),
      awayTopPlayers: awayPS.slice(0, 5).map((p: any) => ({
        name: p.players?.name, rating: p.rating, pos: p.players?.position,
      })),
      trainingRecs: trainingRecs.slice(0, 5).map((t: any) => t.title),
      preparation: prepData?.preparation_data ?? null,
    };

    const rtLabels: Record<string, string> = {
      full_report: "Vollständiger Spielbericht",
      training_plan: "Trainingsplan",
      match_prep: "Spielvorbereitung",
      halftime_tactics: "Halbzeit-Taktik",
    };

    const aiPrompt = `Du bist ein Elite-Fußball-Analyst auf Champions-League-Niveau. Erstelle NUR valides JSON für "${rtLabels[report_type] ?? report_type}".

WICHTIG zu Datenqualität: Wenn dataQuality.hasPhysicalData=false, NIEMALS Distanz/Top-Speed/Sprints erwähnen. Wenn hasShotData=false, NIEMALS Schüsse als Datenpunkt nutzen — stattdessen auf Events (Tore/Karten/Ecken) und beobachtbare Muster fokussieren. Schreibe NUR datenbasierte Aussagen, keine Halluzinationen. Wenn die Datenlage dünn ist, sage es offen ("Bei dieser Datendichte lässt sich X nicht belastbar bewerten") statt zu erfinden.

Antworte tiefgründig, taktisch präzise und mit konkreten Beispielen aus den Daten. Keine generischen Phrasen.

{
  "executive_verdict": "1 prägnanter, journalistischer Satz wie ein Sky-Kommentator — die Essenz des Spiels",
  "management_summary": "5-7 Sätze: Gesamtbewertung mit konkreten Zahlen aus den Events, taktischer Einordnung. Benenne entscheidende Phasen mit Minuten.",
  "key_takeaways": ["5 präzise, datengestützte Erkenntnisse mit konkreten Minuten oder Zahlen"],
  "overall_grade": <Zahl 1-10>,
  "coach_recommendation": "3 Sätze: Konkrete Handlungsanweisung für den Trainer mit Begründung",

  "tactical_deep_dive": "5-8 Sätze: Detaillierte taktische Analyse basierend auf den ECHTEN Daten. Erkläre Pressingverhalten, Standardsituationen, Foulhäufung etc. — nur was die Daten hergeben.",
  "phase_analysis": { "first_15": "0-15 Min", "mid_first": "15-30 Min", "pre_halftime": "30-45 Min", "second_half_start": "45-60 Min", "mid_second": "60-75 Min", "final_phase": "75-90 Min" },
  "key_moments": [{"minute": <number>, "description": "Was passierte und warum es spielentscheidend war", "tactical_impact": "Auswirkung"}],

  "home_strengths": ["4 konkrete Stärken mit Bezug zu Events/Zahlen"],
  "home_weaknesses": ["4 konkrete Schwächen"],
  "opponent_strengths": ["3 Stärken"],
  "opponent_weaknesses": ["3 Schwächen"],
  "opponent_profile": "4 Sätze Gegner-Spielstil-Analyse",

  "mvp": {"name": "Spielername", "reason": "3 Sätze warum", "key_stats": "Kernzahlen"},
  "concern_player": {"name": "Spielername", "reason": "2 Sätze", "improvement": "Konkrete Verbesserung"},
  "position_group_analysis": [{"group": "Abwehr", "grade": "A-F", "summary": "1 Satz"}, {"group": "Mittelfeld", "grade": "A-F", "summary": "1 Satz"}, {"group": "Angriff", "grade": "A-F", "summary": "1 Satz"}],

  "momentum_narrative": "3 Sätze: Wann hatte welches Team die Kontrolle und warum",
  "risk_assessment": [{"risk": "Risiko", "severity": "hoch/mittel/gering", "mitigation": "Gegenmaßnahme"}],

  "coaching_insights": [{"title": "...", "description": "2-3 Sätze", "impact": <1-10>, "category": "Taktik/Fitness/Mental"}],
  "tactical_adjustments": ["5 konkrete Anpassungsvorschläge"],
  "set_piece_analysis": "2 Sätze: Standardsituations-Bewertung",

  "training_focus": [{"title": "...", "description": "3 Sätze mit Übungsbeschreibung", "intensity": "hoch/mittel/gering", "duration": "30-60 Min", "goal": "Trainingsziel"}],
  "weekly_plan": [{"day": "Tag+1/Tag+2/Tag+3", "theme": "...", "focus": "...", "intensity": "..."}],

  "conclusion": "5-7 Sätze: Ausführliches Fazit",
  "next_match_priorities": ["5 Prioritäten für das nächste Spiel"],
  "dos": ["4 Do's"], "donts": ["4 Don'ts"],
  "halftime_good": ["3 positive Aspekte"], "halftime_bad": ["3 negative Aspekte"],
  "sub_suggestions": ["2-3 Wechselvorschläge mit Begründung"],

  "data_quality_note": "Wenn die Datenlage dünn ist (z.B. keine Distanzdaten, keine Schüsse), formuliere hier 1-2 ehrliche Sätze für den Trainer dazu. Sonst leer lassen."
}

SPRACHE: Deutsch. NUR JSON. Keine Markdown-Formatierung.`;

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
      throw new Error(
        aiResponse.status === 429 ? "Rate limit — bitte später erneut versuchen" :
        aiResponse.status === 402 ? "Credits aufgebraucht" :
        `AI-Fehler: ${aiResponse.status}`,
      );
    }

    const aiResult = await aiResponse.json();
    let aiText = aiResult.choices?.[0]?.message?.content ?? "{}";
    aiText = aiText.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    let ai: any = {};
    try { ai = JSON.parse(aiText); } catch { console.error("AI JSON parse failed"); }

    // ─── CSS ───
    const css = `<style>
@page{size:A4;margin:14mm 16mm}
@media print{.page-break{page-break-before:always}}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;font-size:10.5px;line-height:1.5;color:#1e293b;background:#fff}

/* Cover */
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

/* Section headers */
h2{font-size:17px;font-weight:800;color:#0f172a;border-bottom:3px solid #2563eb;padding-bottom:6px;margin-bottom:14px;display:flex;align-items:center;gap:8px}
h2 .sec-icon{font-size:18px}
h3{font-size:13px;font-weight:700;color:#334155;margin:12px 0 6px}

/* Cards */
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
.card.highlight{background:linear-gradient(135deg,#eff6ff,#dbeafe);border-color:#93c5fd}
.card.success{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-color:#86efac}
.card.warning{background:linear-gradient(135deg,#fffbeb,#fef3c7);border-color:#fcd34d}
.card.danger{background:linear-gradient(135deg,#fef2f2,#fecaca);border-color:#fca5a5}

/* KPI cockpit */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.kpi-card{background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center;position:relative;overflow:hidden}
.kpi-card .kpi-bar{position:absolute;top:0;left:0;right:0;height:3px}
.kpi-icon{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 6px;font-size:17px}
.kpi-val{font-size:28px;font-weight:800;line-height:1;letter-spacing:-1px}
.kpi-label{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:3px}
.kpi-sub{font-size:8.5px;color:#94a3b8;margin-top:2px}

/* Rings row */
.rings-row{display:flex;justify-content:space-around;align-items:flex-start;margin:14px 0;padding:14px;background:#f8fafc;border-radius:10px}

/* Verdict box */
.verdict-box{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;padding:18px 24px;border-radius:10px;margin:8px 0 14px;text-align:center;font-size:14px;font-style:italic;line-height:1.6;position:relative}
.verdict-box::before{content:'\\201C';position:absolute;top:-10px;left:14px;font-size:50px;color:rgba(255,255,255,0.2);font-family:Georgia,serif}

/* Takeaway list */
.takeaway{display:flex;gap:8px;align-items:flex-start;margin:6px 0}
.takeaway-num{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800}
.takeaway-text{font-size:10.5px;line-height:1.55}

/* Phase grid */
.phase-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
.phase-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;border-left:3px solid #2563eb}
.phase-card .phase-time{font-size:10px;font-weight:800;color:#2563eb;margin-bottom:3px}
.phase-card .phase-text{font-size:9.5px;color:#475569;line-height:1.5}

/* Key moment */
.moment-card{display:flex;gap:10px;margin:6px 0;padding:10px;background:#f0f9ff;border-radius:6px;border-left:4px solid #2563eb}
.moment-min{flex-shrink:0;width:42px;height:42px;border-radius:50%;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800}
.moment-text{flex:1;font-size:10px}
.moment-text strong{display:block;font-size:11px;margin-bottom:2px;color:#0f172a}

/* Player table */
.player-table{width:100%;border-collapse:collapse;font-size:9.5px;margin:6px 0}
.player-table th{background:#0f172a;color:#fff;padding:6px 5px;text-align:left;font-weight:700;font-size:8.5px;text-transform:uppercase;letter-spacing:0.4px}
.player-table td{padding:5px;border-bottom:1px solid #e2e8f0}
.player-table tr:nth-child(even) td{background:#f8fafc}
.rating-cell{display:inline-block;padding:2px 8px;border-radius:8px;font-weight:800;font-size:10px;min-width:32px;text-align:center}

/* Spotlight */
.spotlight{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #86efac;border-radius:10px;padding:14px;margin:8px 0;position:relative;overflow:hidden}
.spotlight::before{content:'';position:absolute;top:-20px;right:-20px;width:80px;height:80px;background:rgba(34,197,94,0.1);border-radius:50%}
.spotlight.concern{background:linear-gradient(135deg,#fef2f2,#fecaca);border-color:#fca5a5}
.spotlight.concern::before{background:rgba(220,38,38,0.1)}
.spotlight-tag{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px}
.spotlight.success .spotlight-tag,.spotlight:not(.concern) .spotlight-tag{color:#16a34a}
.spotlight.concern .spotlight-tag{color:#dc2626}
.spotlight-name{font-size:16px;font-weight:800;color:#0f172a;margin-bottom:6px;position:relative}
.spotlight-reason{font-size:10.5px;color:#334155;line-height:1.55;position:relative}
.spotlight-stats{font-size:9.5px;font-weight:700;margin-top:6px;color:#16a34a;position:relative}

/* SWOT */
.swot-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.swot-col{padding:11px;border-radius:8px}
.swot-col.strengths{background:#f0fdf4;border:1px solid #bbf7d0}
.swot-col.weaknesses{background:#fef2f2;border:1px solid #fecaca}
.swot-col h4{font-size:11px;margin-bottom:6px;font-weight:800}
.swot-item{margin:4px 0;font-size:10px;line-height:1.45}

/* Insight cards */
.insight-card{background:#f8fafc;border-left:4px solid #2563eb;padding:9px 11px;margin:6px 0;border-radius:0 6px 6px 0;position:relative}
.insight-card .insight-title{font-weight:800;font-size:11px;margin-bottom:2px}
.insight-card .insight-desc{font-size:10px;color:#475569;line-height:1.55}
.insight-card .impact{position:absolute;top:9px;right:9px;background:#2563eb;color:#fff;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:800}
.insight-card .insight-cat{display:inline-block;background:#e2e8f0;padding:1px 7px;border-radius:4px;font-size:8.5px;color:#475569;margin-top:4px;font-weight:600}

/* Risk table */
.risk-table{width:100%;border-collapse:collapse;font-size:9.5px;margin:6px 0}
.risk-table th{background:#fef2f2;padding:6px;text-align:left;font-weight:700;border-bottom:2px solid #fecaca}
.risk-table td{padding:6px;border-bottom:1px solid #f1f5f9}
.risk-high{color:#dc2626;font-weight:800}.risk-med{color:#ea580c;font-weight:800}.risk-low{color:#16a34a;font-weight:800}

/* Training */
.training-card{background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border:1px solid #bae6fd;border-radius:8px;padding:11px;margin:6px 0}
.training-card .tc-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px}
.training-card .tc-title{font-weight:800;font-size:12px;color:#0c4a6e}
.training-card .tc-meta{font-size:9px;color:#0369a1;font-weight:600}
.training-card .tc-goal{font-size:9.5px;color:#0891b2;font-style:italic;margin-top:4px;font-weight:600}

/* Weekly */
.weekly-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0}
.day-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:9px;text-align:center}
.day-card .day-name{font-size:11px;font-weight:800;color:#2563eb;margin-bottom:4px}
.day-card .day-theme{font-size:10px;font-weight:700;margin-bottom:3px;color:#0f172a}
.day-card .day-focus{font-size:9px;color:#64748b;line-height:1.4}
.day-card .day-intensity{display:inline-block;margin-top:4px;padding:2px 8px;border-radius:5px;font-size:8.5px;font-weight:700}
.day-intensity.hoch{background:#fecaca;color:#dc2626}
.day-intensity.mittel{background:#fed7aa;color:#ea580c}
.day-intensity.gering{background:#bbf7d0;color:#16a34a}

/* Event chronicle */
.event-chronicle{margin:8px 0}
.event-row{display:grid;grid-template-columns:60px 32px 1fr;gap:8px;padding:6px 8px;border-bottom:1px solid #f1f5f9;align-items:center}
.event-row:hover{background:#f8fafc}
.event-row.home{background:#eff6ff}.event-row.away{background:#fef2f2}
.event-min{font-size:11px;font-weight:800;font-family:'SF Mono',monospace;color:#0f172a}
.event-icon{font-size:14px;text-align:center}
.event-detail{font-size:10px}
.event-detail .ev-type{font-weight:700}
.event-detail .ev-team{font-size:9px;color:#64748b;margin-left:4px}

/* Data quality banner */
.dq-banner{background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:8px 12px;margin:8px 0;font-size:10px;color:#78350f;display:flex;gap:8px;align-items:flex-start}

/* Notes & footer */
.notes-area{margin-top:14px;padding-top:8px;border-top:1px dashed #cbd5e1}
.notes-label{font-size:9px;color:#94a3b8;margin-bottom:4px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
.note-line{border-bottom:1px dotted #cbd5e1;height:22px;margin:1px 0}
.page-footer{text-align:center;font-size:8px;color:#94a3b8;margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0}

/* Lineup row (textual fallback) */
.lineup-row{display:flex;align-items:center;gap:8px;font-size:10px;margin:3px 0;padding:4px}
.lineup-num{display:inline-block;width:24px;height:24px;border-radius:50%;color:#fff;text-align:center;line-height:24px;font-size:9.5px;font-weight:800}
.lineup-num.home{background:#2563eb}.lineup-num.away{background:#dc2626}

/* Two-column layout helper */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}
</style>`;

    // ─── Build pages ───
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
      const og = ai.overall_grade ?? matchRating?.overall ?? 0;
      const dataQualityNote = ai.data_quality_note;

      // 2. EXECUTIVE SUMMARY (Management Summary FIRST — moved to front)
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">🎯</span> Management Summary</h2>
        ${ai.executive_verdict ? `<div class="verdict-box">„${ai.executive_verdict}"</div>` : ""}
        ${dataQualityNote ? `<div class="dq-banner"><span style="font-size:14px">ℹ️</span><div><strong>Datenqualitäts-Hinweis:</strong> ${dataQualityNote}</div></div>` : ""}
        <div class="two-col">
          <div class="card" style="text-align:center">
            <div style="font-size:9px;color:#64748b;font-weight:700;letter-spacing:1px">ERGEBNIS</div>
            <div style="font-size:48px;font-weight:800;color:#0f172a;line-height:1;margin:6px 0">${scoreDisplay}</div>
            <div style="font-size:10px;color:#94a3b8">${homeTeam.slice(0, 18)} vs ${awayTeam.slice(0, 18)}</div>
          </div>
          <div class="card highlight" style="text-align:center">
            <div style="font-size:9px;color:#64748b;font-weight:700;letter-spacing:1px">GESAMTNOTE</div>
            <div style="font-size:48px;font-weight:800;color:${ratingColor(Number(og))};line-height:1;margin:6px 0">${og}</div>
            <div style="font-size:10px;color:#94a3b8">von 10 Punkten</div>
          </div>
        </div>
        <div class="card" style="margin-top:12px">
          <h3>Analyse</h3>
          <p style="font-size:11px;line-height:1.7">${ai.management_summary ?? summary ?? "Keine Zusammenfassung verfügbar."}</p>
        </div>
        <div class="card" style="margin-top:10px">
          <h3>Top-Erkenntnisse</h3>
          ${(ai.key_takeaways ?? []).slice(0, 5).map((t: string, i: number) =>
            `<div class="takeaway"><span class="takeaway-num">${i + 1}</span><span class="takeaway-text">${t}</span></div>`).join("")}
        </div>
        ${ai.coach_recommendation ? `<div class="card highlight" style="margin-top:10px">
          <h3>💡 Trainer-Empfehlung</h3>
          <p style="font-size:11px;font-weight:500;line-height:1.65">${ai.coach_recommendation}</p>
        </div>` : ""}
        ${footer}
      </div>`);

      // 3. PERFORMANCE COCKPIT — only show meaningful KPIs
      const kpis: string[] = [];
      kpis.push(`<div class="kpi-card">
        <div class="kpi-bar" style="background:${ratingColor(Number(og))}"></div>
        <div class="kpi-icon" style="background:${ratingColor(Number(og))}15;color:${ratingColor(Number(og))}">📊</div>
        <div class="kpi-val" style="color:${ratingColor(Number(og))}">${og}</div>
        <div class="kpi-label">Gesamtnote</div>
        <div class="kpi-sub">von 10 Punkten</div>
      </div>`);

      if (hasShotData && hShots > 0) {
        const conv = Math.round((hGoalsFinal / hShots) * 100);
        kpis.push(`<div class="kpi-card">
          <div class="kpi-bar" style="background:#16a34a"></div>
          <div class="kpi-icon" style="background:#16a34a15;color:#16a34a">⚽</div>
          <div class="kpi-val" style="color:#16a34a">${conv}%</div>
          <div class="kpi-label">Chancenverwertung</div>
          <div class="kpi-sub">${hGoalsFinal} Tore / ${hShots} Schüsse</div>
        </div>`);
      } else if (hGoalsFinal + aGoalsFinal > 0) {
        kpis.push(`<div class="kpi-card">
          <div class="kpi-bar" style="background:#16a34a"></div>
          <div class="kpi-icon" style="background:#16a34a15;color:#16a34a">⚽</div>
          <div class="kpi-val" style="color:#16a34a">${hGoalsFinal}:${aGoalsFinal}</div>
          <div class="kpi-label">Tore</div>
          <div class="kpi-sub">aus dem Spiel heraus</div>
        </div>`);
      }

      if (hasPhysicalData && isMeaningful(homeStats?.total_distance_km)) {
        kpis.push(`<div class="kpi-card">
          <div class="kpi-bar" style="background:#2563eb"></div>
          <div class="kpi-icon" style="background:#2563eb15;color:#2563eb">🏃</div>
          <div class="kpi-val" style="color:#2563eb">${homeStats!.total_distance_km!.toFixed(1)}</div>
          <div class="kpi-label">Laufleistung</div>
          <div class="kpi-sub">km Gesamtdistanz</div>
        </div>`);
      } else {
        // Use event count as fallback KPI
        kpis.push(`<div class="kpi-card">
          <div class="kpi-bar" style="background:#7c3aed"></div>
          <div class="kpi-icon" style="background:#7c3aed15;color:#7c3aed">📋</div>
          <div class="kpi-val" style="color:#7c3aed">${matchEvents.length}</div>
          <div class="kpi-label">Events erfasst</div>
          <div class="kpi-sub">Tore, Karten, Ecken…</div>
        </div>`);
      }

      if (hasPhysicalData && isMeaningful(homeStats?.top_speed_kmh)) {
        kpis.push(`<div class="kpi-card">
          <div class="kpi-bar" style="background:#ea580c"></div>
          <div class="kpi-icon" style="background:#ea580c15;color:#ea580c">⚡</div>
          <div class="kpi-val" style="color:#ea580c">${homeStats!.top_speed_kmh!.toFixed(1)}</div>
          <div class="kpi-label">Top-Speed</div>
          <div class="kpi-sub">km/h Höchstgeschw.</div>
        </div>`);
      } else if (matchEvents.filter((e: any) => e.event_type === "corner").length > 0) {
        const corners = matchEvents.filter((e: any) => e.event_type === "corner" && e.team === "home").length;
        kpis.push(`<div class="kpi-card">
          <div class="kpi-bar" style="background:#0891b2"></div>
          <div class="kpi-icon" style="background:#0891b215;color:#0891b2">📐</div>
          <div class="kpi-val" style="color:#0891b2">${corners}</div>
          <div class="kpi-label">Eigene Ecken</div>
          <div class="kpi-sub">erspielt</div>
        </div>`);
      } else {
        const fouls = matchEvents.filter((e: any) => e.event_type === "foul").length;
        kpis.push(`<div class="kpi-card">
          <div class="kpi-bar" style="background:#ea580c"></div>
          <div class="kpi-icon" style="background:#ea580c15;color:#ea580c">⚠️</div>
          <div class="kpi-val" style="color:#ea580c">${fouls}</div>
          <div class="kpi-label">Fouls gesamt</div>
          <div class="kpi-sub">beider Teams</div>
        </div>`);
      }

      // Build cockpit page
      let cockpit = `<div class="page page-break">
        <h2><span class="sec-icon">🎛️</span> Performance-Cockpit</h2>
        <div class="kpi-grid">${kpis.join("")}</div>`;

      // Rings only when we have meaningful data
      const rings: string[] = [];
      if (hasPossessionData) rings.push(ringSVG(Math.round(hPoss!), "Ballbesitz", `${homeTeam.slice(0, 12)}`, "#2563eb"));
      if (hPassT > 0) rings.push(ringSVG(hPassAcc, "Passquote", `${hPasses}/${hPassT} Pässe`, "#16a34a"));
      if (hDuelsT > 0) rings.push(ringSVG(Math.round((hDuelsW / hDuelsT) * 100), "Zweikampf-%", `${hDuelsW}/${hDuelsT}`, "#ea580c"));
      if (hShots > 0) rings.push(ringSVG(Math.round((hSOT / hShots) * 100), "Schuss-Präzision", `${hSOT}/${hShots} aufs Tor`, "#7c3aed"));

      if (rings.length > 0) {
        cockpit += `<div class="rings-row">${rings.join("")}</div>`;
      }

      // Top performers (only if rated)
      if (hasPlayerRatings) {
        const maxSprints = Math.max(...homePS.map((p: any) => p.sprint_count ?? 0), 1);
        const maxDist = Math.max(...homePS.map((p: any) => p.distance_km ?? 0), 1);
        cockpit += `<h3>Top-Performer (Bewertung)</h3>`;
        cockpit += homePS.slice(0, 5).map((p: any) => {
          const rt = p.rating ?? 0;
          return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0;padding:5px 8px;background:#f8fafc;border-radius:6px">
            <span style="width:24px;height:24px;border-radius:50%;background:${ratingBg(rt)};color:${ratingColor(rt)};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800">${rt?.toFixed(1) ?? "–"}</span>
            <span style="flex:1;font-size:10.5px;font-weight:600">${p.players?.name ?? "?"}</span>
            <span style="font-size:9px;color:#64748b">${p.players?.position ?? ""}</span>
            ${isMeaningful(p.distance_km) ? `<span style="font-size:9px;color:#16a34a;font-weight:600">${p.distance_km.toFixed(1)} km</span>` : ""}
            ${p.goals > 0 ? `<span style="font-size:9px">⚽×${p.goals}</span>` : ""}
            ${p.assists > 0 ? `<span style="font-size:9px">🅰×${p.assists}</span>` : ""}
          </div>`;
        }).join("");
      }
      cockpit += `${footer}</div>`;
      pages.push(cockpit);

      // 4. MOMENTUM CURVE + EVENT TIMELINE (visual-heavy page)
      if (matchEvents.length > 0) {
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">📈</span> Spielverlauf & Momentum</h2>
          <div class="card">
            <h3 style="margin-top:0">Momentum-Kurve (Druck-Verlauf)</h3>
            <p style="font-size:9.5px;color:#64748b;margin-bottom:6px">Aufsummierte Aktions-Intensität pro 5-Minuten-Fenster. Tore, Schüsse und Ecken zählen positiv, Fouls/Karten negativ.</p>
            ${momentumCurveSVG(matchEvents)}
          </div>
          <div class="card" style="margin-top:12px">
            <h3 style="margin-top:0">Event-Timeline</h3>
            <p style="font-size:9.5px;color:#64748b">Alle Spielereignisse chronologisch. Heim-Events oben, Gast-Events unten.</p>
            ${eventTimelineSVG(matchEvents)}
          </div>
          ${ai.momentum_narrative ? `<div class="card highlight" style="margin-top:12px">
            <h3 style="margin-top:0">📊 Narrativ</h3>
            <p style="font-size:10.5px;line-height:1.6">${ai.momentum_narrative}</p>
          </div>` : ""}
          ${footer}
        </div>`);
      }

      // 5. TACTICAL DEEP DIVE + PHASE
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">🔬</span> Taktische Tiefenanalyse</h2>
        <div class="card" style="margin-bottom:12px">
          <p style="font-size:11px;line-height:1.7">${ai.tactical_deep_dive ?? "Keine taktische Analyse verfügbar."}</p>
        </div>
        ${ai.set_piece_analysis ? `<div class="card warning" style="margin-bottom:12px">
          <h3 style="margin-top:0">⚽ Standardsituationen</h3>
          <p style="font-size:10.5px">${ai.set_piece_analysis}</p>
        </div>` : ""}
        <h3>Spielphasen-Analyse</h3>
        <div class="phase-grid">
          ${Object.entries(ai.phase_analysis ?? {}).filter(([_, v]) => v).map(([key, val]) => {
            const labels: Record<string, string> = {
              first_15: "0–15'", mid_first: "15–30'", pre_halftime: "30–45'",
              second_half_start: "45–60'", mid_second: "60–75'", final_phase: "75–90'",
            };
            return `<div class="phase-card"><div class="phase-time">${labels[key] ?? key}</div><div class="phase-text">${val}</div></div>`;
          }).join("")}
        </div>
        ${(ai.key_moments ?? []).length ? `<h3 style="margin-top:14px">⭐ Schlüsselmomente</h3>
          ${(ai.key_moments ?? []).map((m: any) => `<div class="moment-card">
            <div class="moment-min">${m.minute}'</div>
            <div class="moment-text"><strong>${m.description}</strong>
              ${m.tactical_impact ? `<span style="color:#64748b;display:block;margin-top:2px">${m.tactical_impact}</span>` : ""}
            </div>
          </div>`).join("")}` : ""}
        ${footer}
      </div>`);

      // 6. TACTICAL RADAR + POSITION GROUPS
      const tg = tacticalGrades ?? {};
      const hasGrades = Object.keys(tg).some(k => tg[k]?.grade || (typeof tg[k] === "string" && tg[k] !== "–"));
      if (hasGrades || (ai.position_group_analysis ?? []).length) {
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">🎯</span> Taktische Bewertung</h2>
          ${hasGrades ? `<div class="two-col" style="align-items:center">
            <div>
              <h3 style="margin-top:0">Taktik-Radar</h3>
              ${tacticalRadarSVG(tg)}
              <p style="font-size:9px;color:#94a3b8;text-align:center;margin-top:4px">Skala 0–10 entlang 6 taktischer Dimensionen</p>
            </div>
            <div>
              ${tg.summary ? `<div class="card"><p style="font-size:10.5px;line-height:1.6">${tg.summary}</p></div>` : ""}
            </div>
          </div>` : ""}
          ${(ai.position_group_analysis ?? []).length ? `<h3 style="margin-top:18px">Positionsgruppen</h3>
            ${positionBarsSVG(ai.position_group_analysis)}` : ""}
          ${footer}
        </div>`);
      }

      // 7. FORMATION & LINEUP (only when we have data)
      if (hasHomeLineup || hasAwayLineup) {
        const subs = lineups.filter((l: any) => l.team === "home" && !l.starting);
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">👥</span> Aufstellung & Formation</h2>
          <div class="two-col">
            <div>
              <h3 style="margin-top:0">${homeTeam} ${match?.home_formation ? `(${match.home_formation})` : ""}</h3>
              ${hasHomeLineup ? pitchSVG(lineups, match?.home_formation, "home") : `<p style="color:#94a3b8;font-size:10px;text-align:center;padding:30px">Keine Aufstellung erfasst</p>`}
              ${subs.length > 0 ? `<h3 style="font-size:11px">Ersatzbank</h3>
                <div style="font-size:10px;line-height:1.6">${subs.map((s: any) => `<span class="lineup-num home" style="margin-right:4px">${s.shirt_number ?? "?"}</span>${s.player_name}`).join(" • ")}</div>` : ""}
            </div>
            <div>
              <h3 style="margin-top:0">${awayTeam} ${match?.away_formation ? `(${match.away_formation})` : ""}</h3>
              ${hasAwayLineup ? pitchSVG(lineups, match?.away_formation, "away") : `<p style="color:#94a3b8;font-size:10px;text-align:center;padding:30px">Keine Aufstellung des Gegners erfasst</p>`}
            </div>
          </div>
          ${footer}
        </div>`);
      }

      // 8. TEAM STATS (skip rows that are "0–0" with no real data)
      const statRows: string[] = [];
      statRows.push(compBar("Tore", hGoalsFinal, aGoalsFinal));
      if (hasPossessionData) statRows.push(compBar("Ballbesitz", `${hPoss}%`, `${aPoss}%`, hPoss!, aPoss!));
      if (hShots + aShots > 0) statRows.push(compBar("Schüsse", hShots, aShots));
      if (hSOT + aSOT > 0) statRows.push(compBar("Aufs Tor", hSOT, aSOT));
      const corners = matchEvents.filter((e: any) => e.event_type === "corner");
      const hCorners = corners.filter((e: any) => e.team === "home").length;
      const aCorners = corners.filter((e: any) => e.team === "away").length;
      if (hCorners + aCorners > 0) statRows.push(compBar("Ecken", hCorners, aCorners));
      const hYellow = matchEvents.filter((e: any) => e.event_type === "yellow_card" && e.team === "home").length;
      const aYellow = matchEvents.filter((e: any) => e.event_type === "yellow_card" && e.team === "away").length;
      if (hYellow + aYellow > 0) statRows.push(compBar("Gelbe Karten", hYellow, aYellow));
      if (hFouls + aFouls > 0) statRows.push(compBar("Fouls", hFouls, aFouls));
      if (hPassT + aPassT > 0) {
        statRows.push(compBar("Pässe", hPasses, aPasses));
        statRows.push(compBar("Passquote", `${hPassAcc}%`, `${aPassAcc}%`, hPassAcc, aPassAcc));
      }
      if (hDuelsT + aDuelsT > 0) statRows.push(compBar("Zweikämpfe", hDuelsW, aDuelsW));
      if (hSprints + aSprints > 0) statRows.push(compBar("Sprints", hSprints, aSprints));
      if (isMeaningful(homeStats?.total_distance_km) || isMeaningful(awayStats?.total_distance_km)) {
        statRows.push(compBar("Distanz (km)",
          homeStats?.total_distance_km?.toFixed(1) ?? "–",
          awayStats?.total_distance_km?.toFixed(1) ?? "–",
          homeStats?.total_distance_km ?? 0, awayStats?.total_distance_km ?? 0));
      }
      if (isMeaningful(homeStats?.top_speed_kmh) || isMeaningful(awayStats?.top_speed_kmh)) {
        statRows.push(compBar("Top-Speed",
          homeStats?.top_speed_kmh?.toFixed(1) ?? "–",
          awayStats?.top_speed_kmh?.toFixed(1) ?? "–",
          homeStats?.top_speed_kmh ?? 0, awayStats?.top_speed_kmh ?? 0));
      }

      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">📊</span> Team-Vergleich</h2>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;padding:0 6px">
          <span style="font-weight:800;color:#2563eb">${homeTeam}</span>
          <span style="font-size:9px;color:#94a3b8">vs</span>
          <span style="font-weight:800;color:#dc2626">${awayTeam}</span>
        </div>
        ${statRows.join("")}
        ${hasHeatmap ? `<h3 style="margin-top:18px">Heatmap (Heim-Aktivitätszonen)</h3>
          ${heatmapSVG(heatGrids)}
          <p style="font-size:9px;color:#94a3b8;margin-top:4px;text-align:center">Aggregiert aus Tracking-Daten aller Spieler</p>` : ""}
        ${footer}
      </div>`);

      // 9. EVENT CHRONICLE (improved with names)
      if (matchEvents.length) {
        const rows = matchEvents.map((e: any) => {
          const ic = eventIcon(e.event_type);
          const lbl = eventLabel(e.event_type);
          const teamLbl = e.team === "home" ? homeTeam.slice(0, 14) : awayTeam.slice(0, 14);
          return `<div class="event-row ${e.team}">
            <span class="event-min">${e.minute}'</span>
            <span class="event-icon">${ic}</span>
            <span class="event-detail">
              <span class="ev-type" style="color:${eventColor(e.event_type)}">${lbl}</span>
              ${e.player_name ? `<span style="color:#0f172a">— ${e.player_name}</span>` : ""}
              <span class="ev-team">(${teamLbl})</span>
            </span>
          </div>`;
        }).join("");
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">⏱️</span> Event-Chronik</h2>
          <div class="event-chronicle">${rows}</div>
          ${footer}
        </div>`);
      }

      // 10. PLAYER SPOTLIGHT
      if (ai.mvp || ai.concern_player) {
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">🌟</span> Spieler-Spotlight</h2>
          ${ai.mvp ? `<div class="spotlight">
            <div class="spotlight-tag">⭐ Man of the Match</div>
            <div class="spotlight-name">${ai.mvp.name}</div>
            <div class="spotlight-reason">${ai.mvp.reason}</div>
            ${ai.mvp.key_stats ? `<div class="spotlight-stats">📈 ${ai.mvp.key_stats}</div>` : ""}
          </div>` : ""}
          ${ai.concern_player ? `<div class="spotlight concern">
            <div class="spotlight-tag">⚠️ Sorgenkind</div>
            <div class="spotlight-name">${ai.concern_player.name}</div>
            <div class="spotlight-reason">${ai.concern_player.reason}</div>
            ${ai.concern_player.improvement ? `<div class="spotlight-stats" style="color:#ea580c">💡 Verbesserungs-Pfad: ${ai.concern_player.improvement}</div>` : ""}
          </div>` : ""}
          ${footer}
        </div>`);
      }

      // 11. SWOT + DO/DONT
      if ((ai.home_strengths ?? []).length || (ai.opponent_strengths ?? []).length) {
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">💪</span> SWOT — ${homeTeam}</h2>
          <div class="swot-grid">
            <div class="swot-col strengths"><h4>✅ Stärken</h4>
              ${(ai.home_strengths ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}
            </div>
            <div class="swot-col weaknesses"><h4>⚠️ Schwächen</h4>
              ${(ai.home_weaknesses ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}
            </div>
          </div>
          ${(ai.opponent_strengths ?? []).length ? `<h2 style="margin-top:18px"><span class="sec-icon">🔍</span> Gegner — ${awayTeam}</h2>
            ${ai.opponent_profile ? `<div class="card" style="margin-bottom:8px"><p style="font-size:10.5px;line-height:1.6">${ai.opponent_profile}</p></div>` : ""}
            <div class="swot-grid">
              <div class="swot-col strengths"><h4>✅ Stärken</h4>
                ${(ai.opponent_strengths ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}
              </div>
              <div class="swot-col weaknesses"><h4>⚠️ Schwächen</h4>
                ${(ai.opponent_weaknesses ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}
              </div>
            </div>` : ""}
          ${(ai.dos ?? []).length ? `<div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="card success"><h4 style="font-size:11px;margin-bottom:6px">✅ Do's</h4>
              <ul style="list-style:none;padding:0">${(ai.dos ?? []).map((d: string) => `<li style="margin:3px 0;font-size:10px">✓ ${d}</li>`).join("")}</ul>
            </div>
            <div class="card danger"><h4 style="font-size:11px;margin-bottom:6px">❌ Don'ts</h4>
              <ul style="list-style:none;padding:0">${(ai.donts ?? []).map((d: string) => `<li style="margin:3px 0;font-size:10px">✗ ${d}</li>`).join("")}</ul>
            </div>
          </div>` : ""}
          ${footer}
        </div>`);
      }

      // 12. COACHING INSIGHTS + RISK
      const insightData = ai.coaching_insights ?? insights ?? [];
      if (insightData.length || (ai.risk_assessment ?? []).length) {
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">🧠</span> Coaching-Insights</h2>
          ${insightData.map((ins: any, i: number) => `<div class="insight-card">
            ${ins.impact ? `<span class="impact">Impact ${ins.impact}/10</span>` : ""}
            <div class="insight-title">${i + 1}. ${ins.title ?? "Insight"}</div>
            <div class="insight-desc">${ins.description ?? ""}</div>
            ${ins.category ? `<span class="insight-cat">${ins.category}</span>` : ""}
          </div>`).join("")}
          ${(ai.tactical_adjustments ?? []).length ? `<h3 style="margin-top:14px">⚙️ Taktische Anpassungen</h3>
            ${(ai.tactical_adjustments ?? []).map((a: string, i: number) =>
              `<div class="takeaway"><span class="takeaway-num">${i + 1}</span><span class="takeaway-text">${a}</span></div>`).join("")}` : ""}
          ${(ai.risk_assessment ?? []).length ? `<h3 style="margin-top:14px">🚨 Risiko-Assessment</h3>
            <table class="risk-table"><tr><th>Risiko</th><th>Schwere</th><th>Gegenmaßnahme</th></tr>
            ${(ai.risk_assessment ?? []).map((r: any) => `<tr>
              <td>${r.risk}</td>
              <td class="${r.severity === "hoch" ? "risk-high" : r.severity === "mittel" ? "risk-med" : "risk-low"}">${r.severity}</td>
              <td>${r.mitigation}</td>
            </tr>`).join("")}</table>` : ""}
          ${footer}
        </div>`);
      }

      // 13. PLAYER RATINGS HOME — only when ratings exist
      if (hasPlayerRatings && homePS.length) {
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">⭐</span> Spieler-Bewertungen — ${homeTeam}</h2>
          <table class="player-table">
            <tr><th>#</th><th>Name</th><th>Pos</th><th>Note</th>${hasPhysicalData ? "<th>km</th>" : ""}<th>⚽</th><th>🅰️</th><th>Pässe</th><th>Zweik.</th>${hasPhysicalData ? "<th>Sprints</th><th>Top</th>" : ""}</tr>
            ${homePS.map((p: any) => `<tr>
              <td>${p.players?.number ?? "–"}</td>
              <td style="font-weight:600">${p.players?.name ?? "?"}</td>
              <td>${p.players?.position ?? "–"}</td>
              <td><span class="rating-cell" style="background:${ratingBg(p.rating)};color:${ratingColor(p.rating)}">${p.rating?.toFixed(1) ?? "–"}</span></td>
              ${hasPhysicalData ? `<td>${p.distance_km?.toFixed(1) ?? "–"}</td>` : ""}
              <td>${p.goals ?? 0}</td>
              <td>${p.assists ?? 0}</td>
              <td>${p.passes_completed ?? 0}/${p.passes_total ?? 0}</td>
              <td>${p.duels_won ?? 0}/${p.duels_total ?? 0}</td>
              ${hasPhysicalData ? `<td>${p.sprint_count ?? 0}</td><td>${p.top_speed_kmh?.toFixed(1) ?? "–"}</td>` : ""}
            </tr>`).join("")}
          </table>
          ${footer}
        </div>`);
      }

      // 14. PLAYER RATINGS AWAY
      if (hasPlayerRatings && awayPS.length && awayPS.some((p: any) => p.rating != null)) {
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">⭐</span> Spieler-Bewertungen — ${awayTeam}</h2>
          <table class="player-table">
            <tr><th>#</th><th>Name</th><th>Pos</th><th>Note</th><th>⚽</th><th>🅰️</th><th>Pässe</th><th>Zweik.</th></tr>
            ${awayPS.map((p: any) => `<tr>
              <td>${p.players?.number ?? "–"}</td>
              <td style="font-weight:600">${p.players?.name ?? "?"}</td>
              <td>${p.players?.position ?? "–"}</td>
              <td><span class="rating-cell" style="background:${ratingBg(p.rating)};color:${ratingColor(p.rating)}">${p.rating?.toFixed(1) ?? "–"}</span></td>
              <td>${p.goals ?? 0}</td>
              <td>${p.assists ?? 0}</td>
              <td>${p.passes_completed ?? 0}/${p.passes_total ?? 0}</td>
              <td>${p.duels_won ?? 0}/${p.duels_total ?? 0}</td>
            </tr>`).join("")}
          </table>
          ${footer}
        </div>`);
      }

      // 15. TRAINING + WEEKLY PLAN
      const trainData = ai.training_focus ?? trainingRecs ?? [];
      if (trainData.length || (ai.weekly_plan ?? []).length) {
        pages.push(`<div class="page page-break">
          <h2><span class="sec-icon">🏋️</span> Trainingsempfehlungen</h2>
          ${trainData.map((t: any) => `<div class="training-card">
            <div class="tc-header">
              <span class="tc-title">${t.title ?? "Training"}</span>
              <span class="tc-meta">${t.intensity ?? ""}${t.duration ? ` • ${t.duration}` : ""}</span>
            </div>
            <p style="font-size:10px;color:#334155;line-height:1.55">${t.description ?? ""}</p>
            ${t.goal ? `<div class="tc-goal">🎯 ${t.goal}</div>` : ""}
          </div>`).join("")}
          ${(ai.weekly_plan ?? []).length ? `<h3 style="margin-top:14px">📅 Wochenplan</h3>
            <div class="weekly-grid">${(ai.weekly_plan ?? []).map((d: any) => `<div class="day-card">
              <div class="day-name">${d.day}</div>
              <div class="day-theme">${d.theme}</div>
              <div class="day-focus">${d.focus}</div>
              <span class="day-intensity ${(d.intensity ?? "").toLowerCase()}">${d.intensity}</span>
            </div>`).join("")}</div>` : ""}
          ${footer}
        </div>`);
      }

      // 16. CONCLUSION
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">🏁</span> Fazit & Strategischer Ausblick</h2>
        <div class="card" style="margin-bottom:12px">
          <p style="font-size:11px;line-height:1.7">${ai.conclusion ?? "Analyse abgeschlossen."}</p>
        </div>
        ${(ai.next_match_priorities ?? []).length ? `<h3>Prioritäten für das nächste Spiel</h3>
          ${(ai.next_match_priorities ?? []).map((p: string, i: number) =>
            `<div class="takeaway"><span class="takeaway-num">${i + 1}</span><span class="takeaway-text" style="font-weight:600">${p}</span></div>`).join("")}` : ""}
        <div class="notes-area">
          <div class="notes-label">📝 Eigene Notizen</div>
          ${"<div class='note-line'></div>".repeat(8)}
        </div>
        ${footer}
      </div>`);
    }

    // ── MATCH PREP ──
    if (report_type === "match_prep") {
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">🔍</span> Gegner-Profil: ${awayTeam}</h2>
        ${ai.opponent_profile ? `<div class="card"><p style="font-size:11px;line-height:1.6">${ai.opponent_profile}</p></div>` : ""}
        <div class="swot-grid" style="margin-top:10px">
          <div class="swot-col strengths"><h4>✅ Stärken</h4>
            ${(ai.opponent_strengths ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}
          </div>
          <div class="swot-col weaknesses"><h4>⚠️ Schwächen</h4>
            ${(ai.opponent_weaknesses ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}
          </div>
        </div>
        <h3 style="margin-top:14px">⚙️ Taktische Anpassungen</h3>
        ${(ai.tactical_adjustments ?? []).map((a: string, i: number) =>
          `<div class="takeaway"><span class="takeaway-num">${i + 1}</span><span class="takeaway-text">${a}</span></div>`).join("")}
        ${(ai.dos ?? []).length ? `<div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="card success"><h4 style="font-size:11px">✅ Do's</h4>
            <ul style="list-style:none;padding:0">${(ai.dos ?? []).map((d: string) => `<li style="margin:3px 0;font-size:10px">✓ ${d}</li>`).join("")}</ul>
          </div>
          <div class="card danger"><h4 style="font-size:11px">❌ Don'ts</h4>
            <ul style="list-style:none;padding:0">${(ai.donts ?? []).map((d: string) => `<li style="margin:3px 0;font-size:10px">✗ ${d}</li>`).join("")}</ul>
          </div>
        </div>` : ""}
        <div class="notes-area">
          <div class="notes-label">📝 Eigene Notizen</div>
          ${"<div class='note-line'></div>".repeat(6)}
        </div>
        ${footer}
      </div>`);
    }

    // ── HALFTIME ──
    if (report_type === "halftime_tactics") {
      pages.push(`<div class="page page-break">
        <h2><span class="sec-icon">⚡</span> Halbzeit-Taktikanalyse</h2>
        <div class="swot-grid">
          <div class="swot-col strengths"><h4>✅ Positiv</h4>
            ${(ai.halftime_good ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}
          </div>
          <div class="swot-col weaknesses"><h4>⚠️ Verbesserung</h4>
            ${(ai.halftime_bad ?? []).map((s: string) => `<div class="swot-item">• ${s}</div>`).join("")}
          </div>
        </div>
        <h3 style="margin-top:14px">⚙️ Anpassungen 2. Halbzeit</h3>
        ${(ai.tactical_adjustments ?? []).map((a: string, i: number) =>
          `<div class="takeaway"><span class="takeaway-num">${i + 1}</span><span class="takeaway-text">${a}</span></div>`).join("")}
        ${(ai.sub_suggestions ?? []).length ? `<h3 style="margin-top:12px">🔄 Wechsel-Vorschläge</h3>
          ${(ai.sub_suggestions ?? []).map((s: string) => `<div class="insight-card"><div class="insight-desc">${s}</div></div>`).join("")}` : ""}
        <div class="notes-area">
          <div class="notes-label">📝 Eigene Notizen</div>
          ${"<div class='note-line'></div>".repeat(6)}
        </div>
        ${footer}
      </div>`);
    }

    const html = `<!DOCTYPE html><html lang="de"><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${homeTeam} vs ${awayTeam} – ${rtLabels[report_type] ?? "Report"}</title>
      ${css}
    </head><body>${pages.join("")}</body></html>`;

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-pdf-report error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
