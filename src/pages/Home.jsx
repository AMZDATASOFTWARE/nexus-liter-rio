import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Sparkles, BookOpen, LayoutDashboard, BookMarked, Shield } from "lucide-react";
import GlitchWrapper from "@/components/GlitchWrapper";
import GlitchSound from "@/components/GlitchSound";
import { useAuth } from "@/lib/AuthContext";

export default function Home() {
  const { user } = useAuth();
  const { data: stories = [], isLoading } = useQuery({
    queryKey: ["stories"],
    queryFn: () => base44.entities.Story.list("-updated_date", 50),
  });
  const { data: universes = [] } = useQuery({
    queryKey: ["universes"],
    queryFn: () => base44.entities.Universe.list(),
  });
  const uniName = (id) => universes.find((u) => u.id === id)?.name || "";

  return (
    <div className="min-h-screen bg-[#08080f] text-zinc-100">
      <GlitchSound />
      {user?.role === "admin" && (
        <Link
          to="/admin"
          title="Administração"
          className="fixed top-4 right-4 z-20 p-2 rounded-lg border border-zinc-800 text-zinc-600 hover:text-red-300 hover:border-red-500/40 transition-colors"
        >
          <Shield className="w-4 h-4" />
        </Link>
      )}
      <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6">
          <GlitchWrapper>
            <p className="text-[11px] uppercase tracking-[0.4em] text-violet-300/60">Sistema Literário Multiversal</p>
          </GlitchWrapper>
          <GlitchWrapper delay={0.4}>
            <h1 className="text-5xl md:text-6xl font-display font-light tracking-tight bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
              Motor Narrativo
            </h1>
          </GlitchWrapper>
          <GlitchWrapper delay={0.9}>
            <p className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">
              Dite sua história. O Orquestrador Mestre delega cada palavra à rede de Superagentes que escrevem, transitam consciências e mantêm o multiverso coerente.
            </p>
          </GlitchWrapper>
          <GlitchWrapper delay={1.3} className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              to="/historia/nova"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-7 py-3.5 text-sm font-medium text-white hover:scale-[1.03] active:scale-95 transition-transform shadow-lg shadow-indigo-900/40"
            >
              <Sparkles className="w-4 h-4" /> Iniciar Gênesis
            </Link>
            <Link
              to="/conhecimento"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-7 py-3.5 text-sm font-medium text-zinc-300 hover:border-violet-500/40 hover:text-white transition-colors"
            >
              <BookMarked className="w-4 h-4" /> Base de Conhecimento
            </Link>
          </GlitchWrapper>
        </motion.div>

        <div className="mt-20 space-y-3">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-zinc-600 mb-5">Histórias do multiverso</h2>
          {isLoading && <p className="text-zinc-600 text-sm">Carregando...</p>}
          {!isLoading && stories.length === 0 && (
            <p className="text-zinc-700 text-sm italic">O multiverso ainda está vazio. Inicie a Gênesis.</p>
          )}
          {stories.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link
                to={`/workspace/${s.id}`}
                className="group flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-6 py-5 hover:border-violet-500/30 hover:bg-zinc-900/70 transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <BookOpen className="w-5 h-5 text-violet-400/60 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-zinc-100 font-medium truncate">{s.title}</p>
                    <p className="text-xs text-zinc-600 truncate">
                      {uniName(s.universe_id)}{s.current_pov_name ? ` · POV: ${s.current_pov_name}` : ""}
                    </p>
                  </div>
                </div>
                <LayoutDashboard className="w-4 h-4 text-zinc-700 group-hover:text-violet-300 group-hover:translate-x-1 transition-all shrink-0" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}