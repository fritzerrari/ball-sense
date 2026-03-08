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

    // Only 6 key players — clean, minimal
    const players = [
      { bx: 0.18, by: 0.35, phase: 0, speed: 0.4 },
      { bx: 0.25, by: 0.65, phase: 1.5, speed: 0.35 },
      { bx: 0.38, by: 0.28, phase: 3.0, speed: 0.5 },
      { bx: 0.42, by: 0.72, phase: 4.2, speed: 0.45 },
      { bx: 0.62, by: 0.4, phase: 2.1, speed: 0.38 },
      { bx: 0.7, by: 0.6, phase: 5.0, speed: 0.42 },
    ].map(p => ({ ...p, x: p.bx, y: p.by, heatPoints: [] as { x: number; y: number; age: number }[] }));

    let t = 0;

    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);

      const mx = w * 0.08;
      const my = h * 0.12;
      const pw = w - mx * 2;
      const ph = h - my * 2;

      // Pitch lines — very subtle
      ctx.strokeStyle = "rgba(22, 163, 74, 0.07)";
      ctx.lineWidth = 1;
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

      // Penalty areas
      const paW = pw * 0.14;
      const paH = ph * 0.42;
      ctx.strokeRect(mx, h / 2 - paH / 2, paW, paH);
      ctx.strokeRect(mx + pw - paW, h / 2 - paH / 2, paW, paH);

      // Players — just dots + heatmap buildup, NO trails
      for (const p of players) {
        p.phase += 0.006 * p.speed;
        const wanderR = 0.025;
        const tx = p.bx + Math.sin(p.phase * 1.7) * wanderR;
        const ty = p.by + Math.cos(p.phase * 1.1) * wanderR * 1.3;
        p.x += (tx - p.x) * 0.03;
        p.y += (ty - p.y) * 0.03;

        const sx = mx + p.x * pw;
        const sy = my + p.y * ph;

        // Accumulate heatmap points slowly
        if (Math.random() < 0.15) {
          p.heatPoints.push({ x: sx, y: sy, age: 0 });
        }
        // Age and remove old points
        for (let i = p.heatPoints.length - 1; i >= 0; i--) {
          p.heatPoints[i].age += 0.005;
          if (p.heatPoints[i].age > 1) p.heatPoints.splice(i, 1);
        }

        // Draw heatmap — accumulated glow zones
        for (const hp of p.heatPoints) {
          const alpha = 0.04 * (1 - hp.age);
          const grad = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, 22);
          grad.addColorStop(0, `rgba(22, 163, 74, ${alpha})`);
          grad.addColorStop(1, "rgba(22, 163, 74, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(hp.x, hp.y, 22, 0, Math.PI * 2);
          ctx.fill();
        }

        // Player dot — clean, small
        ctx.beginPath();
        ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(22, 163, 74, 0.7)";
        ctx.fill();

        // Subtle pulse ring
        const pulseR = 6 + Math.sin(t * 2 + p.phase) * 2;
        ctx.beginPath();
        ctx.arc(sx, sy, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(22, 163, 74, 0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

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
