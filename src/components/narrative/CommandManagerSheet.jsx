import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Loader2, Terminal } from "lucide-react";

const INTENTS = ["Continuar", "Mudar_POV", "Criar_Nova_Historia", "Ramificar", "Colidir_Genesis"];
const VAZIO = { comando: "", descricao: "", intencao_forcada: "Continuar", instrucao_adicional_sistema: "" };

export default function CommandManagerSheet({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(VAZIO);

  const { data: comandos = [], isLoading } = useQuery({
    queryKey: ["slashCommands"],
    queryFn: () => base44.entities.SlashCommand.list(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["slashCommands"] });
  const criar = useMutation({
    mutationFn: (dados) => base44.entities.SlashCommand.create(dados),
    onSuccess: () => { invalidate(); setForm(VAZIO); },
  });
  const excluir = useMutation({
    mutationFn: (cmdId) => base44.entities.SlashCommand.delete(cmdId),
    onSuccess: invalidate,
  });

  const submit = (e) => {
    e.preventDefault();
    let cmd = form.comando.trim().toLowerCase().replace(/\s+/g, "_");
    if (!cmd) return;
    if (!cmd.startsWith("/")) cmd = `/${cmd}`;
    criar.mutate({ ...form, comando: cmd });
  };

  const inputCls = "w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-500/50";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-[#0b0b14] border-zinc-800 text-zinc-100 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-zinc-100 flex items-center gap-2 font-display">
            <Terminal className="w-4 h-4 text-amber-400" /> Arsenal de Comandos
          </SheetTitle>
          <SheetDescription className="text-zinc-500 text-xs">
            Cadastre Slash Commands customizados que forçam intenções no Orquestrador e injetam instruções diretas na IA Narradora.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            value={form.comando}
            onChange={(e) => setForm({ ...form, comando: e.target.value })}
            placeholder="/sussurrar"
            className={`${inputCls} font-mono text-amber-300`}
          />
          <input
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            placeholder="Descrição exibida no menu do composer"
            className={inputCls}
          />
          <Select value={form.intencao_forcada} onValueChange={(v) => setForm({ ...form, intencao_forcada: v })}>
            <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 text-sm">
              <SelectValue placeholder="Intenção forçada" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
              {INTENTS.map((i) => <SelectItem key={i} value={i}>{i.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <textarea
            value={form.instrucao_adicional_sistema}
            onChange={(e) => setForm({ ...form, instrucao_adicional_sistema: e.target.value })}
            rows={4}
            placeholder="Instrução adicional: como a IA deve agir ao receber este comando..."
            className={`${inputCls} resize-none`}
          />
          <button
            type="submit"
            disabled={criar.isPending || !form.comando.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-amber-500/90 to-orange-600/90 text-zinc-950 text-sm font-medium py-2 disabled:opacity-40 transition-all hover:brightness-110"
          >
            {criar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Cadastrar comando
          </button>
        </form>

        <div className="mt-8">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Comandos cadastrados</p>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
          ) : comandos.length === 0 ? (
            <p className="text-xs text-zinc-600">Nenhum comando cadastrado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {comandos.map((c) => (
                <li key={c.id} className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-amber-400">{c.comando}</p>
                    {c.descricao && <p className="text-[11px] text-zinc-500 leading-snug">{c.descricao}</p>}
                    <p className="text-[10px] text-zinc-600 mt-0.5">→ {c.intencao_forcada?.replace(/_/g, " ")}</p>
                  </div>
                  <button
                    onClick={() => excluir.mutate(c.id)}
                    disabled={excluir.isPending}
                    className="shrink-0 p-1.5 rounded-md text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Excluir comando"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}