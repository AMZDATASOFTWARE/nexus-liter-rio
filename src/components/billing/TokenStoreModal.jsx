import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { PACOTES } from "./pricing";
import PackageCard from "./PackageCard";
import CustomPack from "./CustomPack";
import PaymentStep from "./PaymentStep";

export default function TokenStoreModal({ open, onOpenChange }) {
  const [checkout, setCheckout] = useState(null);
  const [recibo, setRecibo] = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [erro, setErro] = useState(null);

  const comprar = async (items) => {
    setLoadingItems(true);
    setErro(null);
    try {
      const res = await base44.functions.invoke("checkout", { acao: "criar", items });
      setCheckout(res.data);
    } catch (e) {
      setErro(e.response?.data?.error || e.message);
    } finally {
      setLoadingItems(false);
    }
  };

  const confirmar = async (paymentIntentId) => {
    try {
      const res = await base44.functions.invoke("checkout", { acao: "confirmar", paymentIntentId });
      setRecibo(res.data);
      setCheckout(null);
    } catch (e) {
      setErro(e.response?.data?.error || e.message);
    }
  };

  const fechar = (v) => {
    if (!v) {
      setCheckout(null);
      setRecibo(null);
      setErro(null);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-3xl bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-amber-400" /> Mercado Multiversal
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Recarregue sua energia: Créditos de Mensagem alimentam a prosa da IA; Créditos de Integração sustentam os Superagentes de background.
          </DialogDescription>
        </DialogHeader>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        {recibo ? (
          <div className="py-10 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
            <p className="font-display text-xl">Energia recarregada!</p>
            <p className="text-sm text-zinc-400">
              +{recibo.mensagens} mensagens e +{recibo.integracoes} integrações creditadas.
              <br />Saldo atual: {recibo.saldo_mensagem} mensagens · {recibo.saldo_integracao} integrações.
            </p>
            <Button onClick={() => fechar(false)} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100">Voltar à narrativa</Button>
          </div>
        ) : checkout ? (
          <PaymentStep checkout={checkout} onSuccess={confirmar} onBack={() => setCheckout(null)} />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PACOTES.map((p) => (
                <PackageCard key={p.id} pacote={p} onComprar={comprar} loading={loadingItems} />
              ))}
            </div>
            <CustomPack onComprar={comprar} loading={loadingItems} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}