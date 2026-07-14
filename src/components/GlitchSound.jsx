import React, { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

const SAMPLES = [
  "https://media.base44.com/files/public/6a55c29cb7d4f6ae965f92f7/092e7ebb0_freesound_community-interference-91383.mp3",
  "https://media.base44.com/files/public/6a55c29cb7d4f6ae965f92f7/9099d4d94_freesound_community-interdimensional-train-pass-2-29198.mp3",
];

// Toca trechos aleatórios dos samples reais de interferência, sincronizados com os eventos
// "glitch-burst" do GlitchWrapper. Intensidade visual controla volume e brilho do filtro.
export default function GlitchSound() {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const ctxRef = useRef(null);
  const buffersRef = useRef([]);

  useEffect(() => {
    // Navegadores só liberam áudio após um gesto do usuário
    const ensureCtx = async () => {
      if (!ctxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        ctxRef.current = ctx;
        // Carrega e decodifica os samples enviados
        SAMPLES.forEach(async (url, i) => {
          const res = await fetch(url);
          const arr = await res.arrayBuffer();
          buffersRef.current[i] = await ctx.decodeAudioData(arr);
        });
      }
      if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    };
    window.addEventListener("pointerdown", ensureCtx);
    window.addEventListener("keydown", ensureCtx);

    const onBurst = (e) => {
      const ctx = ctxRef.current;
      const loaded = buffersRef.current.filter(Boolean);
      if (!ctx || ctx.state !== "running" || mutedRef.current || loaded.length === 0) return;
      const intensity = Math.min(1, Math.max(0, e.detail?.intensity ?? 0.5));
      // Sincroniza com a janela visual: mesmo atraso de início e mesma duração do glitch na tela
      const start = ctx.currentTime + (e.detail?.startDelay ?? 0.05);
      const dur = e.detail?.glitchDur ?? 0.35;

      // Escolhe um sample e um trecho aleatório dele (glitch imprevisível, nunca repetido)
      const buffer = loaded[Math.floor(Math.random() * loaded.length)];
      const maxStart = Math.max(0, buffer.duration - dur - 0.1);
      const offset = Math.random() * maxStart;

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      // Altura acompanha a intensidade: glitch fraco = grave/lento, glitch forte = agudo/rápido
      src.playbackRate.value = 0.7 + intensity * 0.9 + Math.random() * 0.15;

      // Filtro: calmo = abafado/distante; glitch intenso = um pouco mais aberto
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 500 + intensity * 2500;
      filter.Q.value = 0.7;

      // Envelope leve: entrada seca, corte junto com o fim do glitch visual
      const gain = ctx.createGain();
      const peak = 0.02 + intensity * 0.07;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.02);
      gain.gain.setValueAtTime(peak, start + dur * 0.7);
      gain.gain.linearRampToValueAtTime(0, start + dur);

      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(start, offset, dur + 0.05);
    };
    window.addEventListener("glitch-burst", onBurst);

    return () => {
      window.removeEventListener("pointerdown", ensureCtx);
      window.removeEventListener("keydown", ensureCtx);
      window.removeEventListener("glitch-burst", onBurst);
      ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return (
    <button
      onClick={() => setMuted((m) => !m)}
      title={muted ? "Ativar som de interferência" : "Silenciar som de interferência"}
      className="fixed bottom-3 left-3 z-50 p-1 rounded-full text-zinc-500 opacity-25 hover:opacity-100 hover:text-zinc-200 transition-opacity"
    >
      {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
    </button>
  );
}