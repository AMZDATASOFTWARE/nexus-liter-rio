import React, { useEffect, useRef } from "react";

// Randomiza a interferência a cada ciclo: direção, intensidade, distância do fantasma e duração da calmaria
export default function GlitchWrapper({ children, className = "", delay = 0 }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = (min, max) => min + Math.random() * (max - min);
    const randomize = () => {
      const lado = Math.random() < 0.5 ? -1 : 1; // ora mais pra um lado, ora pro outro
      el.style.setProperty("--g-dx", `${(lado * r(1, 6)).toFixed(1)}px`);
      el.style.setProperty("--g-dy", `${r(-2, 2).toFixed(1)}px`);
      el.style.setProperty("--g-skew", `${(lado * r(0.5, 4)).toFixed(1)}deg`);
      el.style.setProperty("--g-ghost", `${(lado * r(3, 16)).toFixed(1)}px`); // fantasma mais perto ou mais distante
      el.style.setProperty("--g-ghost2", `${(-lado * r(3, 16)).toFixed(1)}px`);
      el.style.setProperty("--g-op", r(0.55, 0.9).toFixed(2));
      el.style.animationDuration = `${r(2.6, 4.6).toFixed(2)}s`; // calmaria variável entre glitches
      // Avisa o motor de som com a intensidade deste glitch (fantasma distante = glitch forte)
      const ghost = Math.abs(parseFloat(el.style.getPropertyValue("--g-ghost")));
      window.dispatchEvent(new CustomEvent("glitch-burst", { detail: { intensity: (ghost - 3) / 13 } }));
    };
    randomize();
    el.addEventListener("animationiteration", randomize);
    return () => el.removeEventListener("animationiteration", randomize);
  }, []);

  return (
    <div ref={ref} className={`glitch-anim ${className}`} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}