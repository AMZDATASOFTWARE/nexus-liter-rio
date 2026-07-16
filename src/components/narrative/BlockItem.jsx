import React from "react";
import { motion } from "framer-motion";
import { Eye, Sparkles, Brain } from "lucide-react";

export default function BlockItem({ block }) {
  if (block.type === "USER") {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
        <div className="max-w-[85%] md:max-w-[70%] rounded-2xl rounded-br-sm bg-indigo-500/10 border border-indigo-400/20 px-5 py-3.5">
          <p className="text-sm text-indigo-100/90 leading-relaxed">{block.content}</p>
        </div>
      </motion.div>
    );
  }
  if (block.type === "MEMORIA") {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center">
        <div className="w-full max-w-[88%] md:max-w-[78%] rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] px-5 py-4">
          <div className="flex items-center gap-1.5 mb-2 text-[11px] uppercase tracking-[0.15em] text-amber-400/70">
            <Brain className="w-3 h-3" /> Memória{block.memoria_character_name ? ` de ${block.memoria_character_name}` : ""}
          </div>
          <p className="text-[15px] leading-[1.85] text-amber-100/70 italic whitespace-pre-wrap" style={{ fontFamily: "'Spectral', Georgia, serif" }}>
            {block.content}
          </p>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {block.pov_character_name && (
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-amber-300/80 border border-amber-300/20 rounded-full px-3 py-1">
            <Eye className="w-3 h-3" /> POV · {block.pov_character_name}
          </span>
        )}
        {(block.agentes_acionados || []).map((a) => (
          <span key={a} className="inline-flex items-center gap-1.5 text-[11px] tracking-wide text-violet-300/70 border border-violet-300/15 rounded-full px-3 py-1">
            <Sparkles className="w-3 h-3" /> {a}
          </span>
        ))}
      </div>
      <p className="text-[17px] leading-[1.9] text-zinc-200 whitespace-pre-wrap" style={{ fontFamily: "'Spectral', Georgia, serif" }}>
        {block.content}
      </p>
      {block.psychological_state && (
        <p className="text-xs italic text-zinc-500">Estado psicológico: {block.psychological_state}</p>
      )}
    </motion.div>
  );
}