import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldAlert, Loader2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import PolishingStudio from "@/components/narrative/PolishingStudio";
import { compilarCapitulosDaHistoria } from "@/components/narrative/compilarLivro";

const FRASE_CONFIRMACAO = "APAGAR TUDO";

const RESUMO_LABELS = {
  Universe: "Universos",
  Story: "Histórias",
  Character: "Personagens",
  NarrativeBlock: "Blocos narrativos",
  CharacterMemory: "Memórias",
  WorldObject: "Objetos",
  Local: "Locais",
  GraphNode: "Nós do grafo",
  GraphEdge: "Arestas do grafo",
  KnowledgeSource: "Fontes de conhecimento",
  OntologyType: "Tipos de ontologia",
};

export default function AdminPage() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // idle | confirmando | compilando | estudio | confirmacaoFinal | resetando
  const [etapa, setEtapa] = useState("idle");
  const [progressoGeral, setProgressoGeral] = useState(null);
  const [megaLivro, setMegaLivro] = useState(null);
  const [textoConfirmacao, setTextoConfirmacao] = useState("");
  const canceladoRef = useRef(false);

  const ehAdmin = user?.role === "admin";

  const { data: preview, isLoading: carregandoPreview } = useQuery({
    queryKey: ["reset-preview"],
    queryFn: async () => (await base44.functions.invoke("resetSistema", { preview: true })).data,
    enabled: ehAdmin,
  });

  useEffect(() => {
    if (!isLoadingAuth && !ehAdmin) navigate("/", { replace: true });
  }, [isLoadingAuth, ehAdmin, navigate]);

  const iniciarGeracaoDoBackup = async () => {
    setEtapa("compilando");
    canceladoRef.current = false;
    try {
      const universos = preview?.universos || [];
      const historias = preview?.historias || [];

      if (!historias.length) {
        setMegaLivro({
          titulo_historia: "Arquivo Definitivo do Multiverso",
          nome_universo: "Nenhum conteúdo narrativo",
          titulo_capitulo: new Date().toLocaleDateString("pt-BR"),
          texto_compilado_markdown: "*O sistema já está vazio de histórias e universos.*",
        });
        setEtapa("estudio");
        return;
      }

      const partes = [];
      let contador = 0;
      for (const uni of universos) {
        const historiasDoUniverso = historias.filter((s) => s.universe_id === uni.id);
        if (!historiasDoUniverso.length) continue;

        const blocosDaHistoria = [];
        for (const story of historiasDoUniverso) {
          if (canceladoRef.current) return;
          contador += 1;
          setProgressoGeral({ atual: contador, total: historias.length, universo: uni.name, historia: story.title });
          try {
            const capitulos = await compilarCapitulosDaHistoria(story.id, "integrado", null, () => canceladoRef.current);
            if (!capitulos) return; // cancelado no meio de uma história
            const corpo =
              capitulos.length === 1
                ? capitulos[0].texto_compilado_markdown
                : capitulos
                    .map((c, i) => `**Capítulo ${i + 1} — ${c.titulo_capitulo || ""}**\n\n${c.texto_compilado_markdown}`)
                    .join("\n\n");
            blocosDaHistoria.push(`## ${story.title}\n\n${corpo}`);
          } catch (e) {
            blocosDaHistoria.push(`## ${story.title}\n\n*⚠ Falha ao compilar esta história: ${e.response?.data?.error || e.message}*`);
          }
        }
        if (blocosDaHistoria.length) partes.push(`# ${uni.name}\n\n${blocosDaHistoria.join("\n\n")}`);
      }
      if (canceladoRef.current) return;

      setMegaLivro({
        titulo_historia: "Arquivo Definitivo do Multiverso",
        nome_universo: `${universos.length} universo${universos.length === 1 ? "" : "s"} · ${historias.length} história${historias.length === 1 ? "" : "s"}`,
        titulo_capitulo: new Date().toLocaleDateString("pt-BR"),
        texto_compilado_markdown: partes.join("\n\n"),
      });
      setEtapa("estudio");
    } catch (e) {
      toast({ title: "Falha ao gerar o backup literário", description: e.response?.data?.error || e.message, variant: "destructive" });
      setEtapa("idle");
    } finally {
      setProgressoGeral(null);
    }
  };

  const cancelarCompilacao = () => {
    canceladoRef.current = true;
    setEtapa("idle");
    setProgressoGeral(null);
  };

  const fecharEstudio = () => {
    setMegaLivro(null);
    setEtapa("confirmacaoFinal");
  };

  const confirmarReset = async () => {
    setEtapa("resetando");
    try {
      const res = await base44.functions.invoke("resetSistema", { confirmacao: FRASE_CONFIRMACAO });
      const total = Object.values(res.data.apagados || {}).reduce((soma, e) => soma + (e.apagados || 0), 0);
      toast({ title: "Sistema resetado", description: `${total} registros apagados. Créditos zerados: ${res.data.creditosZerados}.` });
      queryClient.invalidateQueries();
      navigate("/", { replace: true });
    } catch (e) {
      toast({ title: "Falha ao resetar o sistema", description: e.response?.data?.error || e.message, variant: "destructive" });
      setEtapa("idle");
    } finally {
      setTextoConfirmacao("");
    }
  };

  if (isLoadingAuth || !ehAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080f]">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080f] text-zinc-100">
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#08080f]/80 border-b border-zinc-900">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link to="/" className="text-zinc-500 hover:text-zinc-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display text-lg">Administração</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-10 space-y-6">
        <div className="rounded-2xl border border-red-900/40 bg-red-950/10 p-6">
          <div className="flex items-center gap-2 text-red-300">
            <ShieldAlert className="w-5 h-5" />
            <h2 className="font-display text-base">Zona de risco</h2>
          </div>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
            Reseta o sistema por completo: apaga todos os universos, histórias, personagens, memórias, objetos, locais e o grafo
            omniversal. Fontes de conhecimento e tipos de ontologia também são apagados. Comandos de barra são preservados. Os
            créditos de todos os usuários são zerados. <strong className="text-red-200">Esta ação não pode ser desfeita.</strong>
          </p>

          {carregandoPreview ? (
            <p className="text-xs text-zinc-600 mt-4 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando estado atual...
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {Object.entries(RESUMO_LABELS).map(([chave, label]) => (
                <div key={chave} className="flex justify-between rounded-lg border border-zinc-800/80 px-3 py-2">
                  <span className="text-zinc-500">{label}</span>
                  <span className="text-zinc-200 font-medium">
                    {preview?.contagens?.[chave]?.contagem ?? 0}
                    {preview?.contagens?.[chave]?.aproximado ? "+" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={() => setEtapa("confirmando")}
            disabled={carregandoPreview}
            className="mt-5 bg-red-600 hover:bg-red-500 text-white font-medium"
          >
            <AlertTriangle className="w-4 h-4 mr-2" /> Resetar Sistema
          </Button>
        </div>
      </div>

      {/* Passo 1: confirmação inicial com as contagens */}
      <AlertDialog open={etapa === "confirmando"} onOpenChange={(open) => !open && setEtapa("idle")}>
        <AlertDialogContent className="bg-[#0b0b14] border-zinc-800 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Isso vai apagar {preview?.contagens?.Universe?.contagem ?? 0} universos e {preview?.contagens?.Story?.contagem ?? 0} histórias
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Nada disso pode ser desfeito. Antes de liberar a exclusão, o sistema vai compilar um Mega Livro com todas as
              histórias, para você revisar e baixar como backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-900">Cancelar</AlertDialogCancel>
            <Button onClick={iniciarGeracaoDoBackup} className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium">
              Continuar e gerar backup literário
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Passo 2: compilando o Mega Livro */}
      {etapa === "compilando" && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#0b0b14] p-6 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-amber-300 mx-auto mb-3" />
            <p className="text-sm text-zinc-200">
              {progressoGeral
                ? `Compilando história ${progressoGeral.atual} de ${progressoGeral.total} (${progressoGeral.universo})...`
                : "Preparando o Mega Livro..."}
            </p>
            {progressoGeral?.historia && <p className="text-xs text-zinc-500 mt-1 truncate">{progressoGeral.historia}</p>}
            {progressoGeral && (
              <div className="mt-3 h-1 rounded-full bg-zinc-900 overflow-hidden">
                <div
                  className="h-full bg-amber-500/70 transition-all"
                  style={{ width: `${(progressoGeral.atual / progressoGeral.total) * 100}%` }}
                />
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={cancelarCompilacao} className="mt-4 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Passo 3: revisão do Mega Livro no Estúdio de Lapidação (reaproveitado sem alterações) */}
      {etapa === "estudio" && megaLivro && <PolishingStudio livro={megaLivro} onClose={fecharEstudio} />}

      {/* Passo 4: confirmação final destrutiva, com digitação exata */}
      <AlertDialog open={etapa === "confirmacaoFinal" || etapa === "resetando"} onOpenChange={(open) => !open && etapa !== "resetando" && setEtapa("idle")}>
        <AlertDialogContent className="bg-[#0b0b14] border-red-900/40 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-300">Confirmação final</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Você já baixou o backup? Digite <strong className="text-zinc-200">{FRASE_CONFIRMACAO}</strong> para confirmar a
              exclusão irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            value={textoConfirmacao}
            onChange={(e) => setTextoConfirmacao(e.target.value)}
            disabled={etapa === "resetando"}
            placeholder={FRASE_CONFIRMACAO}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-red-500/50"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={etapa === "resetando"} className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-900">
              Cancelar
            </AlertDialogCancel>
            <Button
              onClick={confirmarReset}
              disabled={textoConfirmacao !== FRASE_CONFIRMACAO || etapa === "resetando"}
              className="bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 disabled:pointer-events-none"
            >
              {etapa === "resetando" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
              Resetar sistema
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
