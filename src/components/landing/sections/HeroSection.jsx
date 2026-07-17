import { Sparkles, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function HeroSection() {
  return (
    <section className="relative px-5 pt-24 pb-20 md:pt-32 md:pb-28 text-center">
      <div className="max-w-3xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.4em] text-violet-300/60 mb-6">Motor Narrativo Multiversal</p>
        <h1 className="font-display text-4xl md:text-6xl font-light tracking-tight leading-[1.1] bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent mb-6">
          Seu multiverso tem vida própria.
        </h1>
        <p className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-3">
          Personagens com consciência simulada, vozes únicas e memória perpétua. Lembranças que viram capítulos. Um
          mundo que continua vivendo — com objetos, cenários e histórias paralelas — mesmo quando você não está
          olhando.
        </p>
        <p className="text-zinc-500 text-sm md:text-base max-w-xl mx-auto mb-10">
          Para quem ama interpretar personagens, quem quer ler histórias que se escrevem sozinhas, e quem é
          fascinado por multiverso e IA generativa.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => base44.auth.redirectToLogin("/")}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-7 py-3.5 text-sm font-medium text-white hover:scale-[1.03] active:scale-95 transition-transform shadow-lg shadow-indigo-900/40"
          >
            <Sparkles className="w-4 h-4" /> Iniciar minha Gênesis grátis
          </button>
          <a
            href="#recursos"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-7 py-3.5 text-sm font-medium text-zinc-300 hover:border-violet-500/40 hover:text-white transition-colors"
          >
            Ver como funciona <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
