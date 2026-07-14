import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import Stripe from 'npm:stripe@17.7.0';

// Precificação estrita (em centavos de BRL)
const PRECO_MENSAGEM = 100; // R$ 1,00
const PRECO_INTEGRACAO = 4; // R$ 0,04

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const { acao, items, paymentIntentId } = await req.json();

    // ----- Confirmação: verifica o pagamento no Stripe e credita a carteira -----
    if (acao === 'confirmar') {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (pi.metadata.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (pi.status !== 'succeeded') return Response.json({ error: 'Pagamento ainda não confirmado' }, { status: 400 });
      if (pi.metadata.creditado === 'true') return Response.json({ ok: true, ja_creditado: true });
      // Trava anti-crédito duplo antes de creditar
      await stripe.paymentIntents.update(pi.id, { metadata: { ...pi.metadata, creditado: 'true' } });

      const sdk = base44.asServiceRole;
      const mensagens = parseInt(pi.metadata.mensagens || '0', 10);
      const integracoes = parseInt(pi.metadata.integracoes || '0', 10);
      const carteiras = await sdk.entities.UserWallet.filter({ user_id: user.id });
      const wallet = carteiras[0] || await sdk.entities.UserWallet.create({ user_id: user.id, creditos_mensagem: 5, creditos_integracao: 20 });
      const atualizada = await sdk.entities.UserWallet.update(wallet.id, {
        creditos_mensagem: (wallet.creditos_mensagem || 0) + mensagens,
        creditos_integracao: (wallet.creditos_integracao || 0) + integracoes
      });
      return Response.json({ ok: true, mensagens, integracoes, saldo_mensagem: atualizada.creditos_mensagem, saldo_integracao: atualizada.creditos_integracao });
    }

    // ----- Criação: calcula o valor SEMPRE no servidor e gera o PaymentIntent -----
    const mensagens = Math.max(0, Math.floor(Number(items?.mensagens) || 0));
    const integracoes = Math.max(0, Math.floor(Number(items?.integracoes) || 0));
    if (!mensagens && !integracoes) return Response.json({ error: 'Selecione ao menos um crédito' }, { status: 400 });
    const amount = mensagens * PRECO_MENSAGEM + integracoes * PRECO_INTEGRACAO;
    if (amount < 50) return Response.json({ error: 'O valor mínimo da compra é R$ 0,50' }, { status: 400 });

    const pi = await stripe.paymentIntents.create({
      amount,
      currency: 'brl',
      automatic_payment_methods: { enabled: true },
      description: `Mercado Multiversal — ${mensagens} Créditos de Mensagem + ${integracoes} Créditos de Integração`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID') || '',
        user_id: user.id,
        mensagens: String(mensagens),
        integracoes: String(integracoes)
      }
    });
    return Response.json({ clientSecret: pi.client_secret, publishableKey: Deno.env.get('STRIPE_PUBLISHABLE_KEY'), amount, mensagens, integracoes });
  } catch (error) {
    console.error('checkout error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});