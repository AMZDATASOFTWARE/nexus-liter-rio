import { BookOpen } from "lucide-react";
import { base44 } from "@/api/base44Client";
import GraphParticleBackground from "@/components/landing/GraphParticleBackground";
import LandingFooter from "@/components/landing/LandingFooter";
import HeroSection from "@/components/landing/sections/HeroSection";
import FactsStrip from "@/components/landing/sections/FactsStrip";
import PillarsSection from "@/components/landing/sections/PillarsSection";
import AudienceSection from "@/components/landing/sections/AudienceSection";
import ComparisonSection from "@/components/landing/sections/ComparisonSection";
import PricingSection from "@/components/landing/sections/PricingSection";
import FaqSection from "@/components/landing/sections/FaqSection";
import FinalCtaSection from "@/components/landing/sections/FinalCtaSection";

export default function Landing() {
  return (
    <div className="relative min-h-screen bg-[#08080f] text-zinc-100 overflow-hidden">
      <GraphParticleBackground className="fixed inset-0 z-0 w-full h-full" />

      <div className="relative z-10">
        <nav className="sticky top-0 z-20 backdrop-blur-xl bg-[#08080f]/80 border-b border-zinc-900">
          <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-300">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="font-display font-medium text-lg">Nexus Literário</span>
            </div>
            <div className="hidden md:flex items-center gap-7 text-sm text-zinc-400">
              <a href="#recursos" className="hover:text-zinc-100 transition-colors">
                Recursos
              </a>
              <a href="#para-quem" className="hover:text-zinc-100 transition-colors">
                Para quem é
              </a>
              <a href="#precos" className="hover:text-zinc-100 transition-colors">
                Preços
              </a>
              <a href="#faq" className="hover:text-zinc-100 transition-colors">
                FAQ
              </a>
            </div>
            <button
              onClick={() => base44.auth.redirectToLogin("/")}
              className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-2 text-sm font-medium text-white hover:scale-[1.03] active:scale-95 transition-transform"
            >
              Entrar
            </button>
          </div>
        </nav>

        <HeroSection />
        <FactsStrip />
        <PillarsSection />
        <AudienceSection />
        <ComparisonSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
        <LandingFooter />
      </div>
    </div>
  );
}
