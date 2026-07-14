import React, { useState } from "react";
import { SendHorizonal, Loader2, KeyRound } from "lucide-react";

export default function Composer({ onSend, sending, placeholder, allowByok }) {
  const [texto, setTexto] = useState("");
  const [byok, setByok] = useState(false);
  const submit = () => {
    if (!texto.trim() || sending) return;
    onSend(texto.trim(), byok);
    setTexto("");
  };
  return (
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
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        rows={2}
        placeholder={placeholder || "Dite a narrativa..."}
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
  );
}