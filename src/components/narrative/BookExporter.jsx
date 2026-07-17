import React, { useState, useRef } from "react";
import { BookDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import PolishingStudio from "./PolishingStudio";
import { compilarCapitulosDaHistoria, juntarCapitulosEmLivro } from "./compilarLivro";

const MODOS = [
  {
    id: "integrado",
    titulo: "Integrado",
    desc: "Flashbacks tecidos na prosa e bastidores intercalados como cenas paralelas (\"Enquanto isso...\"). O livro conta o mundo inteiro.",
  },
  {
    id: "sem_bastidores",
    titulo: "Sem bastidores",
    desc: "Apenas o que o ponto de vista viveu em cena. Flashbacks entram; os bastidores ficam de fora do livro.",
  },
  {
    id: "interludios",
    titulo: "Interlúdios",
    desc: "Bastidores agrupados em seções próprias (\"Interlúdio\") entre as cenas principais, tipograficamente distintas.",
  },
];

export default function BookExporter({ storyId }) {
  const [escolhendo, setEscolhendo] = useState(false);
  const [modo, setModo] = useState("integrado");
  const [progresso, setProgresso] = useState(null); // { atual, total } durante a compilação
  const [livro, setLivro] = useState(null);
  const canceladoRef = useRef(false);
  const { toast } = useToast();
  const compilando = progresso !== null;

  const compilar = async () => {
    canceladoRef.current = false;
    setProgresso({ atual: 0, total: 0 });
    try {
      const capitulos = await compilarCapitulosDaHistoria(storyId, modo, setProgresso, () => canceladoRef.current);
      if (!capitulos) return;
      setLivro(juntarCapitulosEmLivro(capitulos));
      setEscolhendo(false);
    } catch (e) {
      toast({ title: "Falha ao compilar o livro", description: e.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setProgresso(null);
    }
  };

  const cancelar = () => {
    canceladoRef.current = true;
    setProgresso(null);
    setEscolhendo(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setEscolhendo(true)}
        title="Lapidar e exportar como livro (PDF)"
        className="shrink-0 h-9 w-9 rounded-lg bg-transparent border-zinc-800 text-zinc-500 hover:text-amber-300 hover:border-amber-500/40 hover:bg-transparent transition-colors"
      >
        <BookDown className="w-4 h-4" />
      </Button>

      {escolhendo && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !compilando && setEscolhendo(false)}>
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#0b0b14] p-5 shadow-2xl shadow-black/60" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg text-zinc-100">Estilo de compilação</h3>
            <p className="text-[11px] text-zinc-500 mb-4">Como os flashbacks e os bastidores do mundo vivo entram no livro final</p>

            <div className="space-y-2">
              {MODOS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModo(m.id)}
                  disabled={compilando}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    modo === m.id
                      ? "border-amber-500/50 bg-amber-500/5"
                      : "border-zinc-800 hover:border-zinc-700"
                  } disabled:opacity-60`}
                >
                  <span className={`block text-sm font-medium ${modo === m.id ? "text-amber-200" : "text-zinc-200"}`}>{m.titulo}</span>
                  <span className="block text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{m.desc}</span>
                </button>
              ))}
            </div>

            {compilando ? (
              <div className="mt-5">
                <div className="flex items-center gap-2 text-[12px] text-amber-200/90">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {progresso.total > 0
                    ? `Compilando capítulo ${progresso.atual} de ${progresso.total}...`
                    : "Preparando o manuscrito..."}
                </div>
                {progresso.total > 1 && (
                  <div className="mt-2 h-1 rounded-full bg-zinc-900 overflow-hidden">
                    <div className="h-full bg-amber-500/70 transition-all" style={{ width: `${(progresso.atual / progresso.total) * 100}%` }} />
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={cancelar} className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900">
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEscolhendo(false)} className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900">
                  Cancelar
                </Button>
                <Button size="sm" onClick={compilar} className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium">
                  <BookDown className="w-4 h-4 mr-2" /> Compilar livro
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {livro && <PolishingStudio livro={livro} onClose={() => setLivro(null)} />}
    </>
  );
}
