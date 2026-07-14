import React, { useState } from "react";
import { BookDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import PolishingStudio from "./PolishingStudio";

export default function BookExporter({ storyId }) {
  const [loading, setLoading] = useState(false);
  const [livro, setLivro] = useState(null);
  const { toast } = useToast();

  const abrirEstudio = async () => {
    setLoading(true);
    toast({ title: "Compilando seu livro nos bastidores...", description: "O Compilador de Cânone está polindo sua história." });
    try {
      const res = await base44.functions.invoke("exportarLivro", { storyId });
      setLivro(res.data);
    } catch (e) {
      toast({ title: "Falha ao compilar o livro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={abrirEstudio}
        disabled={loading}
        title="Lapidar e exportar como livro (PDF)"
        className="shrink-0 h-9 w-9 rounded-lg bg-transparent border-zinc-800 text-zinc-500 hover:text-amber-300 hover:border-amber-500/40 hover:bg-transparent transition-colors"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookDown className="w-4 h-4" />}
      </Button>
      {livro && <PolishingStudio livro={livro} onClose={() => setLivro(null)} />}
    </>
  );
}