// Container estável e dedicado para portais React — nunca portar direto pro document.body,
// porque scripts de terceiros (ex: Stripe.js) também inserem/removem elementos como filhos
// diretos do <body>, e podem colidir com a reconciliação do React (erro "Failed to execute
// 'insertBefore' on 'Node': the node before which the new node is to be inserted is not a
// child of this node" — a referência de um vizinho sumiu por baixo do React).
let root = null;

export function obterPortalRoot() {
  if (!root) {
    root = document.createElement("div");
    root.id = "nexus-portal-root";
    document.body.appendChild(root);
  }
  return root;
}
