import React, { useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

export default function ZoomBar({ onZoom, initial = 0.5 }) {
  const [t, setT] = useState(initial);
  const change = (e) => {
    const v = Number(e.target.value);
    setT(v);
    onZoom?.(v);
  };
  return (
    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 bg-zinc-900/80 backdrop-blur border border-zinc-700 rounded-full px-2.5 py-1.5 opacity-80 hover:opacity-100 transition-opacity">
      <ZoomOut className="w-3 h-3 text-zinc-500" />
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={t}
        onChange={change}
        className="w-24 h-1 accent-emerald-400 cursor-pointer"
      />
      <ZoomIn className="w-3 h-3 text-zinc-500" />
    </div>
  );
}