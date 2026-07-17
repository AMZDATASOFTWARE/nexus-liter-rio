import { Dices, BookOpenText, Sparkles } from "lucide-react";
import { sectionEyebrow, sectionTitle } from "../landingTheme";

const PUBLICOS = [
  {
    icon: Dices,
    titulo: "Quem ama RPG",
    desc: "Interprete personagens de verdade, com consciência própria, memória e vontade — não só respostas de chat.",
  },
  {
    icon: BookOpenText,
    titulo: "Quem ama ler (e escrever)",
    desc: "Histórias que se escrevem sozinhas, e viram um livro real em PDF quando você quiser.",
  },
  {
    icon: Sparkles,
    titulo: "Entusiastas de multiverso e IA",
    desc: "Universos que se cruzam, um grafo omniversal navegável, e uma rede de IAs simulando cada mente.",
  },
];

export default function AudienceSection() {
  return (
    <section id="para-quem" className="px-5 py-20 md:py-28 bg-zinc-950/40 border-y border-zinc-900">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <p className={sectionEyebrow}>Para quem é</p>
          <h2 className={sectionTitle}>Feito pra três tipos de gente</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {PUBLICOS.map((p) => (
            <div key={p.titulo} className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-300">
                <p.icon className="w-5 h-5" />
              </div>
              <h3 className="text-zinc-100 font-medium mb-2">{p.titulo}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
