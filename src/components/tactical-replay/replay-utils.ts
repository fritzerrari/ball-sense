export interface PlayerPos {
  team: "home" | "away";
  x: number;
  y: number;
  role?: string;
  number?: number;
  estimated?: boolean;
}

export interface FrameData {
  frame_index: number;
  label?: string;
  ball: { x: number; y: number };
  players: PlayerPos[];
}

/** Lerp helper */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Proper formation templates with well-spread positions.
 * x = 0-100 (left goal line to right), y = 0-100 (top to bottom).
 * Positions ordered by priority (GK first, then DEF, MID, FWD).
 */
const FORMATION_TEMPLATES: Record<number, { x: number; y: number; role: string }[]> = {
  11: [
    // 4-4-2 spread across the pitch
    { x: 4, y: 50, role: "GK" },
    { x: 22, y: 15, role: "DEF" },
    { x: 20, y: 38, role: "DEF" },
    { x: 20, y: 62, role: "DEF" },
    { x: 22, y: 85, role: "DEF" },
    { x: 45, y: 20, role: "MID" },
    { x: 43, y: 42, role: "MID" },
    { x: 43, y: 58, role: "MID" },
    { x: 45, y: 80, role: "MID" },
    { x: 72, y: 35, role: "FWD" },
    { x: 72, y: 65, role: "FWD" },
  ],
  9: [
    { x: 4, y: 50, role: "GK" },
    { x: 22, y: 20, role: "DEF" },
    { x: 20, y: 50, role: "DEF" },
    { x: 22, y: 80, role: "DEF" },
    { x: 45, y: 25, role: "MID" },
    { x: 43, y: 50, role: "MID" },
    { x: 45, y: 75, role: "MID" },
    { x: 72, y: 35, role: "FWD" },
    { x: 72, y: 65, role: "FWD" },
  ],
  7: [
    { x: 4, y: 50, role: "GK" },
    { x: 25, y: 25, role: "DEF" },
    { x: 25, y: 75, role: "DEF" },
    { x: 50, y: 25, role: "MID" },
    { x: 50, y: 75, role: "MID" },
    { x: 72, y: 35, role: "FWD" },
    { x: 72, y: 65, role: "FWD" },
  ],
  5: [
    { x: 4, y: 50, role: "GK" },
    { x: 30, y: 30, role: "DEF" },
    { x: 30, y: 70, role: "DEF" },
    { x: 65, y: 35, role: "FWD" },
    { x: 65, y: 65, role: "FWD" },
  ],
};

/**
 * Fill missing players with ghost positions using smart placement.
 * - Uses formation template as baseline
 * - Detects which template positions are already "covered" by real players
 * - Fills uncovered positions as ghosts (priority: GK > DEF > MID > FWD)
 */
export function fillGhostPlayers(
  players: PlayerPos[],
  team: "home" | "away",
  expectedSize: number,
  isAway: boolean,
): PlayerPos[] {
  const teamPlayers = players.filter(p => p.team === team);
  if (teamPlayers.length >= expectedSize) return teamPlayers.slice(0, expectedSize);

  // Pick closest template
  const templateSizes = Object.keys(FORMATION_TEMPLATES).map(Number).sort((a, b) => a - b);
  const templateSize = templateSizes.reduce((best, s) =>
    Math.abs(s - expectedSize) < Math.abs(best - expectedSize) ? s : best
  , templateSizes[0]);
  const template = FORMATION_TEMPLATES[templateSize] ?? FORMATION_TEMPLATES[11]!;

  // Scale template to expected size (take first N positions by priority)
  const scaledTemplate = template.slice(0, expectedSize).map(pos => ({
    ...pos,
    x: isAway ? 100 - pos.x : pos.x,
    y: pos.y,
  }));

  // Mark which template positions are "covered" by existing players
  const used = new Set<number>();
  for (const real of teamPlayers) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < scaledTemplate.length; i++) {
      if (used.has(i)) continue;
      const dx = real.x - scaledTemplate[i].x;
      const dy = real.y - scaledTemplate[i].y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) used.add(bestIdx);
  }

  // Add ghosts for uncovered template positions
  const ghosts: PlayerPos[] = [];
  for (let i = 0; i < scaledTemplate.length; i++) {
    if (used.has(i)) continue;
    if (teamPlayers.length + ghosts.length >= expectedSize) break;
    ghosts.push({
      team,
      x: scaledTemplate[i].x,
      y: scaledTemplate[i].y,
      role: scaledTemplate[i].role,
      estimated: true,
    });
  }

  return [...teamPlayers, ...ghosts].slice(0, expectedSize);
}

/** Interpolate between two frames */
export function interpolateFrame(
  a: FrameData,
  b: FrameData,
  t: number,
  expectedHome: number,
  expectedAway: number,
): { ball: { x: number; y: number }; players: PlayerPos[] } {
  const ball = { x: lerp(a.ball.x, b.ball.x, t), y: lerp(a.ball.y, b.ball.y, t) };

  const homeA = fillGhostPlayers(a.players, "home", expectedHome || 11, false);
  const homeB = fillGhostPlayers(b.players, "home", expectedHome || 11, false);
  const awayA = fillGhostPlayers(a.players, "away", expectedAway || 11, true);
  const awayB = fillGhostPlayers(b.players, "away", expectedAway || 11, true);

  const interpolatePlayers = (listA: PlayerPos[], listB: PlayerPos[]): PlayerPos[] => {
    const maxLen = Math.max(listA.length, listB.length);
    return Array.from({ length: maxLen }, (_, i) => {
      const pa = listA[i] ?? listA[listA.length - 1] ?? { team: "home" as const, x: 50, y: 50 };
      const pb = listB[i] ?? listB[listB.length - 1] ?? pa;
      return {
        team: pa.team,
        x: lerp(pa.x, pb.x, t),
        y: lerp(pa.y, pb.y, t),
        role: pa.role,
        number: pa.number,
        estimated: pa.estimated || pb.estimated,
      };
    });
  };

  return {
    ball,
    players: [...interpolatePlayers(homeA, homeB), ...interpolatePlayers(awayA, awayB)],
  };
}
