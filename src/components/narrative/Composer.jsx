import React, { useState, useMemo, useEffect } from "react";
import { SendHorizonal, Loader2, KeyRound, Bot } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import SlashCommandMenu from "./SlashCommandMenu";
import OracleSuggestions from "./OracleSuggestions";
import PacingSliders from "./PacingSliders";

export default function Composer({ onSend, sending, placeholder, allowByok, storyId }) {
  const [texto, setTexto] = useState("");
  const [byok, setByok] = useState(false);
  const [autoPilot, setAutoPilot] = useState(false);
  const [ritmoCena, setRitmoCena] = useState({ peso_acao: 25, peso_dialogo: 25, peso_introspeccao: 25, peso_ambientacao: 25 });
  const [activeIndex, setActiveIndex] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: comandos = [] } = useQuery({
    queryKey: ["slashCommands"],
    queryFn: () => base44.entities.SlashCommand.list(),
    staleTime: 5 * 60 * 1000,
  });

  // ----- Loop do Mundo Vivo: um turno autônomo a cada 12 segundos -----
  useEffect(() => {
    if (!autoPilot || sending || !storyId) return;
    let ativo = true;
    const intervalo = setInterval(async () => {
      try {
        await base44.functions.invoke("simulacaoAutonoma", { storyId, modoByok: byok });
        if (ativo) queryClient.invalidateQueries({ queryKey: ["blocks", storyId] });
      } catch (err) {
        if (!ativo) return;
        clearInterval(intervalo);
        setAutoPilot(false);
        const semEnergia = err?.response?.status === 402;
        toast({
          variant: "destructive",
          title: semEnergia ? "Energia insuficiente" : "Mundo Vivo interrompido",
          description: semEnergia
            ? "Seus Nexus Tokens acabaram. Recarregue para reativar o Piloto Automático."
            : err?.response?.data?.error || err.message,
        });
      }
    }, 12000);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [autoPilot, sending, storyId, byok, queryClient, toast]);

  const menuAberto = texto.startsWith("/") && !texto.includes(" ") && !texto.includes("\n");
  const filtrados = useMemo(
    () => (menuAberto ? comandos.filter((c) => (c.comando || "").toLowerCase().startsWith(texto.toLowerCase())) : []),
    [menuAberto, comandos, texto]
  );
  useEffect(() => { setActiveIndex(0); }, [texto]);

  const autocompletar = (c) => setTexto(`${c.comando} `);

  const submit = () => {
    if (!texto.trim() || sending) return;
    onSend(texto.trim(), byok, ritmoCena);
    setTexto("");
  };

  const onKeyDown = (e) => {
    if (filtrados.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % filtrados.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => (i - 1 + filtrados.length) % filtrados.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); autocompletar(filtrados[activeIndex] || filtrados[0]); return; }
      if (e.key === "Escape") { e.preventDefault(); setTexto(""); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  return (
    <div className="relative">
      {storyId && <OracleSuggestions storyId={storyId} onPick={setTexto} />}
      {menuAberto && <SlashCommandMenu comandos={filtrados} activeIndex={activeIndex} onPick={autocompletar} />}
      <div className="flex items-end gap-3 bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-2xl p-3 shadow-2xl shadow-black/40">
        <PacingSliders onChange={setRitmoCena} />
        {allowByok && (
          <button
            onClick={() => setByok(!byok)}
            title={byok ? "Modo BYOK ativo: gera o System Prompt Master para sua IA externa" : "Ativar modo BYOK (Bring Your Own Key)"}
            className={`shrink-0 h-11 w-11 rounded-xl border flex items-center justify-center transition-colors ${byok ? "border-amber-500/60 text-amber-300 bg-amber-500/10" : "border-zinc-800 text-zinc-600 hover:text-zinc-400"}`}
          >
            <KeyRound className="w-4 h-4" />
          </button>
        )}
        {storyId && (
          <button
            onClick={() => setAutoPilot(!autoPilot)}
            title={autoPilot ? "Mundo Vivo ativo: os personagens agem sozinhos. Clique para pausar." : "Ativar Mundo Vivo (Piloto Automático)"}
            className={`shrink-0 h-11 w-11 rounded-xl border flex items-center justify-center transition-colors ${autoPilot ? "border-emerald-500/60 text-emerald-300 bg-emerald-500/10 animate-pulse" : "border-zinc-800 text-zinc-600 hover:text-zinc-400"}`}
          >
            <Bot className="w-4 h-4" />
          </button>
        )}
        <textarea
          value={texto}
          onChange={(e) => {
            if (autoPilot) setAutoPilot(false);
            setTexto(e.target.value);
          }}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder={autoPilot ? "Mundo Vivo ativo — digite para retomar o controle..." : placeholder || "Dite a narrativa... (digite / para comandos)"}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-zinc-100 placeholder:text-zinc-600 leading-relaxed px-2 py-1"
        />
        <button
          onClick={submit}
          disabled={sending || !texto.trim()}
          className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <SendHorizonal className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}