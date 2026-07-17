import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, FileText, Loader2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

export default function CharacterAssetsDialog({ open, onOpenChange, universeId, characterName }) {
  const [enviando, setEnviando] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["characterAssets", universeId, characterName],
    queryFn: () =>
      base44.entities.CharacterAsset.filter({ universe_id: universeId, character_name: characterName }, "-created_date", 20),
    enabled: open && !!universeId && !!characterName,
  });

  const enviarArquivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const tipo = file.type === "application/pdf" ? "pdf_ficha" : "imagem_personagem";
    setEnviando(true);
    try {
      const upload = await base44.integrations.Core.UploadFile({ file });
      await base44.functions.invoke("analisarReferenciaPersonagem", {
        universeId,
        characterName,
        tipo,
        fileUrl: upload.file_url,
        nomeArquivo: file.name,
      });
      queryClient.invalidateQueries({ queryKey: ["characterAssets", universeId, characterName] });
      toast({ title: "Referência analisada", description: `${file.name} foi processado e adicionado a ${characterName}.` });
    } catch (err) {
      toast({ title: "Falha ao processar referência", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ImagePlus className="w-4 h-4 text-amber-400" /> Referências de {characterName}
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Envie uma imagem ou PDF de referência — a IA extrai uma descrição que passa a ser usada consistentemente na
            escrita e nas ilustrações deste personagem.
          </DialogDescription>
        </DialogHeader>

        <label
          className={`flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 px-4 py-6 text-sm text-zinc-400 cursor-pointer hover:border-amber-500/40 hover:text-amber-300 transition-colors ${
            enviando ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {enviando ? "Analisando referência..." : "Enviar imagem ou PDF"}
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={enviarArquivo} disabled={enviando} />
        </label>

        <div className="space-y-2 mt-2">
          {isLoading && <p className="text-xs text-zinc-600">Carregando...</p>}
          {!isLoading && assets.length === 0 && <p className="text-xs text-zinc-600 italic">Nenhuma referência enviada ainda.</p>}
          {assets.map((a) => (
            <div key={a.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 flex gap-3">
              {a.tipo === "imagem_personagem" ? (
                <img src={a.file_url} alt={a.nome_arquivo} className="w-14 h-14 object-cover rounded-md border border-zinc-800 shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-md border border-zinc-800 bg-zinc-900 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-zinc-600" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs text-zinc-400 truncate">{a.nome_arquivo || (a.tipo === "imagem_personagem" ? "Imagem" : "PDF")}</p>
                <p className="text-[11px] text-zinc-500 mt-1 line-clamp-3">{a.descricao_extraida}</p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
