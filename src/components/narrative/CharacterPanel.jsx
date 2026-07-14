import React from "react";
import { Eye } from "lucide-react";

export default function CharacterPanel({ characters, povName, inScene = [] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-medium">Personagens</h3>
      {characters.length === 0 && <p className="text-xs text-zinc-600 italic">Nenhum personagem ainda.</p>}
      {characters.map((c) => {
        const isPov = c.name === povName;
        return (
          <div key={c.id} className={`rounded-xl border p-3.5 transition-colors ${isPov ? "border-amber-400/30 bg-amber-400/5" : "border-zinc-800 bg-zinc-900/50"}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-zinc-100 font-medium">{c.name}</p>
              {isPov && <Eye className="w-3.5 h-3.5 text-amber-300/80" />}
            </div>
            {c.description && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{c.description}</p>}
            {c.psychological_state && (
              <p className="text-[11px] italic text-violet-300/60 mt-1.5">{c.psychological_state}</p>
            )}
            {inScene.includes(c.name) && (
              <span className="inline-block mt-2 text-[10px] uppercase tracking-widest text-emerald-300/70">em cena</span>
            )}
          </div>
        );
      })}
    </div>
  );
}