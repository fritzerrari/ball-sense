import { useEffect, useRef } from "react";

export function HeroPitch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let w = 0, h = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Players with organic movement
    interface Dot {
      x: number; y: number;
      baseX: number; baseY: number;
      vx: number; vy: number;
      team: 0 | 1;
      trail: { x: number; y: number }[];
      phase: number;
      speed: number;
    }

    const dots: Dot[] = [];
    // Team 0 (green) — left half positions
    const team0Positions = [
      [0.12, 0.5], [0.22, 0.2], [0.22, 0.4], [0.22, 0.6], [0.22, 0.8],
      [0.32, 0.15], [0.32, 0.5], [0.32, 0.85],
      [0.4, 0.3], [0.4, 0.7], [0.45, 0.5],
    ];
    // Team 1 (amber) — right half
    const team1Positions = [
      [0.88, 0.5], [0.78, 0.2], [0.78, 0.4], [0.78, 0.6], [0.78, 0.8],
      [0.68, 0.15], [0.68, 0.5], [0.68, 0.85],
      [0.6, 0.3], [0.6, 0.7], [0.55, 0.5],
    ];

    [...team0Positions, ...team1Positions].forEach(([bx, by], i) => {
      dots.push({
        x: bx, y: by,
        baseX: bx, baseY: by,
        vx: 0, vy: 0,
        team: i < 11 ? 0 : 1,
        trail: [],
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
      });
    });

    let t = 0;

    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);

      // Pitch background — subtle dark gradient in center
      const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
      bgGrad.addColorStop(0, "rgba(22, 163, 74, 0.04)");
      bgGrad.addColorStop(1, "rgba(22, 163, 74, 0)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      const mx = w * 0.06; // margin
      const my = h * 0.1;
      const pw = w - mx * 2;
      const ph = h - my * 2;

      // Pitch lines
      ctx.strokeStyle = "rgba(22, 163, 74, 0.1)";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      // Outer rect
      ctx.strokeRect(mx, my, pw, ph);

      // Center line
      ctx.beginPath();
      ctx.moveTo(w / 2, my);
      ctx.lineTo(w / 2, my + ph);
      ctx.stroke();

      // Center circle
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(pw, ph) * 0.13, 0, Math.PI * 2);
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(22, 163, 74, 0.2)";
      ctx.fill();

      // Penalty areas
      const paW = pw * 0.15;
      const paH = ph * 0.44;
      ctx.strokeRect(mx, h / 2 - paH / 2, paW, paH);
      ctx.strokeRect(mx + pw - paW, h / 2 - paH / 2, paW, paH);

      // Goal areas
      const gaW = pw * 0.06;
      const gaH = ph * 0.2;
      ctx.strokeRect(mx, h / 2 - gaH / 2, gaW, gaH);
      ctx.strokeRect(mx + pw - gaW, h / 2 - gaH / 2, gaW, gaH);

      // Update & draw players
      for (const d of dots) {
        // Organic wandering around base position
        d.phase += 0.008 * d.speed;
        const wanderRadius = 0.04;
        const targetX = d.baseX + Math.sin(d.phase * 1.3 + d.speed * 10) * wanderRadius;
        const targetY = d.baseY + Math.cos(d.phase * 0.9 + d.speed * 7) * wanderRadius * 1.5;

        d.vx += (targetX - d.x) * 0.02;
        d.vy += (targetY - d.y) * 0.02;
        d.vx *= 0.95;
        d.vy *= 0.95;
        d.x += d.vx;
        d.y += d.vy;

        const sx = mx + d.x * pw;
        const sy = my + d.y * ph;

        // Trail
        d.trail.push({ x: sx, y: sy });
        if (d.trail.length > 80) d.trail.shift();

        // Draw trail — gradient fade
        const color = d.team === 0 ? "22, 163, 74" : "234, 179, 8";
        if (d.trail.length > 2) {
          for (let i = 1; i < d.trail.length; i++) {
            const alpha = (i / d.trail.length) * 0.25;
            ctx.beginPath();
            ctx.moveTo(d.trail[i - 1].x, d.trail[i - 1].y);
            ctx.lineTo(d.trail[i].x, d.trail[i].y);
            ctx.strokeStyle = `rgba(${color}, ${alpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }

        // Heatmap glow
        const heatGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 28);
        heatGrad.addColorStop(0, `rgba(${color}, 0.12)`);
        heatGrad.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = heatGrad;
        ctx.beginPath();
        ctx.arc(sx, sy, 28, 0, Math.PI * 2);
        ctx.fill();

        // Player dot with glow
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, 0.9)`;
        ctx.fill();

        // Outer ring
        ctx.beginPath();
        ctx.arc(sx, sy, 7, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${color}, 0.25)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Scanning line effect
      const scanY = my + (ph * ((Math.sin(t * 0.5) + 1) / 2));
      const scanGrad = ctx.createLinearGradient(mx, scanY - 15, mx, scanY + 15);
      scanGrad.addColorStop(0, "rgba(22, 163, 74, 0)");
      scanGrad.addColorStop(0.5, "rgba(22, 163, 74, 0.03)");
      scanGrad.addColorStop(1, "rgba(22, 163, 74, 0)");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(mx, scanY - 15, pw, 30);

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
