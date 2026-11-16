import { useEffect, useRef } from "react";

const COLORS = ["#f97316", "#facc15", "#22c55e", "#06b6d4", "#6366f1", "#ec4899", "#f43f5e"];

/** Kutubxonasiz konfetti portlashi. `fire` o'zgarganda qayta otiladi. */
export default function Confetti({ fire, duration = 3500 }: { fire: unknown; duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const W = window.innerWidth, H = window.innerHeight;
    // Ikki tomondan (pastki burchaklardan) va markazdan otiladi
    const origins = [{ x: W * 0.15, y: H * 0.9, dir: 1 }, { x: W * 0.85, y: H * 0.9, dir: -1 }, { x: W / 2, y: H * 0.35, dir: 0 }];
    const parts = Array.from({ length: 160 }, (_, i) => {
      const o = origins[i % origins.length];
      const angle = o.dir === 0 ? Math.random() * Math.PI * 2 : -Math.PI / 2 + o.dir * (0.25 + Math.random() * 0.45);
      const speed = o.dir === 0 ? 4 + Math.random() * 6 : 12 + Math.random() * 9;
      return {
        x: o.x, y: o.y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        w: 6 + Math.random() * 6, h: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[i % COLORS.length], round: Math.random() < 0.3,
      };
    });

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = Math.max(0, Math.min(1, (duration - t) / 800));
      for (const p of parts) {
        p.vy += 0.28; p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.h, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
        ctx.restore();
      }
      if (t < duration) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); ctx.clearRect(0, 0, W, H); };
  }, [fire, duration]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[60] h-full w-full" />;
}
