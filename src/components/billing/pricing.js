export const PRECO_MENSAGEM = 1.0; // R$ por crédito de mensagem
export const PRECO_INTEGRACAO = 0.04; // R$ por crédito de integração

export const PACOTES = [
  {
    id: "genesis",
    nome: "Pacote Gênesis",
    mensagens: 20,
    integracoes: 200,
    valor: 28.0,
    popular: false,
  },
  {
    id: "multiverso",
    nome: "Pacote Multiverso",
    mensagens: 50,
    integracoes: 500,
    valor: 70.0,
    popular: true,
  },
  {
    id: "omniversal",
    nome: "Pacote Omniversal",
    mensagens: 100,
    integracoes: 1000,
    valor: 140.0,
    popular: false,
  },
];

export const formatBRL = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });