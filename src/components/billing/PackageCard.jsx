import React from "react";
import { MessageSquareText, Network, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "./pricing";

export default function PackageCard({ pacote, onComprar, loading }) {
  return (
    <div className={`relative flex flex-col rounded-2xl border p-5 bg-zinc-900/60 ${pacote.popular ? "border-amber-500/60 shadow-[0_0_30px_-10px_rgba(245,158,11,0.4)]" : "border-zinc-800"}`}>
      {pacote.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-semibold tracking-widest uppercase">
          Popular
        </span>
      )}
      <h3 className="font-display text-lg text-zinc-100">{pacote.nome}</h3>
      <div className="mt-3 space-y-1.5 text-sm text-zinc-300">
        <p className="flex items-center gap-2"><MessageSquareText className="w-4 h-4 text-violet-400" /> {pacote.mensagens} Créditos de Mensagem</p>
        <p className="flex items-center gap-2"><Network className="w-4 h-4 text-emerald-400" /> {pacote.integracoes} Créditos de Integração</p>
      </div>
      <p className="mt-4 text-2xl font-semibold text-zinc-50">{formatBRL(pacote.valor)}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
        Contém {pacote.mensagens} mensagens a R$ 1,00/cada e {pacote.integracoes} integrações a R$ 0,04/cada
      </p>
      <Button
        onClick={() => onComprar({ mensagens: pacote.mensagens, integracoes: pacote.integracoes })}
        disabled={loading}
        className={`mt-4 w-full ${pacote.popular ? "bg-amber-500 hover:bg-amber-400 text-zinc-950" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-100"}`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Comprar"}
      </Button>
    </div>
  );
}