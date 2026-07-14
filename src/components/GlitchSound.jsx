import React, { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

// Som sintético de interferência digital (ruído filtrado), sincronizado com os eventos "glitch-burst"
// disparados pelo GlitchWrapper. Volume acompanha a intensidade visual do glitch.
export default function GlitchSound() {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const ctxRef = useRef(null);
  const bufferRef = useRef(null);

  useEffect(() => {
    // Navegadores só liberam áudio após um gesto do usuário
    const ensureCtx = () => {
      if (!ctxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        ctxRef.current = ctx;
        const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        bufferRef.current = buf;
      }
      if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    };
    window.addEventListener("pointerdown", ensureCtx);
    window.addEventListener("keydown", ensureCtx);

    const onBurst = (e) => {
      const ctx = ctxRef.current;
      if (!ctx || ctx.state !== "running" || mutedRef.current) return;
      const intensity = Math.min(1, Math.max(0, e.detail?.intensity ?? 0.5));
      const now = ctx.currentTime;

      const src = ctx.createBufferSource();
      src.buffer = bufferRef.current;
      src.playbackRate.value = 0.6 + Math.random() * 0.8;

      // Filtro abafado tipo lâmpada/letreiro com defeito; glitch forte = som um pouco mais nítido
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 350 + intensity * 1600 + Math.random() * 300;
      filter.Q.value = 0.9;

      // Envelope de "estalos" acompanhando os pulsos visuais (~0.4s), volume bem baixo
      const gain = ctx.createGain();
      const peak = 0.006 + intensity * 0.03;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.015);
      gain.gain.linearRampToValueAtTime(peak * 0.25, now + 0.06);
      gain.gain.linearRampToValueAtTime(peak * 0.8, now + 0.11);
      gain.gain.linearRampToValueAtTime(peak * 0.15, now + 0.18);
      gain.gain.linearRampToValueAtTime(peak * 0.5, now + 0.25);
      gain.gain.linearRampToValueAtTime(0, now + 0.38);

      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.45);
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