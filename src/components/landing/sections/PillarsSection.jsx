import { Sparkles, Brain, Users, Package, Globe, Network } from "lucide-react";
import { sectionEyebrow, sectionTitle } from "../landingTheme";

const PILARES = [
  {
    icon: Sparkles,
    titulo: "Vozes Únicas",
    desc: "Cada personagem tem perfil linguístico, vícios de fala e estilo de pensamento próprios — ninguém soa genérico.",
  },
  {
    icon: Brain,
    titulo: "Memórias-Flashback",
    desc: "Lembranças evocadas na cena viram capítulos de flashback legíveis, não só estado invisível.",
  },
  {
    icon: Users,
    titulo: "Nascidos de Lembranças",
    desc: "Uma memória pode materializar um personagem mencionado, com personalidade forjada a partir de como foi lembrado.",
  },
  {
    icon: Package,
    titulo: "Objetos & Cenários Duráveis",
    desc: "Itens e locais guardam estado, posse e história entre turnos — nada reseta.",
  },
  {
    icon: Globe,
    titulo: "Bastidores Vivos",
    desc: "Personagens fora de cena continuam vivendo em paralelo, e voltam já coerentes com o que viveram.",
  },
  {
    icon: Network,
    titulo: "Grafo Omniversal 3D",
    desc: "Todo o multiverso — personagens, objetos, locais, eventos — mapeado e navegável em 3D.",
  },
];

export default function PillarsSection() {
  return (
    <section id="recursos" className="px-5 py-20 md:py-28">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className={sectionEyebrow}>Recursos</p>
          <h2 className={sectionTitle}>Um mundo que se comporta como um mundo de verdade</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PILARES.map((p) => (
            <div
              key={p.titulo}
              className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 hover:border-violet-500/30 transition-colors"
            >
              <p.icon className="w-5 h-5 text-violet-300/80 mb-4" />
              <h3 className="text-zinc-100 font-medium mb-2">{p.titulo}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
