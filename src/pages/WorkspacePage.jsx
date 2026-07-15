import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Loader2, PenLine, Network } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import StoryPage from "@/pages/StoryPage";
import GraphPage from "@/pages/GraphPage";

function PanelTabs({ view, onChange, showBack }) {
  const tabs = [
    { key: "story", label: "Escrever", icon: PenLine, active: "border-violet-500/50 text-violet-300 bg-violet-500/10" },
    { key: "graph", label: "Megagrafo", icon: Network, active: "border-amber-500/50 text-amber-300 bg-amber-500/10" },
  ];
  return (
    <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-[#0b0b14] border-b border-zinc-900">
      {showBack && (
        <Link to="/" className="text-zinc-600 hover:text-zinc-300 transition-colors mr-1" title="Voltar ao início">
          <ArrowLeft className="w-4 h-4" />
        </Link>
      )}
      {tabs.map(({ key, label, icon: Icon, active }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full border transition-colors ${
            view === key ? active : "border-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Icon className="w-3.5 h-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}

function PanelView({ view, storyId, universeId }) {
  if (view === "story") {
    return <StoryPage storyIdProp={storyId} />;
  }
  if (!universeId) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-600">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  return <GraphPage universeIdProp={universeId} />;
}

export default function WorkspacePage() {
  const { id } = useParams();
  const [leftView, setLeftView] = useState("story");
  const [rightView, setRightView] = useState("graph");

  const { data: story } = useQuery({
    queryKey: ["story", id],
    queryFn: () => base44.entities.Story.get(id),
  });

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#08080f] text-zinc-100">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        <ResizablePanel defaultSize={50} minSize={25} className="flex flex-col min-w-0">
          <PanelTabs view={leftView} onChange={setLeftView} showBack />
          <div className="flex-1 min-h-0 overflow-hidden">
            <PanelView view={leftView} storyId={id} universeId={story?.universe_id} />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-zinc-900" />
        <ResizablePanel defaultSize={50} minSize={25} className="flex flex-col min-w-0">
          <PanelTabs view={rightView} onChange={setRightView} />
          <div className="flex-1 min-h-0 overflow-hidden">
            <PanelView view={rightView} storyId={id} universeId={story?.universe_id} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}