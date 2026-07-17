import { sectionEyebrow, sectionTitle } from "../landingTheme";

const PERGUNTAS = [
  {
    q: "O que é um 'universo' (Gênesis)?",
    a: "É um multiverso independente — com seus próprios personagens, cenários e regras. Você pode ter quantos quiser, e eles podem até se cruzar.",
  },
  {
    q: "O que são os Bastidores / Mundo Vivo?",
    a: "Um modo opcional em que os personagens fora de cena continuam agindo e formando memórias por conta própria, e voltam coerentes quando reentram na história.",
  },
  {
    q: "Dá pra exportar minha história como livro?",
    a: "Sim — qualquer história vira um PDF diagramado, sem limite de páginas, com o estilo de leitura que você escolher.",
  },
  {
    q: "Meus dados ficam salvos?",
    a: "Sim, toda a história, memória e estado do mundo persistem entre sessões.",
  },
  {
    q: "Preciso saber programar?",
    a: "Não. Você só escreve — o motor narrativo cuida da simulação, da memória e da consistência do mundo.",
  },
];

export default function FaqSection() {
  return (
    <section id="faq" className="px-5 py-20 md:py-28">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-14">
          <p className={sectionEyebrow}>Perguntas frequentes</p>
          <h2 className={sectionTitle}>FAQ</h2>
        </div>
        <div className="space-y-4">
          {PERGUNTAS.map((item) => (
            <div key={item.q} className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5">
              <p className="text-zinc-100 font-medium mb-1.5">{item.q}</p>
              <p className="text-sm text-zinc-500 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
