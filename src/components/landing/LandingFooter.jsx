import { COMPANY } from "@/lib/company";

export default function LandingFooter() {
  return (
    <footer className="border-t border-zinc-900 px-5 py-10 text-center">
      <p className="font-display text-zinc-300 mb-1">Nexus Literário</p>
      <p className="text-sm text-zinc-500">
        Desenvolvido por <span className="text-zinc-300 font-medium">{COMPANY.developer}</span>
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.15em] text-violet-400">{COMPANY.legalName}</p>
      <p className="mt-1 text-xs text-zinc-600">CNPJ: {COMPANY.cnpj}</p>
      <p className="mt-1 text-xs text-zinc-600">
        <a href={`mailto:${COMPANY.email}`} className="hover:text-zinc-400 transition-colors">
          {COMPANY.email}
        </a>
        <span className="mx-2 text-zinc-800">|</span>
        <a href={`tel:${COMPANY.phoneHref}`} className="hover:text-zinc-400 transition-colors">
          {COMPANY.phone}
        </a>
      </p>
      <p className="mt-4 text-xs text-zinc-700">© {new Date().getFullYear()} Nexus Literário · Todos os direitos reservados</p>
    </footer>
  );
}
