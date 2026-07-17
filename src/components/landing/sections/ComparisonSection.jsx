import { Check, X } from "lucide-react";
import { sectionEyebrow, sectionTitle } from "../landingTheme";

const LINHAS = [
  ["Memória permanente por personagem", true, false],
  ["Mundo continua vivendo fora de cena", true, false],
  ["Objetos e cenários com estado durável", true, false],
  ["Exporta como livro real em PDF", true, false],
  ["Vozes e personalidades únicas por personagem", true, false],
];

export default function ComparisonSection() {
  return (
    <section id="comparativo" className="px-5 py-20 md:py-28">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <p className={sectionEyebrow}>Comparativo</p>
          <h2 className={sectionTitle}>Não é só mais um chat de RPG</h2>
        </div>
        <div className="rounded-2xl border border-zinc-800/80 overflow-hidden">
          <div className="grid grid-cols-3 bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-500 px-5 py-3">
            <span className="col-span-1">Recurso</span>
            <span className="text-center">Nexus Literário</span>
            <span className="text-center">Chat de RPG genérico</span>
          </div>
          {LINHAS.map(([label, a, b], i) => (
            <div key={label} className={`grid grid-cols-3 items-center px-5 py-4 text-sm ${i % 2 ? "bg-zinc-900/20" : ""}`}>
              <span className="col-span-1 text-zinc-300">{label}</span>
              <span className="flex justify-center">
                {a ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-zinc-700" />}
              </span>
              <span className="flex justify-center">
                {b ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-zinc-700" />}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
