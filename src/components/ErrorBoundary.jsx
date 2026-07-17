import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

// Rede de segurança contra erros de render não tratados: sem isso, o React desmonta a árvore
// inteira e a tela fica em branco, exigindo reload manual da página.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Erro não tratado capturado pelo ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] bg-[#08080f] text-zinc-100 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400" />
          <p className="font-display text-lg">Algo quebrou nesta tela.</p>
          <p className="text-sm text-zinc-500 max-w-sm">
            Um erro inesperado interrompeu esta parte do app. Tente novamente — se persistir, recarregue a página.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-3 text-sm font-medium text-white hover:scale-[1.03] active:scale-95 transition-transform"
          >
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
