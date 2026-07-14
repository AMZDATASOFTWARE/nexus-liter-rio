import React, { useState, useMemo, useEffect } from "react";
import { SendHorizonal, Loader2, KeyRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import SlashCommandMenu from "./SlashCommandMenu";

export default function Composer({ onSend, sending, placeholder, allowByok }) {
  const [texto, setTexto] = useState("");
  const [byok, setByok] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: comandos = [] } = useQuery({
    queryKey: ["slashCommands"],
    queryFn: () => base44.entities.SlashCommand.list(),
    staleTime: 5 * 60 * 1000,
  });

  const menuAberto = texto.startsWith("/") && !texto.includes(" ") && !texto.includes("\n");
  const filtrados = useMemo(
    () => (menuAberto ? comandos.filter((c) => (c.comando || "").toLowerCase().startsWith(texto.toLowerCase())) : []),
    [menuAberto, comandos, texto]
  );
  useEffect(() => { setActiveIndex(0); }, [texto]);

  const autocompletar = (c) => setTexto(`${c.comando} `);

  const submit = () => {
    if (!texto.trim() || sending) return;
    onSend(texto.trim(), byok);
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
      {menuAberto && <SlashCommandMenu comandos={filtrados} activeIndex={activeIndex} onPick={autocompletar} />}
      <div className="flex items-end gap-3 bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-2xl p-3 shadow-2xl shadow-black/40">
        {allowByok && (
          <button
            onClick={() => setByok(!byok)}
            title={byok ? "Modo BYOK ativo: gera o System Prompt Master para sua IA externa" : "Ativar modo BYOK (Bring Your Own Key)"}
            className={`shrink-0 h-11 w-11 rounded-xl border flex items-center justify-center transition-colors ${byok ? "border-amber-500/60 text-amber-300 bg-amber-500/10" : "border-zinc-800 text-zinc-600 hover:text-zinc-400"}`}
          >
            <KeyRound className="w-4 h-4" />
          </button>
        )}
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder={placeholder || "Dite a narrativa... (digite / para comandos)"}
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