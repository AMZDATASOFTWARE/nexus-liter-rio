import React, { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const CANAIS = [
  { key: "acao", label: "Ação", cor: "violet" },
  { key: "dialogo", label: "Diálogo", cor: "amber" },
  { key: "introspeccao", label: "Introspecção", cor: "violet" },
  { key: "ambientacao", label: "Ambientação", cor: "amber" },
];

export default function PacingSliders({ onChange }) {
  const [ritmo, setRitmo] = useState({ acao: 25, dialogo: 25, introspeccao: 25, ambientacao: 25 });

  const emitir = (novo) => {
    onChange?.({
      peso_acao: novo.acao,
      peso_dialogo: novo.dialogo,
      peso_introspeccao: novo.introspeccao,
      peso_ambientacao: novo.ambientacao,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Mesa de Mixagem — ritmo da cena (Diretor de Cinema)"
          className="shrink-0 h-11 w-11 rounded-xl border border-zinc-800 text-zinc-600 hover:text-amber-300 hover:bg-transparent hover:border-amber-500/40 transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 bg-zinc-950 border-zinc-800 text-zinc-200 space-y-5 p-5">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Ritmo da cena</p>
        {CANAIS.map((c) => (
          <div key={c.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-zinc-400">{c.label}</Label>
              <span className={`text-xs font-mono ${c.cor === "violet" ? "text-violet-300" : "text-amber-300"}`}>
                {ritmo[c.key]}%
              </span>
            </div>
            <Slider
              value={[ritmo[c.key]]}
              max={100}
              step={5}
              onValueChange={([v]) => setRitmo((r) => ({ ...r, [c.key]: v }))}
              onValueCommit={([v]) => {
                const novo = { ...ritmo, [c.key]: v };
                setRitmo(novo);
                emitir(novo);
              }}
              className={
                c.cor === "violet"
                  ? "[&>span:first-child]:bg-zinc-800 [&>span:first-child>span]:bg-violet-500 [&_[role=slider]]:bg-violet-500 [&_[role=slider]]:border-violet-400"
                  : "[&>span:first-child]:bg-zinc-800 [&>span:first-child>span]:bg-amber-500 [&_[role=slider]]:bg-amber-500 [&_[role=slider]]:border-amber-400"
              }
            />
          </div>
        ))}
        <p className="text-[10px] text-zinc-600 leading-relaxed">Os pesos são enviados junto com sua próxima jogada e ditam o foco da prosa.</p>
      </PopoverContent>
    </Popover>
  );
}