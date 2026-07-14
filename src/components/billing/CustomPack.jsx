import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRECO_MENSAGEM, PRECO_INTEGRACAO, formatBRL } from "./pricing";

export default function CustomPack({ onComprar, loading }) {
  const [mensagens, setMensagens] = useState(0);
  const [integracoes, setIntegracoes] = useState(0);
  const m = Math.max(0, Math.floor(Number(mensagens) || 0));
  const i = Math.max(0, Math.floor(Number(integracoes) || 0));
  const total = m * PRECO_MENSAGEM + i * PRECO_INTEGRACAO;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h4 className="text-sm font-medium text-zinc-200">Monte seu próprio pacote</h4>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-zinc-500">Mensagens (R$ 1,00/cada)</label>
          <Input type="number" min="0" value={mensagens} onChange={(e) => setMensagens(e.target.value)} className="mt-1 bg-zinc-950 border-zinc-800 text-zinc-100" />
        </div>
        <div>
          <label className="text-[11px] text-zinc-500">Integrações (R$ 0,04/cada)</label>
          <Input type="number" min="0" value={integracoes} onChange={(e) => setIntegracoes(e.target.value)} className="mt-1 bg-zinc-950 border-zinc-800 text-zinc-100" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-zinc-400">Total: <span className="text-lg font-semibold text-zinc-50">{formatBRL(total)}</span></p>
        <Button
          onClick={() => onComprar({ mensagens: m, integracoes: i })}
          disabled={loading || total < 0.5}
          variant="outline"
          className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Comprar personalizado"}
        </Button>
      </div>
      {total > 0 && total < 0.5 && <p className="mt-2 text-[11px] text-red-400">O valor mínimo da compra é R$ 0,50.</p>}
    </div>
  );
}