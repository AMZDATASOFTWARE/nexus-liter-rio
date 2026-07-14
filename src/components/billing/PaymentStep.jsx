import React, { useState, useMemo } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "./pricing";

function PaymentForm({ amount, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [erro, setErro] = useState(null);

  const pagar = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setErro(null);
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (error) {
      setErro(error.message);
      setProcessing(false);
      return;
    }
    await onSuccess(paymentIntent.id);
    setProcessing(false);
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      {erro && <p className="text-sm text-red-400">{erro}</p>}
      <Button onClick={pagar} disabled={!stripe || processing} className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950">
        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4 mr-2" /> Pagar {formatBRL(amount / 100)}</>}
      </Button>
    </div>
  );
}

export default function PaymentStep({ checkout, onSuccess, onBack }) {
  const stripePromise = useMemo(() => loadStripe(checkout.publishableKey), [checkout.publishableKey]);
  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Voltar aos pacotes
      </button>
      <p className="mb-4 text-sm text-zinc-400">
        {checkout.mensagens} Créditos de Mensagem + {checkout.integracoes} Créditos de Integração
      </p>
      <Elements stripe={stripePromise} options={{ clientSecret: checkout.clientSecret, appearance: { theme: "night", variables: { colorPrimary: "#f59e0b" } } }}>
        <PaymentForm amount={checkout.amount} onSuccess={onSuccess} />
      </Elements>
    </div>
  );
}