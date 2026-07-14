import React from "react";
import { Terminal } from "lucide-react";

export default function SlashCommandMenu({ comandos, activeIndex, onPick }) {
  if (!comandos.length) return null;
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-zinc-800 bg-zinc-900/95 backdrop-blur shadow-2xl shadow-black/50 overflow-hidden z-20">
      <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
        <Terminal className="w-3 h-3" /> Comandos de sistema
      </p>
      <ul className="max-h-56 overflow-y-auto pb-1">
        {comandos.map((c, i) => (
          <li key={c.id}>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onPick(c); }}
              className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors ${i === activeIndex ? "bg-zinc-800/80" : "hover:bg-zinc-800/40"}`}
            >
              <span className="text-xs font-mono text-amber-400">{c.comando}</span>
              {c.descricao && <span className="text-[11px] text-zinc-500 leading-snug">{c.descricao}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}