import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2, PenLine, Network } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import StoryPage from "./StoryPage";
import GraphPage from "./GraphPage";

function ViewTabs({ view, onChange }) {
  const tabs = [
    { key: "story", label: "Escrever", icon: PenLine, active: "border-violet-500/50 text-violet-300 bg-violet-500/10" },
    { key: "graph", label: "Megagrafo", icon: Network, active: "border-amber-500/50 text-amber-300 bg-amber-500/10" },
  ];
  return (
    <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-[#0b0b14] border-b border-zinc-900">
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

function PanelContent({ view, storyId, universeId }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {view === "story" ? (
        <StoryPage storyIdProp={storyId} />
      ) : universeId ? (
        <GraphPage universeIdProp={universeId} />
      ) : (
        <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
          Universo ainda não identificado para esta história.
        </div>
      )}
    </div>
  );
}

export default function WorkspacePage() {
  const { storyId } = useParams();
  const [leftView, setLeftView] = useState("story");
  const [rightView, setRightView] = useState("graph");

  const { data: story, isLoading } = useQuery({
    queryKey: ["story", storyId],
    queryFn: () => base44.entities.Story.get(storyId),
  });

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#08080f] flex items-center justify-center text-zinc-500">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#08080f] text-zinc-100">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        <ResizablePanel defaultSize={50} minSize={25} className="flex flex-col">
          <ViewTabs view={leftView} onChange={setLeftView} />
          <PanelContent view={leftView} storyId={storyId} universeId={story?.universe_id} />
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-zinc-900" />
        <ResizablePanel defaultSize={50} minSize={25} className="flex flex-col">
          <ViewTabs view={rightView} onChange={setRightView} />
          <PanelContent view={rightView} storyId={storyId} universeId={story?.universe_id} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}