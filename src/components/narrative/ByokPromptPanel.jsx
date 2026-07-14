import React, { useState } from "react";
import { X, Copy, Check, KeyRound } from "lucide-react";

export default function ByokPromptPanel({ prompt, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-[#0b0b14] border border-amber-500/30 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-amber-300">
            <KeyRound className="w-4 h-4" />
            <h2 className="text-sm font-medium tracking-wide">System Prompt Master (BYOK)</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copy} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 transition-colors">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
            <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <pre className="flex-1 overflow-y-auto px-5 py-4 text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">{prompt}</pre>
        <p className="px-5 py-3 border-t border-zinc-800 text-[11px] text-zinc-600">Cole este prompt como instrução de sistema na sua IA externa para ela escrever a próxima cena.</p>
      </div>
    </div>
  );
}