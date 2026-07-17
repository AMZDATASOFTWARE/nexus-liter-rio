const FATOS = [
  "10.000 Nexus Tokens grátis pra começar",
  "Memória perpétua por personagem",
  "Grafo Omniversal em 3D",
  "Livro em PDF sem limite de páginas",
];

export default function FactsStrip() {
  return (
    <section className="border-y border-zinc-900 bg-zinc-950/40">
      <div className="max-w-5xl mx-auto px-5 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-center">
        {FATOS.map((f) => (
          <p key={f} className="text-xs md:text-sm text-zinc-400">
            {f}
          </p>
        ))}
      </div>
    </section>
  );
}
