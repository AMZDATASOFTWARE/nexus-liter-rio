import React, { useState } from "react";
import { SendHorizonal, Loader2 } from "lucide-react";

export default function Composer({ onSend, sending, placeholder }) {
  const [texto, setTexto] = useState("");
  const submit = () => {
    if (!texto.trim() || sending) return;
    onSend(texto.trim());
    setTexto("");
  };
  return (
    <div className="flex items-end gap-3 bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-2xl p-3 shadow-2xl shadow-black/40">
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