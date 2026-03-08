import { useEffect, useRef } from "react";

interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number; age: number }[];
  team: 0 | 1;
  hue: number;
}

export function HeroPitch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const playersRef = useRef<Player[]>([]);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize players
    const players: Player[] = [];
    for (let i = 0; i < 22; i++) {
      const team = i < 11 ? 0 : 1;
      players.push({
        x: team === 0 ? 100 + Math.random() * 300 : 400 + Math.random() * 300,
        y: 50 + Math.random() * 300,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        trail: [],
        team: team as 0 | 1,
        hue: team === 0 ? 152 : 38,
      });
    }
    playersRef.current = players;

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      timeRef.current += 1;

      ctx.clearRect(0, 0, w, h);

      // Draw pitch lines
      const margin = 40;
      const pw = w - margin * 2;
      const ph = h - margin * 2;

      ctx.strokeStyle = "rgba(74, 222, 128, 0.12)";
      ctx.lineWidth = 1;

      // Outer boundary
      ctx.strokeRect(margin, margin, pw, ph);

      // Center line
      ctx.beginPath();
      ctx.moveTo(w / 2, margin);
      ctx.lineTo(w / 2, margin + ph);
      ctx.stroke();

      // Center circle
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(pw, ph) * 0.12, 0, Math.PI * 2);
      ctx.stroke();

      // Penalty areas
      const paW = pw * 0.16;
      const paH = ph * 0.4;
      ctx.strokeRect(margin, h / 2 - paH / 2, paW, paH);
      ctx.strokeRect(margin + pw - paW, h / 2 - paH / 2, paW, paH);

      // Goal areas
      const gaW = pw * 0.06;
      const gaH = ph * 0.18;
      ctx.strokeRect(margin, h / 2 - gaH / 2, gaW, gaH);
      ctx.strokeRect(margin + pw - gaW, h / 2 - gaH / 2, gaW, gaH);

      // Update and draw players
      for (const p of players) {
        // Wander behavior
        p.vx += (Math.random() - 0.5) * 0.15;
        p.vy += (Math.random() - 0.5) * 0.15;

        // Damping
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Speed limit
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 1.2) {
          p.vx = (p.vx / speed) * 1.2;
          p.vy = (p.vy / speed) * 1.2;
        }

        // Scale positions to canvas
        const scaledX = (p.x / 800) * w;
        const scaledY = (p.y / 400) * h;

        p.x += p.vx;
        p.y += p.vy;

        // Bounce
        if (p.x < 50) { p.x = 50; p.vx *= -1; }
        if (p.x > 750) { p.x = 750; p.vx *= -1; }
        if (p.y < 20) { p.y = 20; p.vy *= -1; }
        if (p.y > 380) { p.y = 380; p.vy *= -1; }

        // Add trail
        p.trail.push({ x: scaledX, y: scaledY, age: 0 });
        if (p.trail.length > 60) p.trail.shift();

        // Draw trail with heatmap gradient
        for (let i = 1; i < p.trail.length; i++) {
          const t = p.trail[i];
          t.age += 1;
          const alpha = Math.max(0, 0.4 - t.age * 0.006);
          ctx.beginPath();
          ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
          ctx.lineTo(t.x, t.y);
          ctx.strokeStyle = `hsla(${p.hue}, 70%, 55%, ${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Draw heatmap glow at current position
        const gradient = ctx.createRadialGradient(scaledX, scaledY, 0, scaledX, scaledY, 20);
        gradient.addColorStop(0, `hsla(${p.hue}, 80%, 50%, 0.15)`);
        gradient.addColorStop(1, `hsla(${p.hue}, 80%, 50%, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(scaledX - 20, scaledY - 20, 40, 40);

        // Draw player dot
        ctx.beginPath();
        ctx.arc(scaledX, scaledY, 3, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, 0.9)`;
        ctx.fill();

        // Outer glow
        ctx.beginPath();
        ctx.arc(scaledX, scaledY, 5, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${p.hue}, 70%, 60%, 0.3)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.7 }}
    />
  );
}
