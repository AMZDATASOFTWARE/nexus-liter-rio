import { Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function FinalCtaSection() {
  return (
    <section className="px-5 py-24 md:py-32 text-center border-t border-zinc-900">
      <div className="max-w-xl mx-auto">
        <h2 className="font-display text-3xl md:text-4xl font-light tracking-tight text-zinc-100 mb-5">
          Sua primeira história está esperando.
        </h2>
        <p className="text-zinc-500 mb-8">Comece agora — grátis, sem cartão de crédito.</p>
        <button
          onClick={() => base44.auth.redirectToLogin("/")}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-8 py-4 text-sm font-medium text-white hover:scale-[1.03] active:scale-95 transition-transform shadow-lg shadow-indigo-900/40"
        >
          <Sparkles className="w-4 h-4" /> Iniciar minha Gênesis grátis
        </button>
      </div>
    </section>
  );
}
