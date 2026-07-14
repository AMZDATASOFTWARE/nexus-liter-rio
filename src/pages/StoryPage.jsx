import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Loader2, Users, Network, Terminal, BookOpen, Coins } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import TokenStoreModal from "@/components/billing/TokenStoreModal";
import CommandManagerSheet from "@/components/narrative/CommandManagerSheet";
import ChapterPanel from "@/components/narrative/ChapterPanel";
import BookExporter from "@/components/narrative/BookExporter";
import BlockItem from "@/components/narrative/BlockItem";
import Composer from "@/components/narrative/Composer";
import CharacterPanel from "@/components/narrative/CharacterPanel";
import ByokPromptPanel from "@/components/narrative/ByokPromptPanel";

export default function StoryPage() {
  const { id } = useParams();
  const isNew = id === "nova";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [showChars, setShowChars] = useState(false);
  const [byokPrompt, setByokPrompt] = useState(null);
  const [showCommands, setShowCommands] = useState(false);
  const [capitulo, setCapitulo] = useState(null);
  const [showStore, setShowStore] = useState(false);
  const [compilando, setCompilando] = useState(false);
  const { toast } = useToast();

  const compilarCapitulo = async () => {
    setCompilando(true);
    try {
      const res = await base44.functions.invoke("compilarCanone", { storyId: id });
      setCapitulo(res.data);
    } finally {
      setCompilando(false);
    }
  };
  const bottomRef = useRef(null);

  const { data: story } = useQuery({
    queryKey: ["story", id],
    queryFn: () => base44.entities.Story.get(id),
    enabled: !isNew,
  });
  const { data: blocks = [] } = useQuery({
    queryKey: ["blocks", id],
    queryFn: () => base44.entities.NarrativeBlock.filter({ story_id: id }, "created_date", 500),
    enabled: !isNew,
  });
  const { data: characters = [] } = useQuery({
    queryKey: ["characters", story?.universe_id],
    queryFn: () => base44.entities.Character.filter({ universe_id: story.universe_id }),
    enabled: !!story,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [blocks.length]);

  const send = async (texto, modoByok, ritmoCena) => {
    setSending(true);
    try {
      const res = await base44.functions.invoke("orquestrador", {
        texto,
        storyId: isNew ? null : id,
        modoByok: !isNew && !!modoByok,
        ritmoCena,
      });
      if (res.data?.system_prompt_master) setByokPrompt(res.data.system_prompt_master);
      if (isNew && res.data?.storyId) {
        navigate(`/historia/${res.data.storyId}`, { replace: true });
      } else if (res.data?.storyId && res.data.storyId !== id) {
        // Paradoxo: a realidade bifurcou para uma nova linha temporal
        navigate(`/historia/${res.data.storyId}`);
      } else {
        queryClient.invalidateQueries({ queryKey: ["blocks", id] });
        queryClient.invalidateQueries({ queryKey: ["story", id] });
        queryClient.invalidateQueries({ queryKey: ["characters", story?.universe_id] });
      }
    } catch (e) {
      const status = e.response?.status;
      const msg = e.response?.data?.error || e.message;
      if (status === 402) setShowStore(true);
      toast({
        title: status === 402 ? "Créditos insuficientes" : "A narrativa falhou neste turno",
        description: msg,
        variant: "destructive",
        duration: 8000,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08080f] text-zinc-100 flex flex-col">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#08080f]/80 border-b border-zinc-900">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-display text-lg truncate">{isNew ? "Nova História" : story?.title || "..."}</h1>
              {story?.current_pov_name && (
                <p className="text-[11px] text-amber-300/70 tracking-wide">POV · {story.current_pov_name}</p>
              )}
            </div>
          </div>
          {!isNew && story?.universe_id && (
            <Link to={`/grafo/${story.universe_id}`} className="shrink-0 p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-emerald-300 hover:border-emerald-500/40 transition-colors" title="Megagrafo do universo">
              <Network className="w-4 h-4" />
            </Link>
          )}
          {!isNew && <BookExporter storyId={id} />}
          {!isNew && (
            <button onClick={compilarCapitulo} disabled={compilando} className="shrink-0 p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-amber-300 hover:border-amber-500/40 transition-colors disabled:opacity-50" title="Compilar capítulo (Compilador de Cânone)">
              {compilando ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
            </button>
          )}
          <button onClick={() => setShowStore(true)} className="shrink-0 p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-amber-300 hover:border-amber-500/40 transition-colors" title="Mercado Multiversal — comprar créditos">
            <Coins className="w-4 h-4" />
          </button>
          <button onClick={() => setShowCommands(true)} className="shrink-0 p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-amber-300 hover:border-amber-500/40 transition-colors" title="Arsenal de Comandos">
            <Terminal className="w-4 h-4" />
          </button>
          {!isNew && (
            <button onClick={() => setShowChars(!showChars)} className={`shrink-0 p-2 rounded-lg border transition-colors ${showChars ? "border-violet-500/40 text-violet-300" : "border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}>
              <Users className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 max-w-4xl w-full mx-auto px-5 flex gap-8">
        <main className="flex-1 py-10 space-y-10 pb-44 min-w-0">
          {isNew && blocks.length === 0 && (
            <div className="text-center py-24 space-y-3">
              <p className="font-display text-2xl text-zinc-400">O zero absoluto.</p>
              <p className="text-sm text-zinc-600 max-w-sm mx-auto">Dite o início da sua história e o Criador de Gênesis dará forma ao universo, aos personagens e à primeira cena.</p>
            </div>
          )}
          {blocks.map((b) => <BlockItem key={b.id} block={b} />)}
          {sending && (
            <div className="flex items-center gap-3 text-violet-300/70 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="animate-pulse">Orquestrador delegando aos Superagentes...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </main>
        {showChars && !isNew && (
          <aside className="hidden md:block w-64 shrink-0 py-10 pb-44">
            <CharacterPanel characters={characters} povName={story?.current_pov_name} inScene={story?.characters_in_scene || []} />
          </aside>
        )}
      </div>

      {showChars && !isNew && (
        <div className="md:hidden fixed inset-x-0 bottom-28 z-30 max-h-64 overflow-y-auto bg-[#0b0b14] border-t border-zinc-800 px-5 py-4">
          <CharacterPanel characters={characters} povName={story?.current_pov_name} inScene={story?.characters_in_scene || []} />
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 z-20 bg-gradient-to-t from-[#08080f] via-[#08080f]/95 to-transparent pt-10 pb-5 px-5">
        <div className="max-w-3xl mx-auto">
          <Composer onSend={send} sending={sending} allowByok={!isNew} storyId={isNew ? null : id} placeholder={isNew ? "Dite o início da história..." : "Continue a narrativa, mude o POV ou introduza algo novo..."} />
        </div>
      </div>

      {byokPrompt && <ByokPromptPanel prompt={byokPrompt} onClose={() => setByokPrompt(null)} />}
      <CommandManagerSheet open={showCommands} onOpenChange={setShowCommands} />
      {capitulo && <ChapterPanel capitulo={capitulo} onClose={() => setCapitulo(null)} />}
      <TokenStoreModal open={showStore} onOpenChange={setShowStore} />
    </div>
  );
}