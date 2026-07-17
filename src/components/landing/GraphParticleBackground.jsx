import { useEffect, useRef } from "react";
import { TIPO_CORES } from "@/components/graph/graphUtils";

const CORES = Object.values(TIPO_CORES);
const ESPACAMENTO_MALHA = 46; // px entre linhas da malha do espaço-tempo
const RAIO_GRAVIDADE_MALHA = 260; // raio de influência do "poço gravitacional" sobre a malha
const FORCA_GRAVIDADE_MALHA = 90; // deslocamento máximo da malha perto do cursor
const RAIO_GRAVIDADE_NOS = 230; // raio de influência sobre os nós do multiverso

/**
 * Fundo interativo em 3 camadas: estrelas de fundo (profundidade, cintilação),
 * uma malha de "espaço-tempo" que se curva ao redor do cursor (lente gravitacional),
 * e o grafo do multiverso (nós coloridos, as mesmas cores do Megagrafo) sendo
 * puxado de verdade pela "gravidade" do mouse. Respeita prefers-reduced-motion.
 */
export default function GraphParticleBackground({ density = 90, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = window.devicePixelRatio || 1;
    const mouse = { x: -9999, y: -9999, ativo: false };
    let raf, w, h, t = 0;
    const estrelas = [];
    const nos = [];

    function montarEstrelas() {
      estrelas.length = 0;
      const total = Math.floor((w * h) / (9000 * dpr * dpr));
      for (let i = 0; i < total; i++) {
        estrelas.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: (0.4 + Math.random() * 1.1) * dpr,
          fase: Math.random() * Math.PI * 2,
        });
      }
    }

    function montarNos() {
      nos.length = 0;
      const N = Math.max(20, Math.min(160, density));
      for (let i = 0; i < N; i++) {
        nos.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.16 * dpr,
          vy: (Math.random() - 0.5) * 0.16 * dpr,
          r: (1.6 + Math.random() * 2.4) * dpr,
          cor: CORES[i % CORES.length],
        });
      }
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      w = canvas.width = r.width * dpr;
      h = canvas.height = r.height * dpr;
      montarEstrelas();
      montarNos();
    }
    resize();

    function onMove(e) {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * dpr;
      mouse.y = (e.clientY - r.top) * dpr;
      mouse.ativo = true;
    }
    function onLeave() {
      mouse.ativo = false;
    }
    function onTouch(e) {
      if (e.touches && e.touches.length > 0) {
        const r = canvas.getBoundingClientRect();
        mouse.x = (e.touches[0].clientX - r.left) * dpr;
        mouse.y = (e.touches[0].clientY - r.top) * dpr;
        mouse.ativo = true;
      }
    }

    // Desloca um ponto da malha em direção ao cursor — a curvatura do espaço-tempo sobre uma massa
    function deformar(x, y) {
      if (!mouse.ativo) return [x, y];
      const dx = mouse.x - x;
      const dy = mouse.y - y;
      const raio = RAIO_GRAVIDADE_MALHA * dpr;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > raio || d < 1) return [x, y];
      const peso = (1 - d / raio) ** 2;
      const forca = (FORCA_GRAVIDADE_MALHA * dpr * peso) / d;
      return [x + dx * forca, y + dy * forca];
    }

    function frame() {
      t += 1;
      ctx.clearRect(0, 0, w, h);

      // Camada 1 — estrelas de fundo (profundidade, cintilação leve)
      for (const s of estrelas) {
        const brilho = 0.3 + 0.35 * Math.sin(t * 0.02 + s.fase);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 220, 255, ${brilho})`;
        ctx.fill();
      }

      // Camada 2 — malha do espaço-tempo, curvada pelo cursor
      const passo = ESPACAMENTO_MALHA * dpr;
      const cols = Math.ceil(w / passo) + 1;
      const rows = Math.ceil(h / passo) + 1;
      ctx.strokeStyle = "rgba(96, 165, 250, 0.16)";
      ctx.lineWidth = dpr;
      for (let j = 0; j <= rows; j++) {
        ctx.beginPath();
        for (let i = 0; i <= cols; i++) {
          const [x, y] = deformar(i * passo, j * passo);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      for (let i = 0; i <= cols; i++) {
        ctx.beginPath();
        for (let j = 0; j <= rows; j++) {
          const [x, y] = deformar(i * passo, j * passo);
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Camada 3 — grafo do multiverso: nós coloridos puxados pela gravidade do cursor
      for (const n of nos) {
        if (!reduced) {
          n.x += n.vx;
          n.y += n.vy;
          if (mouse.ativo) {
            const dx = mouse.x - n.x;
            const dy = mouse.y - n.y;
            const raio = RAIO_GRAVIDADE_NOS * dpr;
            const d2 = dx * dx + dy * dy;
            if (d2 < raio * raio) {
              const d = Math.sqrt(d2) || 1;
              const f = (1 - d / raio) * 0.55 * dpr;
              n.x += (dx / d) * f;
              n.y += (dy / d) * f;
            }
          }
          if (n.x < -20) n.x = w + 20;
          if (n.x > w + 20) n.x = -20;
          if (n.y < -20) n.y = h + 20;
          if (n.y > h + 20) n.y = -20;
        }
      }

      const linkDist = 150 * dpr;
      ctx.lineWidth = dpr;
      for (let i = 0; i < nos.length; i++) {
        for (let j = i + 1; j < nos.length; j++) {
          const a = nos[i], b = nos[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < linkDist) {
            ctx.strokeStyle = `hsl(250 70% 75% / ${0.14 * (1 - d / linkDist)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      if (mouse.ativo) {
        const raio = RAIO_GRAVIDADE_NOS * dpr + 30 * dpr;
        for (const n of nos) {
          const dx = n.x - mouse.x, dy = n.y - mouse.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < raio) {
            ctx.strokeStyle = `hsl(45 95% 65% / ${0.25 * (1 - d / raio)})`;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(n.x, n.y);
            ctx.stroke();
          }
        }
      }

      for (const n of nos) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.cor;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Brilho do poço gravitacional no cursor
      if (mouse.ativo) {
        const raioGlow = 90 * dpr;
        const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, raioGlow);
        grad.addColorStop(0, "rgba(140, 180, 255, 0.22)");
        grad.addColorStop(1, "rgba(140, 180, 255, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, raioGlow, 0, Math.PI * 2);
        ctx.fill();
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
