import { useEffect, useRef } from "react";
import { TIPO_CORES } from "@/components/graph/graphUtils";

const CORES = Object.values(TIPO_CORES);

/**
 * Fundo interativo: nós coloridos (as mesmas cores do Megagrafo) conectados por
 * arestas finas, que reagem ao mouse com repulsão suave e uma aresta de destaque
 * até o cursor — para lembrar visualmente o grafo omniversal do produto.
 * Respeita prefers-reduced-motion.
 */
export default function GraphParticleBackground({ density = 90, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = window.devicePixelRatio || 1;
    const mouse = { x: -9999, y: -9999 };
    let raf, w, h;
    const N = Math.max(20, Math.min(160, density));
    const nos = [];

    function resize() {
      const r = canvas.getBoundingClientRect();
      w = canvas.width = r.width * dpr;
      h = canvas.height = r.height * dpr;
    }
    resize();
    for (let i = 0; i < N; i++) {
      nos.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18 * dpr,
        vy: (Math.random() - 0.5) * 0.18 * dpr,
        r: (1.4 + Math.random() * 2.2) * dpr,
        cor: CORES[i % CORES.length],
      });
    }

    function onMove(e) {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * dpr;
      mouse.y = (e.clientY - r.top) * dpr;
    }
    function onLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }
    function onTouch(e) {
      if (e.touches && e.touches.length > 0) {
        const r = canvas.getBoundingClientRect();
        mouse.x = (e.touches[0].clientX - r.left) * dpr;
        mouse.y = (e.touches[0].clientY - r.top) * dpr;
      }
    }

    const linkDist = 140 * dpr;
    const cursorLinkDist = 220 * dpr;

    function frame() {
      ctx.clearRect(0, 0, w, h);

      for (const n of nos) {
        if (!reduced) {
          const dx = n.x - mouse.x;
          const dy = n.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          const rad = 170 * dpr;
          if (d2 < rad * rad) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / rad) * 1.1 * dpr;
            n.x += (dx / d) * f;
            n.y += (dy / d) * f;
          }
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < -10) n.x = w + 10;
          if (n.x > w + 10) n.x = -10;
          if (n.y < -10) n.y = h + 10;
          if (n.y > h + 10) n.y = -10;
        }
      }

      // Arestas entre nós próximos — visual de grafo
      ctx.lineWidth = dpr;
      for (let i = 0; i < nos.length; i++) {
        for (let j = i + 1; j < nos.length; j++) {
          const a = nos[i], b = nos[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < linkDist) {
            ctx.strokeStyle = `hsl(250 60% 70% / ${0.1 * (1 - d / linkDist)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Aresta de destaque do cursor até nós próximos — reforça a leitura de "grafo interativo"
      if (!reduced && mouse.x > -9000) {
        for (const n of nos) {
          const dx = n.x - mouse.x, dy = n.y - mouse.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < cursorLinkDist) {
            ctx.strokeStyle = `hsl(45 95% 65% / ${0.22 * (1 - d / cursorLinkDist)})`;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(n.x, n.y);
            ctx.stroke();
          }
        }
      }

      // Nós por cima das arestas
      for (const n of nos) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.cor;
        ctx.globalAlpha = 0.75;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(frame);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("mouseout", onLeave);
    frame();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("mouseout", onLeave);
    };
  }, [density]);

  return <canvas ref={ref} className={`pointer-events-none ${className}`} />;
}
