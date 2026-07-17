import { Check } from "lucide-react";
import { PACOTES, formatBRL } from "@/components/billing/pricing";
import { sectionEyebrow, sectionTitle } from "../landingTheme";

export default function PricingSection() {
  return (
    <section id="precos" className="px-5 py-20 md:py-28 bg-zinc-950/40 border-y border-zinc-900">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-4">
          <p className={sectionEyebrow}>Preços</p>
          <h2 className={sectionTitle}>Comece grátis, recarregue quando precisar</h2>
        </div>
        <p className="text-center text-sm text-zinc-500 mb-12">
          Toda conta nova já começa com 10.000 Nexus Tokens. Os pacotes abaixo recarregam sua energia no Mercado
          Multiversal.
        </p>
        <div className="grid sm:grid-cols-3 gap-5">
          {PACOTES.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border p-6 ${p.popular ? "border-amber-500/50 bg-amber-500/5" : "border-zinc-800/80 bg-zinc-900/40"}`}
            >
              {p.popular && <p className="text-[10px] uppercase tracking-wider text-amber-300 mb-2">Mais popular</p>}
              <h3 className="font-display text-lg text-zinc-100 mb-1">{p.nome}</h3>
              <p className="text-2xl font-light text-zinc-100 mb-4">{formatBRL(p.valor)}</p>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" /> {p.mensagens} créditos de mensagem
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" /> {p.integracoes} créditos de integração
                </li>
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
